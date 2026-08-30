-- TikTok-style daily app visit streak. Running streak data stays separate.
alter table public.profiles
  add column if not exists visit_streak_days int not null default 0 check(visit_streak_days>=0),
  add column if not exists last_visit_date date;

create or replace function public.record_daily_visit()
returns int
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  today_local date:=(timezone('Asia/Vientiane',now()))::date;
  result_streak int;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  update public.profiles
  set visit_streak_days=case
      when last_visit_date=today_local then visit_streak_days
      when last_visit_date=today_local-1 then visit_streak_days+1
      else 1
    end,
    last_visit_date=today_local,
    updated_at=now()
  where id=uid
  returning visit_streak_days into result_streak;

  if result_streak is null then raise exception 'Runner profile not found'; end if;
  return result_streak;
end $$;

revoke all on function public.record_daily_visit() from public;
grant execute on function public.record_daily_visit() to authenticated;
