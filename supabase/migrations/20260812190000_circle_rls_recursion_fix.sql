create or replace function public.is_active_circle_member(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members
    where circle_id = target_circle_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

revoke all on function public.is_active_circle_member(uuid) from public;
grant execute on function public.is_active_circle_member(uuid) to authenticated;

drop policy if exists "circle membership scoped read" on public.circle_members;
create policy "circle membership scoped read"
on public.circle_members
for select
using (
  profile_id = auth.uid()
  or public.is_active_circle_member(circle_id)
);

drop policy if exists "visible circles readable" on public.circles;
create policy "visible circles readable"
on public.circles
for select
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or public.is_active_circle_member(id)
);

drop policy if exists "active members read circle resources" on public.circle_resources;
create policy "active members read circle resources"
on public.circle_resources
for select
using (public.is_active_circle_member(circle_id));

drop policy if exists "visible requests readable" on public.work_requests;
create policy "visible requests readable"
on public.work_requests
for select
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or (
    visibility = 'circle'
    and public.is_active_circle_member(circle_id)
  )
);

drop policy if exists "request skills readable" on public.work_request_skills;
create policy "request skills readable"
on public.work_request_skills
for select
using (
  exists (
    select 1
    from public.work_requests request
    where request.id = request_id
      and (
        request.visibility = 'public'
        or request.owner_id = auth.uid()
        or (
          request.visibility = 'circle'
          and public.is_active_circle_member(request.circle_id)
        )
      )
  )
);
