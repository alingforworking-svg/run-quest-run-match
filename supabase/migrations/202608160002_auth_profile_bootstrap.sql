-- Every authenticated account needs a profile before Runner DNA, runs, parties and rewards can reference it.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare generated_username text:='runner_'||substr(new.id::text,1,8);
begin
  insert into public.profiles(id,username,display_name,avatar_url)
  values(new.id,generated_username,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(coalesce(new.email,'Runner'),'@',1)),'🏃')
  on conflict(id) do nothing;
  insert into public.runner_preferences(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill accounts created before this trigger existed.
insert into public.profiles(id,username,display_name,avatar_url)
select u.id,'runner_'||substr(u.id::text,1,8),coalesce(nullif(u.raw_user_meta_data->>'display_name',''),split_part(coalesce(u.email,'Runner'),'@',1)),'🏃'
from auth.users u left join public.profiles p on p.id=u.id where p.id is null
on conflict(id) do nothing;
insert into public.runner_preferences(user_id)
select p.id from public.profiles p left join public.runner_preferences rp on rp.user_id=p.id where rp.user_id is null
on conflict(user_id) do nothing;
