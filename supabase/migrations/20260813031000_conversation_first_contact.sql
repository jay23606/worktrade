alter table public.collaboration_invitations
  add column if not exists invitation_kind text not null default 'exchange'
  check(invitation_kind in('message','question','exchange'));

create or replace function public.send_contact_request(target_profile_id uuid,message_body text,target_request_id uuid default null,contact_kind text default 'message') returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; request_title text;
begin
  if auth.uid() is null or target_profile_id=auth.uid() then raise exception 'valid signed-in recipient required';end if;
  if contact_kind not in('message','question') then raise exception 'invalid contact kind';end if;
  if char_length(trim(message_body)) not between 2 and 1000 then raise exception 'write a short message';end if;
  if exists(select 1 from public.blocks where (blocker_id=target_profile_id and blocked_id=auth.uid()) or (blocker_id=auth.uid() and blocked_id=target_profile_id)) then raise exception 'interaction unavailable';end if;
  if target_request_id is not null then select title into request_title from public.work_requests where id=target_request_id and owner_id=target_profile_id and stage='open';if request_title is null then raise exception 'open request recipient required';end if;end if;
  insert into public.collaboration_invitations(sender_id,recipient_id,request_id,need_text,offer_text,note,invitation_kind)
  values(auth.uid(),target_profile_id,target_request_id,case when target_request_id is null then 'Start a conversation' else 'Question about '||left(request_title,480) end,'Discuss after connecting',trim(message_body),contact_kind) returning id into new_id;
  perform public.notify_user(target_profile_id,'network',case when contact_kind='question' then 'New question about your work' else 'New message request' end,(select display_name from public.profiles where id=auth.uid())||' would like to start a conversation.',target_request_id,null);
  return new_id;
end$$;

revoke all on function public.send_contact_request(uuid,text,uuid,text) from public,anon;
grant execute on function public.send_contact_request(uuid,text,uuid,text) to authenticated;
