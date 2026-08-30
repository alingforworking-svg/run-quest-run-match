-- Route geometry is deliberately excluded from the marker-list query and fetched only after a pin is opened.
alter table public.run_spots add column if not exists has_route boolean not null default false;
alter table public.run_spots add column if not exists route_points jsonb;
alter table public.run_spots add constraint run_spots_route_points_array check(route_points is null or jsonb_typeof(route_points)='array');
