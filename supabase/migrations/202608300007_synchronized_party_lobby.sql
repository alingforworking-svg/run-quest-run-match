create or replace function public.create_runner_party(p_invitee uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); created_party uuid; existing_party uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_invitee is null or p_invitee=uid then raise exception 'Choose another runner'; end if;
  if not exists(select 1 from public.profiles where id=p_invitee and not is_private) then raise exception 'Runner is unavailable'; end if;

  select p.id into existing_party
  from public.parties p
  where p.owner_id=uid and p.status='forming'
    and exists(select 1 from public.party_members pm where pm.party_id=p.id and pm.user_id=p_invitee and pm.status in ('invited','not_ready','ready'))
  order by p.created_at desc limit 1;
  if existing_party is not null then return existing_party; end if;

  insert into public.parties(owner_id,status,max_members) values(uid,'forming',2) returning id into created_party;
  insert into public.party_members(party_id,user_id,status) values
    (created_party,uid,'not_ready'),(created_party,p_invitee,'invited');
  insert into public.notifications(user_id,kind,title,body,data)
  values(p_invitee,'party_invite','RUN TOGETHER INVITE','A matched runner invited you to a synchronized running lobby.',jsonb_build_object('partyId',created_party));
  return created_party;
end $$;

revoke all on function public.create_runner_party(uuid) from public;
grant execute on function public.create_runner_party(uuid) to authenticated;

create or replace function public.start_party_run(p_party_id uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); member_count int; ready_count int; synchronized_start timestamptz;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.parties where id=p_party_id and owner_id=uid and status='forming') then
    raise exception 'Only the party leader can start this lobby';
  end if;
  select count(*),count(*) filter(where status='ready') into member_count,ready_count
  from public.party_members where party_id=p_party_id and status<>'declined';
  if member_count<2 then raise exception 'At least two runners are required'; end if;
  if ready_count<>member_count then raise exception 'Every runner must be ready'; end if;

  synchronized_start:=clock_timestamp()+interval '6 seconds';
  update public.parties set status='active',starts_at=synchronized_start where id=p_party_id;
  insert into public.notifications(user_id,kind,title,body,data)
  select user_id,'party_start','PARTY RUN STARTING','Everyone is ready. Your synchronized run starts now.',jsonb_build_object('partyId',p_party_id,'startsAt',synchronized_start)
  from public.party_members where party_id=p_party_id and status='ready';
  return synchronized_start;
end $$;

revoke all on function public.start_party_run(uuid) from public;
grant execute on function public.start_party_run(uuid) to authenticated;

update public.party_members pm set status='not_ready'
from public.parties p
where pm.party_id=p.id and p.status='forming' and p.max_members=2 and pm.status='ready'
  and not exists(select 1 from public.run_spots s where s.party_id=p.id);
