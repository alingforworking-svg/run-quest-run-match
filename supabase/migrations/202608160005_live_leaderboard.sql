-- Recalculate live season activity from verified runs and expose a safe live leaderboard RPC.
create or replace function public.refresh_live_season_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare uid uuid; sid uuid; start_time timestamptz; end_time timestamptz;
begin
  if new.status<>'verified' then return new; end if;
  select r.user_id into uid from public.runs r where r.id=new.run_id;
  select id,starts_at,ends_at into sid,start_time,end_time from public.seasons where status='active' and starts_at<=now() and ends_at>now() order by starts_at desc limit 1;
  if uid is null or sid is null then return new; end if;
  insert into public.user_season_stats(user_id,season_id,current_rank_id,highest_rank_id) values(uid,sid,'rookie','rookie') on conflict do nothing;
  insert into public.user_season_active_days(user_id,season_id,active_date,verified_run_id) values(uid,sid,current_date,new.run_id) on conflict do nothing;
  update public.user_season_stats stats set
    distance_km=coalesce((select sum(r.distance_km) from public.runs r join public.run_verification v on v.run_id=r.id where r.user_id=uid and v.status='verified' and r.ended_at>=start_time and r.ended_at<end_time),0),
    quest_completions=(select count(*) from public.runs r join public.run_verification v on v.run_id=r.id where r.user_id=uid and v.status='verified' and r.ended_at>=start_time and r.ended_at<end_time),
    active_days=(select count(*) from public.user_season_active_days d where d.user_id=uid and d.season_id=sid),updated_at=now()
  where stats.user_id=uid and stats.season_id=sid;
  return new;
end $$;
drop trigger if exists refresh_live_season_after_verification on public.run_verification;
create trigger refresh_live_season_after_verification after insert or update of status on public.run_verification for each row execute function public.refresh_live_season_activity();

create or replace function public.get_live_leaderboard(p_category text default 'overall',p_limit int default 100)
returns table(user_id uuid,display_name text,avatar_url text,rank bigint,score numeric)
language sql stable security definer set search_path=public as $$
  with active as(select id from public.seasons where status='active' and starts_at<=now() and ends_at>now() order by starts_at desc limit 1), valueset as(
    select s.user_id,p.display_name,p.avatar_url,
      case p_category when 'distance' then s.distance_km when 'quests' then s.quest_completions::numeric when 'consistency' then s.active_days::numeric
      when 'social' then (select count(*)::numeric from public.friendships f where f.status='accepted' and s.user_id in(f.requester_id,f.addressee_id))
      when 'checkpoints' then (select coalesce(sum(r.checkpoint_count),0)::numeric from public.runs r join public.run_verification v on v.run_id=r.id where r.user_id=s.user_id and v.status='verified')
      else s.current_rp::numeric end as score
    from public.user_season_stats s join active a on a.id=s.season_id join public.profiles p on p.id=s.user_id where not p.is_private
  )
  select v.user_id,v.display_name,v.avatar_url,row_number() over(order by v.score desc,v.user_id),v.score from valueset v order by v.score desc,v.user_id limit greatest(1,least(p_limit,100));
$$;
revoke all on function public.get_live_leaderboard(text,int) from public;
grant execute on function public.get_live_leaderboard(text,int) to authenticated;
