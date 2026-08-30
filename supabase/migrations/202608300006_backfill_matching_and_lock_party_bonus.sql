insert into public.runner_preferences(
  user_id,preferred_distance_min_km,preferred_distance_max_km,average_pace_min_km,
  experience_level,preferred_times,running_styles
)
select
  p.id,
  case p.profile_preferences->>'comfortableDistance' when '1-3' then 1 when '3-5' then 3 when '5-10' then 5 when '10+' then 10 else 3 end,
  case p.profile_preferences->>'comfortableDistance' when '1-3' then 3 when '3-5' then 5 when '5-10' then 10 when '10+' then 20 else 5 end,
  case p.profile_preferences->>'pace' when 'under-5' then 4.75 when '5-6' then 5.5 when '6-7' then 6.5 when '7-8' then 7.5 when '8+' then 8.5 else 7.25 end,
  case p.profile_preferences->>'frequency' when 'starting' then 'beginner' when '5+' then 'advanced' else 'intermediate' end,
  case when coalesce(p.profile_preferences->>'preferredTime','')='' then '{}'::text[] else array[p.profile_preferences->>'preferredTime'] end,
  case when coalesce(p.profile_preferences->>'style','')='' then '{}'::text[] else array[p.profile_preferences->>'style'] end
from public.profiles p
where p.profile_preferences<>'{}'::jsonb
on conflict(user_id) do update set
  preferred_distance_min_km=excluded.preferred_distance_min_km,
  preferred_distance_max_km=excluded.preferred_distance_max_km,
  average_pace_min_km=excluded.average_pace_min_km,
  experience_level=excluded.experience_level,
  preferred_times=excluded.preferred_times,
  running_styles=excluded.running_styles;

create or replace function public.lock_party_run_before_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.party_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.party_id::text,0));
  end if;
  return new;
end $$;

drop trigger if exists runs_lock_party_bonus on public.runs;
create trigger runs_lock_party_bonus
before insert on public.runs
for each row execute function public.lock_party_run_before_insert();
