alter table public.profiles
  add column if not exists verified_run_count int not null default 0 check (verified_run_count >= 0),
  add column if not exists verified_distance_km numeric not null default 0 check (verified_distance_km >= 0);

with verified_totals as (
  select r.user_id,count(*)::int as run_count,coalesce(sum(r.distance_km),0) as distance_km
  from public.runs r
  join public.run_verification v on v.run_id=r.id and v.status='verified'
  group by r.user_id
), xp_totals as (
  select user_id,coalesce(sum(amount),0)::bigint as total_xp
  from public.xp_transactions
  group by user_id
)
update public.profiles p set
  verified_run_count=greatest(p.verified_run_count,coalesce(v.run_count,0)),
  verified_distance_km=greatest(p.verified_distance_km,coalesce(v.distance_km,0)),
  total_xp=greatest(p.total_xp,coalesce(x.total_xp,0)),
  level=least(100,greatest(p.level,floor(greatest(p.total_xp,coalesce(x.total_xp,0))/500.0)::int+1)),
  title=case
    when least(100,greatest(p.level,floor(greatest(p.total_xp,coalesce(x.total_xp,0))/500.0)::int+1)) >= 35 then 'CITY LEGEND'
    when least(100,greatest(p.level,floor(greatest(p.total_xp,coalesce(x.total_xp,0))/500.0)::int+1)) >= 20 then 'QUEST VETERAN'
    when least(100,greatest(p.level,floor(greatest(p.total_xp,coalesce(x.total_xp,0))/500.0)::int+1)) >= 10 then 'ROAD RANGER'
    when least(100,greatest(p.level,floor(greatest(p.total_xp,coalesce(x.total_xp,0))/500.0)::int+1)) >= 5 then 'CITY SCOUT'
    else 'ROOKIE' end
from verified_totals v full join xp_totals x on x.user_id=v.user_id
where p.id=coalesce(v.user_id,x.user_id);

create unique index if not exists xp_party_bonus_once_idx
  on public.xp_transactions (user_id,(metadata->>'partyId'))
  where reason='party_run_bonus';

create or replace function public.create_runner_party(p_invitee uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); created_party uuid; existing_party uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_invitee is null or p_invitee=uid then raise exception 'Choose another runner'; end if;
  if not exists(select 1 from public.profiles where id=p_invitee and not is_private) then raise exception 'Runner is unavailable'; end if;

  select p.id into existing_party
  from public.parties p
  where p.owner_id=uid and p.status in ('forming','active')
    and exists(select 1 from public.party_members pm where pm.party_id=p.id and pm.user_id=p_invitee and pm.status in ('invited','ready'))
  order by p.created_at desc limit 1;
  if existing_party is not null then return existing_party; end if;

  insert into public.parties(owner_id,status,max_members) values(uid,'forming',2) returning id into created_party;
  insert into public.party_members(party_id,user_id,status) values
    (created_party,uid,'ready'),(created_party,p_invitee,'invited');
  insert into public.notifications(user_id,kind,title,body,data)
  values(p_invitee,'party_invite','RUN TOGETHER INVITE','A matched runner invited you to run together. Complete a verified party run for +20 XP.',jsonb_build_object('partyId',created_party));
  return created_party;
end $$;

revoke all on function public.create_runner_party(uuid) from public;
grant execute on function public.create_runner_party(uuid) to authenticated;

