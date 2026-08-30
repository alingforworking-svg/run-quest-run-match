-- Additive monthly Season + Rank + RP system. Lifetime XP, profiles, runs and history are preserved.
create table if not exists public.seasons (
 id uuid primary key default gen_random_uuid(),slug text unique not null,season_number int not null,name text not null,
 starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'scheduled',badge_reward text,
 config jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(ends_at>starts_at)
);
create table if not exists public.rank_tiers (
 id text primary key,name text not null,division int,min_rp int not null unique,color text not null,icon text not null,
 soft_reset_to text references public.rank_tiers(id) deferrable initially deferred,sort_order int not null unique,is_active boolean not null default true
);
create table if not exists public.rp_reward_rules (
 source_type text primary key,base_rp int not null check(base_rp>=0),daily_cap_applies boolean not null default true,
 max_awards_per_day int,config jsonb not null default '{}',is_active boolean not null default true,updated_at timestamptz not null default now()
);
create table if not exists public.season_quests (
 id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id) on delete cascade,slug text not null,name text not null,
 quest_order int not null,objective_type text not null,objective_config jsonb not null default '{}',rp_reward int not null,xp_reward int not null default 0,
 is_boss boolean not null default false,is_active boolean not null default true,unique(season_id,slug),unique(season_id,quest_order)
);
create table if not exists public.user_season_stats (
 user_id uuid not null references public.profiles(id) on delete cascade,season_id uuid not null references public.seasons(id) on delete cascade,
 current_rp int not null default 0,current_rank_id text not null references public.rank_tiers(id),highest_rank_id text not null references public.rank_tiers(id),
 current_quest_id uuid references public.season_quests(id) on delete set null,completed_quest_count int not null default 0,boss_completed boolean not null default false,
 path_completed boolean not null default false,distance_km numeric not null default 0,quest_completions int not null default 0,active_days int not null default 0,
 leaderboard_position int,newcomer_bonus_claimed boolean not null default false,started_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(user_id,season_id)
);
create table if not exists public.rp_transactions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,season_id uuid not null references public.seasons(id) on delete cascade,
 source_type text not null,source_id text not null,rp_amount int not null check(rp_amount>=0),verification_status text not null default 'verified',
 run_id uuid references public.runs(id) on delete set null,metadata jsonb not null default '{}',created_at timestamptz not null default now(),unique(user_id,season_id,source_type,source_id)
);
create table if not exists public.user_season_quest_progress (
 user_id uuid not null references public.profiles(id) on delete cascade,season_quest_id uuid not null references public.season_quests(id) on delete cascade,
 progress jsonb not null default '{}',status text not null default 'active',completed_run_id uuid references public.runs(id) on delete set null,completed_at timestamptz,
 updated_at timestamptz not null default now(),primary key(user_id,season_quest_id)
);
create table if not exists public.season_history (
 user_id uuid not null references public.profiles(id) on delete cascade,season_id uuid not null references public.seasons(id) on delete cascade,
 final_rank_id text not null references public.rank_tiers(id),highest_rank_id text not null references public.rank_tiers(id),final_rp int not null,
 leaderboard_position int,distance_km numeric not null default 0,quest_completions int not null default 0,boss_completed boolean not null default false,
 active_days int not null default 0,badge_reward text,finalized_at timestamptz not null default now(),primary key(user_id,season_id)
);
create table if not exists public.leaderboard_snapshots (
 season_id uuid not null references public.seasons(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 category text not null,rank int not null,score numeric not null,snapshot_at timestamptz not null default now(),primary key(season_id,user_id,category,snapshot_at)
);
create table if not exists public.user_season_active_days (
 user_id uuid not null references public.profiles(id) on delete cascade,season_id uuid not null references public.seasons(id) on delete cascade,
 active_date date not null,verified_run_id uuid references public.runs(id) on delete set null,primary key(user_id,season_id,active_date)
);

create index if not exists season_status_time_idx on public.seasons(status,starts_at,ends_at);
create index if not exists season_quests_path_idx on public.season_quests(season_id,quest_order);
create index if not exists season_rank_leaderboard_idx on public.user_season_stats(season_id,current_rp desc,user_id);
create index if not exists rp_transactions_audit_idx on public.rp_transactions(user_id,season_id,created_at desc);
create index if not exists season_progress_user_idx on public.user_season_quest_progress(user_id,status);
create index if not exists leaderboard_category_idx on public.leaderboard_snapshots(season_id,category,rank);

do $$ declare t text; begin foreach t in array array['seasons','rank_tiers','rp_reward_rules','season_quests','user_season_stats','rp_transactions','user_season_quest_progress','season_history','leaderboard_snapshots','user_season_active_days'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy "public seasons" on public.seasons for select using(true);
create policy "public rank tiers" on public.rank_tiers for select using(is_active);
create policy "public rp rules" on public.rp_reward_rules for select using(is_active);
create policy "public season quests" on public.season_quests for select using(is_active);
create policy "own season stats" on public.user_season_stats for select using(user_id=auth.uid());
create policy "own rp history" on public.rp_transactions for select using(user_id=auth.uid());
create policy "own season progress" on public.user_season_quest_progress for select using(user_id=auth.uid());
create policy "own season history" on public.season_history for select using(user_id=auth.uid());
create policy "public leaderboard snapshots" on public.leaderboard_snapshots for select using(true);
create policy "own active days" on public.user_season_active_days for select using(user_id=auth.uid());

insert into public.rank_tiers(id,name,division,min_rp,color,icon,soft_reset_to,sort_order) values
 ('rookie','ROOKIE',null,0,'#9b9bad','👟','rookie',1),
 ('bronze-3','BRONZE',3,200,'#c47a44','🥉','rookie',2),('bronze-2','BRONZE',2,400,'#c47a44','🥉','bronze-3',3),('bronze-1','BRONZE',1,600,'#c47a44','🥉','bronze-3',4),
 ('silver-3','SILVER',3,800,'#cbd1dc','🥈','bronze-3',5),('silver-2','SILVER',2,1000,'#cbd1dc','🥈','bronze-3',6),('silver-1','SILVER',1,1200,'#cbd1dc','🥈','bronze-3',7),
 ('gold-3','GOLD',3,1400,'#ffd43b','🥇','silver-3',8),('gold-2','GOLD',2,1700,'#ffd43b','🥇','silver-3',9),('gold-1','GOLD',1,2000,'#ffd43b','🥇','silver-3',10),
 ('platinum-3','PLATINUM',3,2300,'#59e0dc','💠','silver-3',11),('platinum-2','PLATINUM',2,2700,'#59e0dc','💠','silver-3',12),('platinum-1','PLATINUM',1,3100,'#59e0dc','💠','silver-3',13),
 ('diamond-3','DIAMOND',3,3500,'#8ad9ff','💎','gold-3',14),('diamond-2','DIAMOND',2,4000,'#8ad9ff','💎','gold-3',15),('diamond-1','DIAMOND',1,4500,'#8ad9ff','💎','gold-3',16),
 ('master-3','MASTER',3,5000,'#b388ff','👑','platinum-3',17),('master-2','MASTER',2,5600,'#b388ff','👑','platinum-3',18),('master-1','MASTER',1,6200,'#b388ff','👑','platinum-3',19),
 ('legend','LEGEND',null,7000,'#b6ff22','🏆','platinum-3',20)
on conflict(id) do update set min_rp=excluded.min_rp,color=excluded.color,soft_reset_to=excluded.soft_reset_to,is_active=true;

insert into public.rp_reward_rules(source_type,base_rp,daily_cap_applies,max_awards_per_day) values
 ('daily',100,true,1),('bonus',40,true,2),('weekly',200,false,1),('season',150,true,1),('social',50,true,1),
 ('checkpoint',50,true,1),('boss',300,false,1),('event',100,false,1),('perfect_week',100,false,1),('newcomer',100,false,1)
on conflict(source_type) do update set base_rp=excluded.base_rp,daily_cap_applies=excluded.daily_cap_applies,max_awards_per_day=excluded.max_awards_per_day;

insert into public.seasons(slug,season_number,name,starts_at,ends_at,status,badge_reward,config) values
 ('season-2026-08',8,'AUGUST SEASON','2026-08-01T00:00:00Z','2026-09-01T00:00:00Z','active','AUGUST FINISHER','{"dailyRpCap":250,"newcomerBonus":100}'::jsonb)
on conflict(slug) do update set name=excluded.name,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,config=excluded.config;

with q(slug,name,quest_order,objective_type,rp_reward,xp_reward,is_boss) as (values
 ('starter-run','STARTER RUN',1,'distance',150,180,false),('checkpoint-hunt','CHECKPOINT HUNT',2,'checkpoint',150,250,false),
 ('run-together','RUN TOGETHER',3,'social',150,300,false),('mystery-route','MYSTERY ROUTE',4,'exploration',150,350,false),
 ('personal-challenge','PERSONAL CHALLENGE',5,'pace',150,450,false),('monthly-boss','MONTHLY BOSS',6,'boss',300,800,true)
)
insert into public.season_quests(season_id,slug,name,quest_order,objective_type,objective_config,rp_reward,xp_reward,is_boss)
select s.id,q.slug,q.name,q.quest_order,q.objective_type,'{"personalized":true}'::jsonb,q.rp_reward,q.xp_reward,q.is_boss from q join public.seasons s on s.slug='season-2026-08'
on conflict(season_id,slug) do update set name=excluded.name,quest_order=excluded.quest_order,objective_type=excluded.objective_type,rp_reward=excluded.rp_reward,xp_reward=excluded.xp_reward,is_boss=excluded.is_boss;

-- Atomic audited RP award. Clients cannot bypass verification, duplicate rules, or the daily cap.
create or replace function public.award_verified_rp(p_run_id uuid,p_source_type text,p_source_id text)
returns int language plpgsql security definer set search_path=public as $$
declare
 uid uuid:=auth.uid(); sid uuid; reward int; applies_cap boolean; cap int; used int; granted int; tier_id text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.runs r join public.run_verification v on v.run_id=r.id where r.id=p_run_id and r.user_id=uid and v.status='verified' and v.trust_score>=75) then return 0; end if;
 select id,coalesce((config->>'dailyRpCap')::int,250) into sid,cap from public.seasons where starts_at<=now() and ends_at>now() and status='active' order by starts_at desc limit 1;
 if sid is null then return 0; end if;
 select base_rp,daily_cap_applies into reward,applies_cap from public.rp_reward_rules where source_type=p_source_type and is_active;
 if reward is null then return 0; end if;
 if exists(select 1 from public.rp_transactions where user_id=uid and season_id=sid and source_type=p_source_type and source_id=p_source_id) then return 0; end if;
 select coalesce(sum(rp_amount),0) into used from public.rp_transactions where user_id=uid and season_id=sid and created_at>=date_trunc('day',now()) and created_at<date_trunc('day',now())+interval '1 day' and source_type in(select source_type from public.rp_reward_rules where daily_cap_applies);
 granted:=case when applies_cap then least(reward,greatest(0,cap-used)) else reward end;
 if granted<=0 then return 0; end if;
 insert into public.rp_transactions(user_id,season_id,source_type,source_id,rp_amount,verification_status,run_id) values(uid,sid,p_source_type,p_source_id,granted,'verified',p_run_id) on conflict do nothing;
 if not found then return 0; end if;
 insert into public.user_season_stats(user_id,season_id,current_rank_id,highest_rank_id) values(uid,sid,'rookie','rookie') on conflict(user_id,season_id) do nothing;
 update public.user_season_stats set current_rp=current_rp+granted,updated_at=now() where user_id=uid and season_id=sid;
 select id into tier_id from public.rank_tiers where is_active and min_rp<=(select current_rp from public.user_season_stats where user_id=uid and season_id=sid) order by min_rp desc limit 1;
 update public.user_season_stats stats set current_rank_id=tier_id,highest_rank_id=case when (select sort_order from public.rank_tiers where id=tier_id)>(select sort_order from public.rank_tiers where id=stats.highest_rank_id) then tier_id else stats.highest_rank_id end,updated_at=now() where user_id=uid and season_id=sid;
 return granted;
end $$;
revoke all on function public.award_verified_rp(uuid,text,text) from public;
grant execute on function public.award_verified_rp(uuid,text,text) to authenticated;
