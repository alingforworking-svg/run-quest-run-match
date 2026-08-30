-- Lazily creates the current Vientiane monthly season, archives ended seasons,
-- and starts every player at Rookie / 0 RP. Lifetime data is never changed.
create or replace function public.ensure_monthly_season()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  local_month timestamp:=date_trunc('month',timezone('Asia/Vientiane',now()));
  start_time timestamptz:=local_month at time zone 'Asia/Vientiane';
  end_time timestamptz:=(local_month+interval '1 month') at time zone 'Asia/Vientiane';
  season_slug text:='season-'||to_char(local_month,'YYYY-MM');
  season_name text:=upper(to_char(local_month,'FMMonth'))||' SEASON';
  season_badge text:=upper(to_char(local_month,'FMMonth'))||' FINISHER';
  sid uuid;
begin
  insert into public.seasons(slug,season_number,name,starts_at,ends_at,status,badge_reward,config)
  values(season_slug,extract(month from local_month)::int,season_name,start_time,end_time,'active',season_badge,'{"dailyRpCap":250,"newcomerBonus":100,"resetMode":"full"}'::jsonb)
  on conflict(slug) do update set name=excluded.name,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='active',badge_reward=excluded.badge_reward,config=excluded.config
  returning id into sid;

  update public.seasons set status='completed',updated_at=now()
  where id<>sid and status='active';

  with quest(slug,name,quest_order,objective_type,rp_reward,xp_reward,is_boss) as (values
    ('starter-run','STARTER RUN',1,'distance',150,180,false),
    ('checkpoint-hunt','CHECKPOINT HUNT',2,'checkpoint',150,250,false),
    ('run-together','RUN TOGETHER',3,'social',150,300,false),
    ('mystery-route','MYSTERY ROUTE',4,'exploration',150,350,false),
    ('personal-challenge','PERSONAL CHALLENGE',5,'pace',150,450,false),
    ('monthly-boss','MONTHLY BOSS',6,'boss',300,800,true)
  )
  insert into public.season_quests(season_id,slug,name,quest_order,objective_type,objective_config,rp_reward,xp_reward,is_boss)
  select sid,q.slug,q.name,q.quest_order,q.objective_type,'{"personalized":true}'::jsonb,q.rp_reward,q.xp_reward,q.is_boss from quest q
  on conflict(season_id,slug) do nothing;

  with ranked as (
    select stats.*,rank() over(partition by stats.season_id order by stats.current_rp desc,stats.user_id) as final_position
    from public.user_season_stats stats join public.seasons ended on ended.id=stats.season_id
    where ended.id<>sid and ended.status='completed'
  )
  insert into public.season_history(user_id,season_id,final_rank_id,highest_rank_id,final_rp,leaderboard_position,distance_km,quest_completions,boss_completed,active_days,badge_reward,finalized_at)
  select ranked.user_id,ranked.season_id,ranked.current_rank_id,ranked.highest_rank_id,ranked.current_rp,ranked.final_position::int,ranked.distance_km,ranked.quest_completions,ranked.boss_completed,ranked.active_days,
    case when ranked.path_completed then ended.badge_reward else null end,ended.ends_at
  from ranked join public.seasons ended on ended.id=ranked.season_id
  on conflict(user_id,season_id) do nothing;

  if uid is not null then
    insert into public.user_season_stats(user_id,season_id,current_rp,current_rank_id,highest_rank_id,started_at)
    values(uid,sid,0,'rookie','rookie',now())
    on conflict(user_id,season_id) do nothing;
  end if;
  return sid;
end $$;

revoke all on function public.ensure_monthly_season() from public;
grant execute on function public.ensure_monthly_season() to authenticated;

-- Always resolve the current month before granting RP.
create or replace function public.award_verified_rp(p_run_id uuid,p_source_type text,p_source_id text)
returns int language plpgsql security definer set search_path=public as $$
declare
 uid uuid:=auth.uid(); sid uuid; reward int; applies_cap boolean; cap int; used int; granted int; tier_id text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.runs r join public.run_verification v on v.run_id=r.id where r.id=p_run_id and r.user_id=uid and v.status='verified' and v.trust_score>=75) then return 0; end if;
 sid:=public.ensure_monthly_season();
 select coalesce((config->>'dailyRpCap')::int,250) into cap from public.seasons where id=sid;
 select base_rp,daily_cap_applies into reward,applies_cap from public.rp_reward_rules where source_type=p_source_type and is_active;
 if reward is null then return 0; end if;
 if exists(select 1 from public.rp_transactions where user_id=uid and season_id=sid and source_type=p_source_type and source_id=p_source_id) then return 0; end if;
 select coalesce(sum(rp_amount),0) into used from public.rp_transactions where user_id=uid and season_id=sid and created_at>=date_trunc('day',now()) and created_at<date_trunc('day',now())+interval '1 day' and source_type in(select source_type from public.rp_reward_rules where daily_cap_applies);
 granted:=case when applies_cap then least(reward,greatest(0,cap-used)) else reward end;
 if granted<=0 then return 0; end if;
 insert into public.rp_transactions(user_id,season_id,source_type,source_id,rp_amount,verification_status,run_id) values(uid,sid,p_source_type,p_source_id,granted,'verified',p_run_id) on conflict do nothing;
 if not found then return 0; end if;
 update public.user_season_stats set current_rp=current_rp+granted,updated_at=now() where user_id=uid and season_id=sid;
 select id into tier_id from public.rank_tiers where is_active and min_rp<=(select current_rp from public.user_season_stats where user_id=uid and season_id=sid) order by min_rp desc limit 1;
 update public.user_season_stats stats set current_rank_id=tier_id,highest_rank_id=case when (select sort_order from public.rank_tiers where id=tier_id)>(select sort_order from public.rank_tiers where id=stats.highest_rank_id) then tier_id else stats.highest_rank_id end,updated_at=now() where user_id=uid and season_id=sid;
 return granted;
end $$;

revoke all on function public.award_verified_rp(uuid,text,text) from public;
grant execute on function public.award_verified_rp(uuid,text,text) to authenticated;

-- Verified distance and activity are also assigned to the new month automatically.
create or replace function public.refresh_live_season_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare uid uuid; sid uuid; start_time timestamptz; end_time timestamptz;
begin
  if new.status<>'verified' then return new; end if;
  select r.user_id into uid from public.runs r where r.id=new.run_id;
  sid:=public.ensure_monthly_season();
  select starts_at,ends_at into start_time,end_time from public.seasons where id=sid;
  if uid is null or sid is null then return new; end if;
  insert into public.user_season_stats(user_id,season_id,current_rank_id,highest_rank_id) values(uid,sid,'rookie','rookie') on conflict do nothing;
  insert into public.user_season_active_days(user_id,season_id,active_date,verified_run_id) values(uid,sid,(timezone('Asia/Vientiane',now()))::date,new.run_id) on conflict do nothing;
  update public.user_season_stats stats set
    distance_km=coalesce((select sum(r.distance_km) from public.runs r join public.run_verification v on v.run_id=r.id where r.user_id=uid and v.status='verified' and r.ended_at>=start_time and r.ended_at<end_time),0),
    quest_completions=(select count(*) from public.runs r join public.run_verification v on v.run_id=r.id where r.user_id=uid and v.status='verified' and r.ended_at>=start_time and r.ended_at<end_time),
    active_days=(select count(*) from public.user_season_active_days d where d.user_id=uid and d.season_id=sid),updated_at=now()
  where stats.user_id=uid and stats.season_id=sid;
  return new;
end $$;
