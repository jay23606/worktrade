create or replace function public.convert_introduction_to_request(target_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  i public.collaboration_invitations;
  w public.introduction_workspaces;
  new_id uuid;
begin
  select * into i from public.collaboration_invitations where id=target_invitation_id for update;
  select * into w from public.introduction_workspaces where invitation_id=i.id;
  if i.status is distinct from 'accepted'
    or auth.uid() not in(i.sender_id,i.recipient_id)
    or w.sender_confirmed_version is distinct from w.version
    or w.recipient_confirmed_version is distinct from w.version then
    raise exception 'both participants must confirm current terms';
  end if;
  insert into public.work_requests(owner_id,title,description,kind,stage,visibility,exchange_modes,exchange_summary,constraints,location_visibility)
  values(auth.uid(),left('Collaboration: '||coalesce(nullif(w.scope,''),i.need_text),140),coalesce(nullif(w.scope,''),i.need_text),'other','draft','private',array['barter'::public.exchange_mode,'hybrid'::public.exchange_mode],w.exchange_terms,concat_ws(E'\n',nullif(w.materials,''),nullif(w.exclusions,'')),'participants')
  returning id into new_id;
  update public.collaboration_invitations set status='converted',converted_request_id=new_id where id=i.id;
  perform public.notify_user(case when auth.uid()=i.sender_id then i.recipient_id else i.sender_id end,'network','Collaboration moved to work','A mutually confirmed introduction was converted into a private draft.',new_id,null);
  return new_id;
end$$;

revoke all on function public.convert_introduction_to_request(uuid) from public;
grant execute on function public.convert_introduction_to_request(uuid) to authenticated;
