alter table public.profiles
  add column if not exists profile_preferences jsonb not null default '{}'::jsonb,
  add column if not exists quest_notifications boolean not null default true,
  add column if not exists match_group text not null default 'Everyone • 8 KM',
  add column if not exists emergency_contact text not null default '';

alter table public.run_signals
  add column if not exists approx_latitude numeric(6,3),
  add column if not exists approx_longitude numeric(7,3);

alter table public.run_signals
  add constraint run_signals_approx_latitude_check
    check (approx_latitude is null or approx_latitude between -90 and 90),
  add constraint run_signals_approx_longitude_check
    check (approx_longitude is null or approx_longitude between -180 and 180);

create index if not exists run_signals_active_expiry_idx
  on public.run_signals (status, expires_at desc)
  where status = 'active';
