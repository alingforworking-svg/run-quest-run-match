-- Public matching exposes only non-sensitive runner preferences for visible profiles.
create policy "visible runner preferences" on public.runner_preferences for select
using(exists(select 1 from public.profiles p where p.id=user_id and (p.id=auth.uid() or not p.is_private)));

create or replace function public.is_party_participant(target_party uuid,target_user uuid)
returns boolean language sql stable security definer set search_path=public
as $$select exists(select 1 from public.party_members where party_id=target_party and user_id=target_user)$$;
revoke all on function public.is_party_participant(uuid,uuid) from public;
grant execute on function public.is_party_participant(uuid,uuid) to authenticated;

create policy "party participants view party" on public.parties for select
using(owner_id=auth.uid() or public.is_party_participant(id,auth.uid()));

-- Every accepted/invited party participant may see the party roster.
create policy "party participants view roster" on public.party_members for select
using(public.is_party_participant(party_id,auth.uid()));
