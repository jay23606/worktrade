-- WorkTrade is open to authenticated accounts. Pilot tables remain for cohort
-- reporting and administration, but an invite is no longer an access gate.
insert into public.pilot_memberships(profile_id,status)
select id,'active' from public.profiles
on conflict(profile_id) do update set status='active';

create or replace function public.enroll_open_registration() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.pilot_memberships(profile_id,status) values(new.id,'active') on conflict(profile_id) do update set status='active';
  return new;
end$$;
drop trigger if exists enroll_open_registration on public.profiles;
create trigger enroll_open_registration after insert on public.profiles for each row execute function public.enroll_open_registration();

create or replace function public.account_can_interact(target_profile_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
  select target_profile_id is not null
    and exists(select 1 from public.profiles where id=target_profile_id and is_active)
    and not exists(select 1 from public.account_restrictions where profile_id=target_profile_id and lifted_at is null and(expires_at is null or expires_at>now()));
$$;

create or replace function public.get_pilot_access() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('member',auth.uid() is not null,'admin',exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin'));
$$;
