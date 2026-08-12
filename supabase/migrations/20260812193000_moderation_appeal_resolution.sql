create or replace function public.resolve_moderation_appeal(
  target_appeal_id uuid,
  appeal_decision text,
  internal_note_value text,
  member_update_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  appeal public.moderation_appeals;
  restriction public.account_restrictions;
  staff_role text;
begin
  select role into staff_role
  from public.moderation_roles
  where profile_id = auth.uid();
  if staff_role not in ('moderator','admin') then
    raise exception 'moderator authorization required';
  end if;
  if appeal_decision not in ('upheld','granted') then
    raise exception 'invalid appeal decision';
  end if;
  if char_length(trim(internal_note_value)) < 5 then
    raise exception 'internal rationale required';
  end if;
  if char_length(trim(member_update_value)) < 5 then
    raise exception 'member-facing explanation required';
  end if;
  select * into appeal
  from public.moderation_appeals
  where id = target_appeal_id and status in ('submitted','reviewing')
  for update;
  if appeal.id is null then raise exception 'open appeal unavailable'; end if;
  select * into restriction
  from public.account_restrictions
  where id = appeal.restriction_id
  for update;
  update public.moderation_appeals
  set status = appeal_decision,
      resolution = trim(member_update_value),
      reviewed_by = auth.uid(),
      resolved_at = now()
  where id = appeal.id;
  if appeal_decision = 'granted' and restriction.lifted_at is null then
    update public.account_restrictions
    set lifted_at = now(), lifted_by = auth.uid()
    where id = restriction.id;
    insert into public.moderation_actions(
      report_id, actor_id, action, internal_note, reporter_update, snapshot
    ) values (
      restriction.report_id,
      auth.uid(),
      'restriction_lifted',
      trim(internal_note_value),
      trim(member_update_value),
      jsonb_build_object('appeal_id', appeal.id, 'restriction_id', restriction.id)
    );
  else
    insert into public.moderation_actions(
      report_id, actor_id, action, internal_note, reporter_update, snapshot
    ) values (
      restriction.report_id,
      auth.uid(),
      'note',
      trim(internal_note_value),
      trim(member_update_value),
      jsonb_build_object('appeal_id', appeal.id, 'decision', appeal_decision)
    );
  end if;
  perform public.notify_user(
    appeal.profile_id,
    'safety',
    'Appeal decision',
    trim(member_update_value)
  );
end;
$$;

revoke all on function public.resolve_moderation_appeal(uuid,text,text,text) from public;
grant execute on function public.resolve_moderation_appeal(uuid,text,text,text) to authenticated;
