-- Public meetup pins deliberately shared by runners. These are not live tracking points.
create table if not exists public.run_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owner_name text not null check(char_length(owner_name) between 1 and 50),
  owner_avatar text,
  title text not null check(char_length(title) between 3 and 80),
  note text not null default '' check(char_length(note)<=240),
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  distance_km numeric check(distance_km>0 and distance_km<=100),
  pace_label text,
  starts_at timestamptz not null,
  expires_at timestamptz not null default (now()+interval '24 hours'),
  status text not null default 'active' check(status in ('active','cancelled','completed')),
  join_count int not null default 1 check(join_count>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.run_spot_joins (
  run_spot_id uuid not null references public.run_spots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(run_spot_id,user_id)
);
create index if not exists run_spots_active_time_idx on public.run_spots(status,starts_at,expires_at);
alter table public.run_spots enable row level security;
alter table public.run_spot_joins enable row level security;
create policy "public active run spots" on public.run_spots for select using(status='active' and expires_at>now());
create policy "create own run spot" on public.run_spots for insert with check(user_id=auth.uid());
create policy "manage own run spot" on public.run_spots for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "delete own run spot" on public.run_spots for delete using(user_id=auth.uid());
create policy "view run spot joins" on public.run_spot_joins for select using(true);
create policy "join run spot" on public.run_spot_joins for insert with check(user_id=auth.uid());
create policy "leave run spot" on public.run_spot_joins for delete using(user_id=auth.uid());
create trigger run_spots_updated_at before update on public.run_spots for each row execute function public.set_updated_at();

create or replace function public.refresh_run_spot_join_count() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid:=coalesce(new.run_spot_id,old.run_spot_id);
begin update public.run_spots set join_count=1+(select count(*) from public.run_spot_joins where run_spot_id=target) where id=target;return coalesce(new,old);end $$;
create trigger run_spot_join_count after insert or delete on public.run_spot_joins for each row execute function public.refresh_run_spot_join_count();
