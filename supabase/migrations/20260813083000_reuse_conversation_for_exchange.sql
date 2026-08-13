create or replace function public.send_contact_request(target_profile_id uuid,message_body text,target_request_id uuid default null,contact_kind text default 'message') returns uuid language plpgsql security definer set search_path=public as $$
declare item public.collaboration_invitations;request_title text;
begin
 if auth.uid() is null or target_profile_id=auth.uid()then raise exception 'valid signed-in recipient required';end if;
 if contact_kind not in('message','question')then raise exception 'invalid contact kind';end if;
 if char_length(trim(message_body))not between 2 and 1000 then raise exception 'write a short message';end if;
 if exists(select 1 from public.blocks where(blocker_id=target_profile_id and blocked_id=auth.uid())or(blocker_id=auth.uid()and blocked_id=target_profile_id))then raise exception 'interaction unavailable';end if;
 if target_request_id is not null then select title into request_title from public.work_requests where id=target_request_id and owner_id=target_profile_id and stage='open';if request_title is null then raise exception 'open request recipient required';end if;end if;
 select * into item from public.collaboration_invitations where conversation_pair=least(auth.uid()::text,target_profile_id::text)||':'||greatest(auth.uid()::text,target_profile_id::text)and status in('pending','accepted','converted')for update;
 if item.id is not null then
  if item.status in('accepted','converted')then insert into public.introduction_messages(invitation_id,author_id,body)values(item.id,auth.uid(),trim(message_body));
  elsif item.sender_id=auth.uid()then update public.collaboration_invitations set note=trim(message_body),request_id=coalesce(target_request_id,request_id)where id=item.id;
  else update public.collaboration_invitations set status='accepted',responded_at=now()where id=item.id;insert into public.introduction_messages(invitation_id,author_id,body)values(item.id,auth.uid(),trim(message_body));
  end if;
  perform public.notify_user(target_profile_id,'network',case when item.status='pending'then'Conversation updated'else'New message'end,(select display_name from public.profiles where id=auth.uid())||' sent you a message.',target_request_id,null);
  return item.id;
 end if;
 insert into public.collaboration_invitations(sender_id,recipient_id,request_id,need_text,offer_text,note,invitation_kind)values(auth.uid(),target_profile_id,target_request_id,case when target_request_id is null then'Start a conversation'else'Question about '||left(request_title,480)end,'Discuss after connecting',trim(message_body),contact_kind)returning * into item;
 perform public.notify_user(target_profile_id,'network',case when contact_kind='question'then'New question about your work'else'New message request'end,(select display_name from public.profiles where id=auth.uid())||' would like to start a conversation.',target_request_id,null);
 return item.id;
end$$;

create or replace function public.send_collaboration_invitation(target_profile_id uuid,need_value text,offer_value text,note_value text,target_request_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare item public.collaboration_invitations;
begin
 if auth.uid() is null or target_profile_id=auth.uid()then raise exception 'valid recipient required';end if;
 if char_length(trim(need_value))not between 2 and 500 or char_length(trim(offer_value))not between 2 and 500 then raise exception 'need and offer are required';end if;
 if exists(select 1 from public.blocks where(blocker_id=target_profile_id and blocked_id=auth.uid())or(blocker_id=auth.uid()and blocked_id=target_profile_id))then raise exception 'interaction unavailable';end if;
 select * into item from public.collaboration_invitations where conversation_pair=least(auth.uid()::text,target_profile_id::text)||':'||greatest(auth.uid()::text,target_profile_id::text)and status in('pending','accepted','converted')for update;
 if item.id is not null then
  if item.status='pending'and item.sender_id<>auth.uid()then update public.collaboration_invitations set status='accepted',responded_at=now()where id=item.id;end if;
  update public.collaboration_invitations set need_text=trim(need_value),offer_text=trim(offer_value),invitation_kind='exchange',request_id=coalesce(target_request_id,request_id)where id=item.id;
  if item.status in('accepted','converted')or item.sender_id<>auth.uid()then insert into public.introduction_messages(invitation_id,author_id,body)values(item.id,auth.uid(),coalesce(nullif(trim(note_value),''),'Proposed an exchange: '||trim(need_value)||' ↔ '||trim(offer_value)));end if;
  perform public.notify_user(target_profile_id,'network','Exchange proposed',(select display_name from public.profiles where id=auth.uid())||' added exchange terms to your conversation.',target_request_id,null);
  return item.id;
 end if;
 insert into public.collaboration_invitations(sender_id,recipient_id,request_id,need_text,offer_text,note,invitation_kind)values(auth.uid(),target_profile_id,target_request_id,trim(need_value),trim(offer_value),nullif(trim(note_value),''),'exchange')returning * into item;
 perform public.notify_user(target_profile_id,'network','New collaboration invitation',(select display_name from public.profiles where id=auth.uid())||' proposed a possible exchange.',target_request_id,null);
 return item.id;
end$$;
revoke all on function public.send_contact_request(uuid,text,uuid,text),public.send_collaboration_invitation(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.send_contact_request(uuid,text,uuid,text),public.send_collaboration_invitation(uuid,text,text,text,uuid) to authenticated;
