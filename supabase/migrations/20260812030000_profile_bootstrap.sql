create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant select on public.profiles, public.capabilities, public.work_requests, public.work_request_skills to anon, authenticated;
grant select, insert, update, delete on public.capabilities to authenticated;
grant select, insert, update on public.trade_offers to authenticated;
grant select on public.work_agreements, public.milestones, public.dependency_holds, public.project_updates, public.work_evidence, public.project_messages, public.follows, public.blocks, public.circles, public.circle_members, public.skill_endorsements, public.trade_chains, public.trade_chain_links, public.agreement_obligations, public.agreement_history to authenticated;
grant insert on public.project_updates, public.project_messages, public.follows, public.blocks, public.safety_reports, public.circle_members, public.skill_endorsements to authenticated;
grant update, delete on public.follows, public.blocks, public.circle_members to authenticated;