drop function if exists public.save_completed_gps_run_v2(uuid,text,int,int,numeric,int,jsonb,int);
create function public.save_completed_gps_run_v2(
  p_run_id uuid,
  p_quest_key text,
  p_elapsed_seconds int,
  p_moving_seconds int,
  p_reported_distance_km numeric,
  p_checkpoint_count int,
  p_points jsonb,
  p_xp int default 0,
  p_party_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); point jsonb; previous jsonb; point_count int:=0;
  calculated_km double precision:=0; segment_km double precision; segment_seconds double precision; segment_speed double precision;
  lat1 double precision; lat2 double precision; lon1 double precision; lon2 double precision;
  accuracy_sum numeric:=0; trust int:=100; verified boolean; pace numeric; jump_count int:=0; gap_count int:=0;
  bonus_member record; awarded_user uuid; party_bonus_xp int:=0; next_total bigint; next_level int;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_points is null or jsonb_typeof(p_points)<>'array' then raise exception 'GPS points must be an array'; end if;
  if p_elapsed_seconds<0 or p_elapsed_seconds>86400 then raise exception 'Invalid elapsed time'; end if;
  if p_moving_seconds<0 or p_moving_seconds>p_elapsed_seconds then raise exception 'Invalid moving time'; end if;
  if jsonb_array_length(p_points)>1000 then raise exception 'Too many GPS points'; end if;
  if p_party_id is not null and not exists(
    select 1 from public.parties p join public.party_members pm on pm.party_id=p.id
    where p.id=p_party_id and p.status='active' and pm.user_id=uid and pm.status='ready'
  ) then raise exception 'Active party membership is required'; end if;

  for point in select value from jsonb_array_elements(p_points) loop
    point_count:=point_count+1;
    accuracy_sum:=accuracy_sum+coalesce((point->>'accuracy')::numeric,0);
    if previous is not null then
      segment_seconds:=((point->>'timestamp')::double precision-(previous->>'timestamp')::double precision)/1000;
      lat1:=radians((previous->>'lat')::double precision);lat2:=radians((point->>'lat')::double precision);
      lon1:=radians((previous->>'lng')::double precision);lon2:=radians((point->>'lng')::double precision);
      segment_km:=6371*2*asin(sqrt(power(sin((lat2-lat1)/2),2)+cos(lat1)*cos(lat2)*power(sin((lon2-lon1)/2),2)));
      if segment_seconds<=0 then trust:=trust-10;
      elsif segment_seconds>30 then gap_count:=gap_count+1;
      else segment_speed:=segment_km*1000/segment_seconds;if segment_speed<=12 then calculated_km:=calculated_km+segment_km;else jump_count:=jump_count+1;trust:=trust-20;end if;
      end if;
    end if;
    previous:=point;
  end loop;

  if point_count<3 then trust:=trust-40;end if;
  if calculated_km<0.03 then trust:=trust-20;end if;
  if point_count>0 and accuracy_sum/point_count>35 then trust:=trust-15;end if;
  if gap_count>0 then trust:=trust-least(24,gap_count*8);end if;
  if abs(calculated_km-coalesce(p_reported_distance_km,0))>greatest(0.10,calculated_km*0.25) then trust:=trust-30;end if;
  if p_moving_seconds>0 and calculated_km*1000/p_moving_seconds>12 then trust:=trust-50;end if;
  trust:=greatest(0,least(100,trust));verified:=trust>=75;
  pace:=case when calculated_km>0.01 and p_moving_seconds>0 then (p_moving_seconds/60.0)/calculated_km else null end;

  insert into public.runs(id,user_id,party_id,status,started_at,ended_at,distance_km,elapsed_seconds,moving_seconds,average_pace,checkpoint_count)
  values(p_run_id,uid,p_party_id,'completed',now()-make_interval(secs=>p_elapsed_seconds),now(),round(calculated_km::numeric,3),p_elapsed_seconds,p_moving_seconds,pace,greatest(0,p_checkpoint_count));
  insert into public.run_points(run_id,user_id,captured_at,latitude,longitude,accuracy_meters,speed_mps)
  select p_run_id,uid,to_timestamp(((value->>'timestamp')::double precision)/1000),(value->>'lat')::double precision,(value->>'lng')::double precision,nullif(value->>'accuracy','')::numeric,nullif(value->>'speed','')::numeric from jsonb_array_elements(p_points);
  insert into public.run_verification(run_id,trust_score,status,flags,stats)
  values(p_run_id,trust,case when verified then 'verified' else 'unverified' end,
    jsonb_build_array()||(case when jump_count>0 then jsonb_build_array(jump_count||' impossible GPS jumps') else '[]'::jsonb end)||(case when gap_count>0 then jsonb_build_array(gap_count||' missing GPS segments') else '[]'::jsonb end),
    jsonb_build_object('engine','gps-v2','questKey',p_quest_key,'distanceKm',round(calculated_km::numeric,3),'pointCount',point_count,'movingSeconds',p_moving_seconds,'jumpCount',jump_count,'gapCount',gap_count,'partyId',p_party_id));

  if verified then
    update public.profiles set verified_run_count=verified_run_count+1,verified_distance_km=verified_distance_km+round(calculated_km::numeric,3) where id=uid;
  end if;
  if verified and p_xp>0 then
    insert into public.xp_transactions(user_id,run_id,amount,reason) values(uid,p_run_id,least(p_xp,5000),'verified_run');
    update public.profiles set total_xp=total_xp+least(p_xp,5000) where id=uid;
  end if;

  if verified and p_party_id is not null and (select count(distinct r.user_id) from public.runs r join public.run_verification v on v.run_id=r.id and v.status='verified' where r.party_id=p_party_id)>=2 then
    for bonus_member in
      select distinct on (r.user_id) r.user_id,r.id as run_id from public.runs r
      join public.run_verification v on v.run_id=r.id and v.status='verified'
      join public.party_members pm on pm.party_id=r.party_id and pm.user_id=r.user_id and pm.status='ready'
      where r.party_id=p_party_id order by r.user_id,r.ended_at
    loop
      awarded_user:=null;
      insert into public.xp_transactions(user_id,run_id,amount,reason,metadata)
      values(bonus_member.user_id,bonus_member.run_id,20,'party_run_bonus',jsonb_build_object('partyId',p_party_id))
      on conflict do nothing returning user_id into awarded_user;
      if awarded_user is not null then
        update public.profiles set
          total_xp=total_xp+20,
          level=least(100,floor((total_xp+20)/500.0)::int+1),
          title=case
            when least(100,floor((total_xp+20)/500.0)::int+1)>=35 then 'CITY LEGEND'
            when least(100,floor((total_xp+20)/500.0)::int+1)>=20 then 'QUEST VETERAN'
            when least(100,floor((total_xp+20)/500.0)::int+1)>=10 then 'ROAD RANGER'
            when least(100,floor((total_xp+20)/500.0)::int+1)>=5 then 'CITY SCOUT'
            else 'ROOKIE' end
        where id=awarded_user;
        insert into public.notifications(user_id,kind,title,body,data)
        values(awarded_user,'party_bonus','PARTY RUN +20 XP','Both runners completed a verified party run.',jsonb_build_object('partyId',p_party_id,'runId',bonus_member.run_id));
        if awarded_user=uid then party_bonus_xp:=20;end if;
      end if;
    end loop;
  end if;

  select total_xp into next_total from public.profiles where id=uid;
  next_level:=least(100,floor(next_total/500.0)::int+1);
  update public.profiles set level=next_level,title=case when next_level>=35 then 'CITY LEGEND' when next_level>=20 then 'QUEST VETERAN' when next_level>=10 then 'ROAD RANGER' when next_level>=5 then 'CITY SCOUT' else 'ROOKIE' end where id=uid;
  delete from public.run_points where created_at<now()-interval '30 days';
  return jsonb_build_object('runId',p_run_id,'distanceKm',round(calculated_km::numeric,3),'movingSeconds',p_moving_seconds,'trustScore',trust,'verified',verified,'storedPoints',point_count,'partyBonusXp',party_bonus_xp);
end $$;

revoke all on function public.save_completed_gps_run_v2(uuid,text,int,int,numeric,int,jsonb,int,uuid) from public;
grant execute on function public.save_completed_gps_run_v2(uuid,text,int,int,numeric,int,jsonb,int,uuid) to authenticated;
