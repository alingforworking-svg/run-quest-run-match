-- Additive RUN QUEST progression architecture. Preserves existing auth, runs, XP and quest data.
alter table public.quests add column if not exists journey_order int;
alter table public.quests add column if not exists is_main_quest boolean not null default false;
alter table public.quests add column if not exists is_boss boolean not null default false;

create table if not exists public.user_main_progress (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 current_world_id uuid references public.worlds(id) on delete set null,current_quest_id uuid references public.quests(id) on delete set null,
 completed_quest_count int not null default 0,bosses_completed int not null default 0,main_journey_completed boolean not null default false,
 journey_started_at timestamptz not null default now(),journey_completed_at timestamptz,total_journey_seconds bigint,
 final_level int,final_distance_km numeric,final_badge text,end_game_unlocked boolean not null default false,updated_at timestamptz not null default now()
);
create table if not exists public.user_daily_quests (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,template_id text references public.quest_templates(template_id) on delete set null,
 assignment_date date not null,generated_title text not null,objective_config jsonb not null,reward_xp int not null,status text not null default 'assigned',
 personalization_score int not null,player_state text not null,assigned_at timestamptz not null default now(),completed_at timestamptz,unique(user_id,assignment_date)
);
create table if not exists public.weekly_challenges (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,week_start date not null,title text not null,
 objective_config jsonb not null,target_value numeric not null,progress_value numeric not null default 0,reward_xp int not null,status text not null default 'active',completed_at timestamptz,unique(user_id,week_start)
);
create table if not exists public.special_events (
 id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null,description text not null,objective_config jsonb not null,
 reward_xp int not null default 0,badge_reward text,starts_at timestamptz not null,ends_at timestamptz not null,is_active boolean not null default true,created_at timestamptz not null default now()
);
create table if not exists public.event_participants (
 event_id uuid not null references public.special_events(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 progress_value numeric not null default 0,status text not null default 'joined',joined_at timestamptz not null default now(),completed_at timestamptz,primary key(event_id,user_id)
);
create table if not exists public.run_objectives (
 id uuid primary key default gen_random_uuid(),run_id uuid not null references public.runs(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 source_type text not null check(source_type in ('main','daily','weekly','event')),source_id uuid not null,objective_type text not null,
 target jsonb not null,result jsonb not null default '{}',status text not null default 'pending',evaluated_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists public.quest_completions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,run_id uuid not null references public.runs(id) on delete cascade,
 source_type text not null check(source_type in ('main','daily','weekly','event')),source_id uuid not null,xp_awarded int not null default 0,badge_awarded text,
 completed_at timestamptz not null default now(),unique(user_id,source_type,source_id)
);
create index if not exists main_quests_world_order_idx on public.quests(world_id,journey_order) where is_main_quest;
create index if not exists daily_quests_user_date_idx on public.user_daily_quests(user_id,assignment_date desc);
create index if not exists weekly_challenges_user_week_idx on public.weekly_challenges(user_id,week_start desc);
create index if not exists active_events_time_idx on public.special_events(starts_at,ends_at) where is_active;
create index if not exists run_objectives_run_idx on public.run_objectives(run_id,status);
create index if not exists quest_completions_user_time_idx on public.quest_completions(user_id,completed_at desc);

do $$ declare t text; begin foreach t in array array['user_main_progress','user_daily_quests','weekly_challenges','special_events','event_participants','run_objectives','quest_completions'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy "public active events" on public.special_events for select using(is_active and ends_at>now());
create policy "own main progress" on public.user_main_progress for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own daily quests" on public.user_daily_quests for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own weekly challenges" on public.weekly_challenges for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own event participation" on public.event_participants for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own objective results" on public.run_objectives for select using(user_id=auth.uid());
create policy "own completions" on public.quest_completions for select using(user_id=auth.uid());

-- Extend the existing deterministic template catalog from 8 to 32 reusable templates.
with template_seed(template_id,title,quest_type,difficulty,min_level,distance_min,distance_max,xp_base,is_social,checkpoint_min,checkpoint_max,duration_min,duration_max,goal_tags,cooldown_days,pace_pressure) as (values
 ('distance_variant_1','RIVER DISTANCE 1','distance',3,1,1,7,300,false,0,1,20,80,array['health','consistency'],3,'none'),
 ('checkpoint_variant_1','CHECKPOINT DASH 1','checkpoint',3,1,1,7,305,false,1,4,20,80,array['exploration','fun'],4,'light'),
 ('exploration_variant_1','NEW STREET 1','exploration',3,1,1,7,310,false,1,4,20,80,array['exploration','fun'],5,'none'),
 ('social_variant_1','RUNNER RENDEZVOUS 1','social',3,1,1,7,315,true,0,1,20,80,array['social','fun'],6,'light'),
 ('speed_variant_1','TEMPO WINDOW 1','speed',3,1,1,7,320,false,0,1,20,80,array['speed','competition'],7,'target'),
 ('consistency_variant_1','KEEP GOING 1','consistency',3,1,1,7,325,false,0,1,20,80,array['consistency','health'],3,'none'),
 ('mystery_variant_1','MYSTERY PATH 1','mystery',3,1,1,7,330,false,1,4,20,80,array['exploration','fun'],4,'none'),
 ('weekend_variant_1','WEEKEND MILES 1','weekend',3,1,1,7,335,true,0,1,20,80,array['health','fun','social'],5,'none'),
 ('distance_variant_2','RIVER DISTANCE 2','distance',4,6,2,10,420,false,0,2,25,100,array['health','consistency'],6,'none'),
 ('checkpoint_variant_2','CHECKPOINT DASH 2','checkpoint',4,6,2,10,425,false,2,5,25,100,array['exploration','fun'],7,'light'),
 ('exploration_variant_2','NEW STREET 2','exploration',4,6,2,10,430,false,2,5,25,100,array['exploration','fun'],3,'none'),
 ('social_variant_2','RUNNER RENDEZVOUS 2','social',4,6,2,10,435,true,0,2,25,100,array['social','fun'],4,'light'),
 ('speed_variant_2','TEMPO WINDOW 2','speed',4,6,2,10,440,false,0,2,25,100,array['speed','competition'],5,'target'),
 ('consistency_variant_2','KEEP GOING 2','consistency',4,6,2,10,445,false,0,2,25,100,array['consistency','health'],6,'none'),
 ('mystery_variant_2','MYSTERY PATH 2','mystery',4,6,2,10,450,false,2,5,25,100,array['exploration','fun'],7,'none'),
 ('weekend_variant_2','WEEKEND MILES 2','weekend',4,6,2,10,455,true,0,2,25,100,array['health','fun','social'],3,'none'),
 ('distance_variant_3','RIVER DISTANCE 3','distance',5,9,3,13,540,false,0,3,30,120,array['health','consistency'],4,'none'),
 ('checkpoint_variant_3','CHECKPOINT DASH 3','checkpoint',5,9,3,13,545,false,3,6,30,120,array['exploration','fun'],5,'light'),
 ('exploration_variant_3','NEW STREET 3','exploration',5,9,3,13,550,false,3,6,30,120,array['exploration','fun'],6,'none'),
 ('social_variant_3','RUNNER RENDEZVOUS 3','social',5,9,3,13,555,true,0,3,30,120,array['social','fun'],7,'light'),
 ('speed_variant_3','TEMPO WINDOW 3','speed',5,9,3,13,560,false,0,3,30,120,array['speed','competition'],3,'target'),
 ('consistency_variant_3','KEEP GOING 3','consistency',5,9,3,13,565,false,0,3,30,120,array['consistency','health'],4,'none'),
 ('mystery_variant_3','MYSTERY PATH 3','mystery',5,9,3,13,570,false,3,6,30,120,array['exploration','fun'],5,'none'),
 ('weekend_variant_3','WEEKEND MILES 3','weekend',5,9,3,13,575,true,0,3,30,120,array['health','fun','social'],6,'none')
)
insert into public.quest_templates(template_id,title_variants,quest_type,difficulty,min_level,distance_min_km,distance_max_km,xp_base,is_social,is_community,checkpoint_min,checkpoint_max,duration_min_minutes,duration_max_minutes,goal_tags,preferred_times,cooldown_days,pace_pressure)
select template_id,array[title],quest_type,difficulty,min_level,distance_min,distance_max,xp_base,is_social,false,checkpoint_min,checkpoint_max,duration_min,duration_max,goal_tags,array[]::text[],cooldown_days,pace_pressure from template_seed
on conflict(template_id) do update set title_variants=excluded.title_variants,difficulty=excluded.difficulty,updated_at=now();

insert into public.worlds(slug,name,number,description,color,unlock_level) values
 ('first-steps','FIRST STEPS',1,'Build movement and consistency','#b6ff22',1),
 ('city-explorer','CITY EXPLORER',2,'Explore the real city','#7439ee',1),
 ('run-together','RUN TOGETHER',3,'Build your running party','#59e0dc',1),
 ('push-your-limit','PUSH YOUR LIMIT',4,'Improve with adaptive targets','#ff7658',1),
 ('city-legend','CITY LEGEND',5,'Complete the final chapter','#ffd43b',1)
on conflict(number) do update set name=excluded.name,description=excluded.description,color=excluded.color;

with main_seed(world_number,quest_order,slug,name,distance_km,quest_type,difficulty,xp_reward,is_boss,badge) as (values
 (1,1,'main-world-1-q1','FIRST STEP',1,'distance',1,100,false,null),(1,2,'main-world-1-q2','KEEP MOVING',2,'distance',1,180,false,null),(1,3,'main-world-1-q3','THREE K FLOW',3,'distance',2,250,false,null),(1,4,'main-world-1-q4','FIRST CHECKPOINT',2,'checkpoint',2,300,false,null),(1,5,'main-world-1-q5','RUN TOGETHER',2,'social',2,350,false,null),(1,6,'main-world-1-q6','FIRST 5K',5,'boss',3,800,true,'FIRST STEPS'),
 (2,1,'main-world-2-q1','NEW TERRITORY',3,'exploration',2,300,false,null),(2,2,'main-world-2-q2','CHECKPOINT HUNTER',3,'checkpoint',2,380,false,null),(2,3,'main-world-2-q3','CITY DISCOVERY',4,'exploration',3,450,false,null),(2,4,'main-world-2-q4','MYSTERY DROP',4,'mystery',3,520,false,null),(2,5,'main-world-2-q5','EXPLORER RUN',5,'exploration',3,600,false,null),(2,6,'main-world-2-q6','CITY QUEST',7,'boss',4,1200,true,'CITY EXPLORER'),
 (3,1,'main-world-3-q1','FIND A RUNNER',2,'social',2,350,false,null),(3,2,'main-world-3-q2','FIRST PARTY',3,'party',3,450,false,null),(3,3,'main-world-3-q3','PACE PARTNER',4,'social',3,520,false,null),(3,4,'main-world-3-q4','TEAM CHECKPOINT',4,'party',3,600,false,null),(3,5,'main-world-3-q5','SOCIAL EXPLORER',5,'exploration',4,700,false,null),(3,6,'main-world-3-q6','TEAM RUN',6,'boss',4,1400,true,'TEAM PLAYER'),
 (4,1,'main-world-4-q1','DISTANCE PUSH',5,'distance',3,600,false,null),(4,2,'main-world-4-q2','PACE ATTACK',4,'pace',4,700,false,null),(4,3,'main-world-4-q3','CHECKPOINT RUSH',5,'checkpoint',4,780,false,null),(4,4,'main-world-4-q4','CONSISTENCY CHAIN',4,'streak',4,800,false,null),(4,5,'main-world-4-q5','LONGER ROAD',7,'distance',4,900,false,null),(4,6,'main-world-4-q6','LIMIT BREAKER',8,'boss',5,1800,true,'LIMIT BREAKER'),
 (5,1,'main-world-5-q1','LEGEND DISTANCE',8,'distance',4,900,false,null),(5,2,'main-world-5-q2','LEGEND EXPLORER',6,'exploration',4,950,false,null),(5,3,'main-world-5-q3','LEGEND CHECKPOINTS',7,'checkpoint',5,1000,false,null),(5,4,'main-world-5-q4','LEGEND PARTY',6,'party',5,1100,false,null),(5,5,'main-world-5-q5','LEGEND CONSISTENCY',7,'streak',5,1200,false,null),(5,6,'main-world-5-q6','CITY LEGEND',10,'boss',5,3000,true,'CITY LEGEND')
)
insert into public.quests(world_id,slug,name,quest_type,description,distance_km,difficulty,xp_reward,badge_reward,requirements,is_active,is_demo,journey_order,is_main_quest,is_boss)
select w.id,s.slug,s.name,s.quest_type,case when s.is_boss then 'Defeat the World Boss to unlock the next chapter.' else 'Complete this permanent Main Journey objective.' end,s.distance_km,s.difficulty,s.xp_reward,s.badge,jsonb_build_object('objectiveType',s.quest_type),true,false,s.quest_order,true,s.is_boss
from main_seed s join public.worlds w on w.number=s.world_number
on conflict(slug) do update set world_id=excluded.world_id,name=excluded.name,quest_type=excluded.quest_type,description=excluded.description,distance_km=excluded.distance_km,difficulty=excluded.difficulty,xp_reward=excluded.xp_reward,badge_reward=excluded.badge_reward,requirements=excluded.requirements,journey_order=excluded.journey_order,is_main_quest=true,is_boss=excluded.is_boss;
