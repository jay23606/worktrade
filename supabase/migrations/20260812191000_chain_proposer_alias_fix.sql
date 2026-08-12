create or replace function public.create_trade_chain(
  target_circle_id uuid,
  chain_title text,
  chain_description text,
  execution_value text,
  links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  link_item jsonb;
  participant uuid;
begin
  if execution_value not in ('simultaneous', 'sequential', 'conditional') then
    raise exception 'invalid execution mode';
  end if;
  if not exists (
    select 1 from public.circle_members
    where circle_id = target_circle_id
      and profile_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'active circle membership required';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(links) as proposed_link(value)
    where (proposed_link.value->>'from_profile_id')::uuid = auth.uid()
  ) then
    raise exception 'the proposer must participate in the chain';
  end if;
  for participant in
    select distinct (proposed_link.value->>'from_profile_id')::uuid
    from jsonb_array_elements(links) as proposed_link(value)
  loop
    if not exists (
      select 1 from public.circle_members
      where circle_id = target_circle_id
        and profile_id = participant
        and status = 'active'
    ) then
      raise exception 'every participant must be active in the circle';
    end if;
  end loop;
  insert into public.trade_chains (
    proposed_by, circle_id, title, description, execution_mode, status
  ) values (
    auth.uid(), target_circle_id, trim(chain_title),
    coalesce(chain_description, ''), execution_value, 'proposed'
  ) returning id into new_id;
  for link_item in
    select proposed_link.value
    from jsonb_array_elements(links) as proposed_link(value)
  loop
    insert into public.trade_chain_links (
      chain_id, from_profile_id, to_profile_id, value_description,
      position, due_at, conditions
    ) values (
      new_id,
      (link_item->>'from_profile_id')::uuid,
      (link_item->>'to_profile_id')::uuid,
      trim(link_item->>'value_description'),
      coalesce((link_item->>'position')::int, 0),
      nullif(link_item->>'due_at', '')::timestamptz,
      coalesce(link_item->>'conditions', '')
    );
  end loop;
  perform public.validate_trade_chain(new_id);
  insert into public.trade_chain_history (
    chain_id, actor_id, event, note, snapshot
  ) values (
    new_id, auth.uid(), 'proposed', 'Chain proposed',
    jsonb_build_object('version', 1, 'links', links)
  );
  for participant in
    select distinct from_profile_id
    from public.trade_chain_links
    where chain_id = new_id
  loop
    if participant <> auth.uid() then
      perform public.notify_user(
        participant,
        'network',
        'New circle trade chain',
        trim(chain_title) || ' needs your review.'
      );
    end if;
  end loop;
  return new_id;
end;
$$;

revoke all on function public.create_trade_chain(uuid, text, text, text, jsonb)
from public;
grant execute on function public.create_trade_chain(uuid, text, text, text, jsonb)
to authenticated;
