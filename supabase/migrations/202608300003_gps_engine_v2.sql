alter table public.runs add column if not exists moving_seconds int check(moving_seconds is null or moving_seconds>=0);
create index if not exists run_points_created_at_idx on public.run_points(created_at);

create or replace function public.save_completed_gps_run_v2(
  p_run_id uuid,
  p_quest_key text,
  p_elapsed_seconds int,
  p_moving_seconds int,
  p_reported_distance_km numeric,
  p_checkpoint_count int,
  p_points jsonb,
  p_xp int default 0
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); point jsonb; previous jsonb; point_count int:=0;
  calculated_km double precision:=0; segment_km double precision; segment_seconds double precision; segment_speed double precision;
  lat1 double precision; lat2 double precision; lon1 double precision; lon2 double precision;
  accuracy_sum numeric:=0; trust int:=100; verified boolean; pace numeric; jump_count int:=0; gap_count int:=0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_points is null or jsonb_typeof(p_points)<>'array' then raise exception 'GPS points must be an array'; end if;
  if p_elapsed_seconds<0 or p_elapsed_seconds>86400 then raise exception 'Invalid elapsed time'; end if;
  if p_moving_seconds<0 or p_moving_seconds>p_elapsed_seconds then raise exception 'Invalid moving time'; end if;
  if jsonb_array_length(p_points)>1000 then raise exception 'Too many GPS points'; end if;

  for point in select value from jsonb_array_elements(p_points) loop
    point_count:=point_count+1;
    accuracy_sum:=accuracy_sum+coalesce((point->>'accuracy')::numeric,0);
    if previous is not null then
      segment_seconds:=((point->>'timestamp')::double precision-(previous->>'timestamp')::double precision)/1000;
      lat1:=radians((previous->>'lat')::double precision);lat2:=radians((point->>'lat')::double precision);
      lon1:=radians((previous->>'lng')::double precision);lon2:=radians((point->>'lng')::double precision);
      segment_km:=6371*2*asin(sqrt(power(sin((lat2-lat1)/2),2)+cos(lat1)*cos(lat2)*power(sin((lon2-lon1)/2),2)));
      if segment_seconds<=0 then
        trust:=trust-10;
      elsif segment_seconds>30 then
        gap_count:=gap_count+1;
      else
        segment_speed:=segment_km*1000/segment_seconds;
        if segment_speed<=12 then calculated_km:=calculated_km+segment_km;else jump_count:=jump_count+1;trust:=trust-20;end if;
      end if;
    end if;
    previous:=point;
  end loop;

  if point_count<3 then trust:=trust-40;end if;
  if calculated_km<0.03 then trust:=trust-20;end if;
  if point_count>0 and accuracy_sum/point_count>35 then trust:=trust-15;end if;
  if gap_count>0 then trust:=trust-least(24,gap_count*8);end if;
  if abs(calculated_km-coalesce(p_reported_distance_km,0))>greatest(0.10,calculated_km*0.25) then trust:=trust-30;end if;
  if p_moving_seconds>0 and calculated_km*1000/p_moving_seconds>12 then trust:=trust-50;end if;
  trust:=greatest(0,least(100,trust));verified:=trust>=75;
  pace:=case when calculated_km>0.01 and p_moving_seconds>0 then (p_moving_seconds/60.0)/calculated_km else null end;

  insert into public.runs(id,user_id,status,started_at,ended_at,distance_km,elapsed_seconds,moving_seconds,average_pace,checkpoint_count)
  values(p_run_id,uid,'completed',now()-make_interval(secs=>p_elapsed_seconds),now(),round(calculated_km::numeric,3),p_elapsed_seconds,p_moving_seconds,pace,greatest(0,p_checkpoint_count));

  insert into public.run_points(run_id,user_id,captured_at,latitude,longitude,accuracy_meters,speed_mps)
  select p_run_id,uid,to_timestamp(((value->>'timestamp')::double precision)/1000),(value->>'lat')::double precision,(value->>'lng')::double precision,nullif(value->>'accuracy','')::numeric,nullif(value->>'speed','')::numeric
  from jsonb_array_elements(p_points);

  insert into public.run_verification(run_id,trust_score,status,flags,stats)
  values(p_run_id,trust,case when verified then 'verified' else 'unverified' end,
    jsonb_build_array()||(case when jump_count>0 then jsonb_build_array(jump_count||' impossible GPS jumps') else '[]'::jsonb end)||(case when gap_count>0 then jsonb_build_array(gap_count||' missing GPS segments') else '[]'::jsonb end),
    jsonb_build_object('engine','gps-v2','questKey',p_quest_key,'distanceKm',round(calculated_km::numeric,3),'pointCount',point_count,'movingSeconds',p_moving_seconds,'jumpCount',jump_count,'gapCount',gap_count));

  if verified and p_xp>0 then
    insert into public.xp_transactions(user_id,run_id,amount,reason) values(uid,p_run_id,least(p_xp,5000),'verified_run');
    update public.profiles set total_xp=total_xp+least(p_xp,5000),level=least(100,greatest(level,floor((total_xp+least(p_xp,5000))/500.0)::int+1)) where id=uid;
  end if;

  delete from public.run_points where created_at<now()-interval '30 days';
  return jsonb_build_object('runId',p_run_id,'distanceKm',round(calculated_km::numeric,3),'movingSeconds',p_moving_seconds,'trustScore',trust,'verified',verified,'storedPoints',point_count);
end $$;

revoke all on function public.save_completed_gps_run_v2(uuid,text,int,int,numeric,int,jsonb,int) from public;
grant execute on function public.save_completed_gps_run_v2(uuid,text,int,int,numeric,int,jsonb,int) to authenticated;
