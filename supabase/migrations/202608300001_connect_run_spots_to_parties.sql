-- A public run spot is also a real party. Creating or joining one must update
-- both systems atomically so every runner lands in the same lobby.
alter table public.run_spots
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists max_members int not null default 6 check(max_members between 2 and 10);

create unique index if not exists run_spots_party_id_key
  on public.run_spots(party_id) where party_id is not null;

create or replace function public.is_party_member(p_party_id uuid,p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.party_members
    where party_id=p_party_id and user_id=p_user_id
  );
$$;

revoke all on function public.is_party_member(uuid,uuid) from public;
grant execute on function public.is_party_member(uuid,uuid) to authenticated;

drop policy if exists "party member rows" on public.party_members;
create policy "party members can view the lobby"
  on public.party_members for select
  using(public.is_party_member(party_id,auth.uid()));

drop policy if exists "party visible to members" on public.parties;
create policy "party visible to members"
  on public.parties for select
  using(owner_id=auth.uid() or public.is_party_member(id,auth.uid()));

-- Preserve existing public pins by giving each one its own party.
do $$
declare spot record; created_party uuid;
begin
  for spot in
    select * from public.run_spots where party_id is null
  loop
    insert into public.parties(
      owner_id,status,max_members,meeting_point_name,
      meeting_latitude,meeting_longitude,starts_at
    ) values(
      spot.user_id,
      case when spot.status='active' and spot.expires_at>now() then 'forming' else spot.status end,
      spot.max_members,spot.title,spot.latitude,spot.longitude,spot.starts_at
    ) returning id into created_party;

    insert into public.party_members(party_id,user_id,status)
    values(created_party,spot.user_id,'ready')
    on conflict(party_id,user_id) do update set status='ready';

    insert into public.party_members(party_id,user_id,status,joined_at)
    select created_party,j.user_id,'ready',j.joined_at
    from public.run_spot_joins j
    where j.run_spot_id=spot.id
    on conflict(party_id,user_id) do nothing;

    update public.run_spots set party_id=created_party where id=spot.id;
  end loop;
end $$;

create or replace function public.create_public_run_spot(
  p_title text,
  p_note text,
  p_latitude double precision,
  p_longitude double precision,
  p_distance_km numeric,
  p_pace_label text,
  p_starts_at timestamptz,
  p_max_members int default 6,
  p_route_points jsonb default null
)
returns public.run_spots
language plpgsql
security definer
set search_path=''
as $$
declare
  current_user_id uuid:=auth.uid();
  runner public.profiles%rowtype;
  created_party uuid;
  created_spot public.run_spots%rowtype;
begin
  if current_user_id is null then raise exception 'Login required'; end if;
  if char_length(trim(p_title)) not between 3 and 80 then raise exception 'Run name must be 3-80 characters'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid meeting point'; end if;
  if p_distance_km<=0 or p_distance_km>100 then raise exception 'Distance must be 0-100 KM'; end if;
  if p_max_members not between 2 and 10 then raise exception 'Party size must be 2-10 runners'; end if;

  select * into runner from public.profiles where id=current_user_id;
  if not found then raise exception 'Runner profile is required'; end if;

  insert into public.parties(
    owner_id,status,max_members,meeting_point_name,
    meeting_latitude,meeting_longitude,starts_at
  ) values(
    current_user_id,'forming',p_max_members,trim(p_title),
    p_latitude,p_longitude,p_starts_at
  ) returning id into created_party;

  insert into public.party_members(party_id,user_id,status)
  values(created_party,current_user_id,'ready');

  insert into public.run_spots(
    user_id,owner_name,owner_avatar,title,note,latitude,longitude,
    distance_km,pace_label,starts_at,expires_at,party_id,max_members,
    has_route,route_points
  ) values(
    current_user_id,runner.display_name,runner.avatar_url,trim(p_title),
    left(coalesce(p_note,''),240),p_latitude,p_longitude,p_distance_km,
    coalesce(nullif(trim(p_pace_label),''),'NO PRESSURE'),p_starts_at,
    p_starts_at+interval '24 hours',created_party,p_max_members,
    jsonb_typeof(p_route_points)='array' and jsonb_array_length(p_route_points)>1,
    case when jsonb_typeof(p_route_points)='array' then p_route_points else null end
  ) returning * into created_spot;

  return created_spot;
end $$;

create or replace function public.join_public_run_spot(p_spot_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  current_user_id uuid:=auth.uid();
  spot public.run_spots%rowtype;
  member_total int;
begin
  if current_user_id is null then raise exception 'Login required'; end if;

  select * into spot from public.run_spots where id=p_spot_id for update;
  if not found or spot.status<>'active' or spot.expires_at<=now() then
    raise exception 'This run is no longer available';
  end if;

  if spot.party_id is null then raise exception 'This run has no party'; end if;
  if current_user_id=spot.user_id then return spot.party_id; end if;

  if exists(select 1 from public.party_members where party_id=spot.party_id and user_id=current_user_id) then
    insert into public.run_spot_joins(run_spot_id,user_id)
    values(spot.id,current_user_id) on conflict do nothing;
    return spot.party_id;
  end if;

  select count(*) into member_total from public.party_members where party_id=spot.party_id;
  if member_total>=spot.max_members then raise exception 'This run party is full'; end if;

  insert into public.party_members(party_id,user_id,status)
  values(spot.party_id,current_user_id,'ready');
  insert into public.run_spot_joins(run_spot_id,user_id)
  values(spot.id,current_user_id) on conflict do nothing;

  return spot.party_id;
end $$;

create or replace function public.leave_public_run_spot(p_spot_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare current_user_id uuid:=auth.uid(); spot public.run_spots%rowtype;
begin
  if current_user_id is null then raise exception 'Login required'; end if;
  select * into spot from public.run_spots where id=p_spot_id for update;
  if not found then return; end if;
  if spot.user_id=current_user_id then raise exception 'The organizer must cancel the run instead'; end if;
  delete from public.run_spot_joins where run_spot_id=spot.id and user_id=current_user_id;
  delete from public.party_members where party_id=spot.party_id and user_id=current_user_id;
end $$;

create or replace function public.cancel_public_run_spot(p_spot_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare current_user_id uuid:=auth.uid(); linked_party uuid;
begin
  if current_user_id is null then raise exception 'Login required'; end if;
  update public.run_spots set status='cancelled'
  where id=p_spot_id and user_id=current_user_id and status='active'
  returning party_id into linked_party;
  if not found then raise exception 'Only the organizer can cancel this run'; end if;
  update public.parties set status='cancelled' where id=linked_party and owner_id=current_user_id;
end $$;

revoke all on function public.create_public_run_spot(text,text,double precision,double precision,numeric,text,timestamptz,int,jsonb) from public;
revoke all on function public.join_public_run_spot(uuid) from public;
revoke all on function public.leave_public_run_spot(uuid) from public;
revoke all on function public.cancel_public_run_spot(uuid) from public;
grant execute on function public.create_public_run_spot(text,text,double precision,double precision,numeric,text,timestamptz,int,jsonb) to authenticated;
grant execute on function public.join_public_run_spot(uuid) to authenticated;
grant execute on function public.leave_public_run_spot(uuid) to authenticated;
grant execute on function public.cancel_public_run_spot(uuid) to authenticated;
