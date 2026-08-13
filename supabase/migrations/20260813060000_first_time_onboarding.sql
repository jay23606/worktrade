alter table public.profiles
add column onboarding_completed_at timestamptz,
add column onboarding_skipped_at timestamptz,
add column first_goal text check(first_goal in ('find_help','offer_help','post_work'));

create or replace function public.record_onboarding_state(first_goal_value text default null,state_value text default 'complete')
returns public.profiles language plpgsql security definer set search_path=public as $$
declare result public.profiles;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if first_goal_value is not null and first_goal_value not in ('find_help','offer_help','post_work') then raise exception 'invalid first goal'; end if;
 if state_value not in ('complete','skipped') then raise exception 'invalid onboarding state'; end if;
 update public.profiles set first_goal=coalesce(first_goal_value,first_goal),
  onboarding_completed_at=case when state_value='complete' then now() else onboarding_completed_at end,
  onboarding_skipped_at=case when state_value='skipped' then now() else onboarding_skipped_at end
 where id=auth.uid() returning * into result;
 return result;
end$$;
revoke all on function public.record_onboarding_state(text,text) from public;
grant execute on function public.record_onboarding_state(text,text) to authenticated;
