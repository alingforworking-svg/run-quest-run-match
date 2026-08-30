-- A missing route is a normal meetup pin, so has_route must be false rather
-- than SQL null. Replacing the function keeps party + pin creation atomic.
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
  route_is_present boolean:=false;
begin
  if current_user_id is null then raise exception 'Login required'; end if;
  if char_length(trim(p_title)) not between 3 and 80 then raise exception 'Run name must be 3-80 characters'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid meeting point'; end if;
  if p_distance_km<=0 or p_distance_km>100 then raise exception 'Distance must be 0-100 KM'; end if;
  if p_max_members not between 2 and 10 then raise exception 'Party size must be 2-10 runners'; end if;

  select * into runner from public.profiles where id=current_user_id;
  if not found then raise exception 'Runner profile is required'; end if;

  route_is_present:=coalesce(
    jsonb_typeof(p_route_points)='array' and jsonb_array_length(p_route_points)>1,
    false
  );

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
    route_is_present,
    case when route_is_present then p_route_points else null end
  ) returning * into created_spot;

  return created_spot;
end $$;

revoke all on function public.create_public_run_spot(text,text,double precision,double precision,numeric,text,timestamptz,int,jsonb) from public;
grant execute on function public.create_public_run_spot(text,text,double precision,double precision,numeric,text,timestamptz,int,jsonb) to authenticated;
