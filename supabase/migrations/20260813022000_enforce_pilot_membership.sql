create or replace function public.account_can_interact(target_profile_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select target_profile_id is not null
    and exists(select 1 from public.pilot_memberships where profile_id=target_profile_id and status='active')
    and not exists (
      select 1 from public.account_restrictions
      where profile_id=target_profile_id and lifted_at is null
        and (expires_at is null or expires_at > now())
    );
$$;
