do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='collaboration_invitations') then
  alter publication supabase_realtime add table public.collaboration_invitations;
 end if;
end$$;

-- Two people messaging each other is mutual consent, so collapse crossed pending
-- requests into one open conversation instead of showing duplicate threads.
with crossed as (
 select newer.id as remove_id,older.id as keep_id,newer.sender_id,newer.note
 from public.collaboration_invitations older
 join public.collaboration_invitations newer on newer.sender_id=older.recipient_id and newer.recipient_id=older.sender_id and newer.status='pending'
 where older.status='pending' and older.created_at<newer.created_at
), opened as (
 update public.collaboration_invitations i set status='accepted',responded_at=now()
 from crossed x where i.id=x.keep_id returning i.id
), replies as (
 insert into public.introduction_messages(invitation_id,author_id,body)
 select x.keep_id,x.sender_id,x.note from crossed x where nullif(trim(x.note),'') is not null
 returning id
)
delete from public.collaboration_invitations i using crossed x where i.id=x.remove_id;

create or replace function public.send_contact_request(target_profile_id uuid,message_body text,target_request_id uuid default null,contact_kind text default 'message') returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;request_title text;reverse_item public.collaboration_invitations;same_item public.collaboration_invitations;
begin
 if auth.uid() is null or target_profile_id=auth.uid() then raise exception 'valid signed-in recipient required';end if;
 if contact_kind not in('message','question') then raise exception 'invalid contact kind';end if;
 if char_length(trim(message_body)) not between 2 and 1000 then raise exception 'write a short message';end if;
 if exists(select 1 from public.blocks where(blocker_id=target_profile_id and blocked_id=auth.uid())or(blocker_id=auth.uid()and blocked_id=target_profile_id))then raise exception 'interaction unavailable';end if;
 if target_request_id is not null then select title into request_title from public.work_requests where id=target_request_id and owner_id=target_profile_id and stage='open';if request_title is null then raise exception 'open request recipient required';end if;end if;

 select * into reverse_item from public.collaboration_invitations where sender_id=target_profile_id and recipient_id=auth.uid() and status='pending' order by created_at desc limit 1 for update;
 if reverse_item.id is not null then
  update public.collaboration_invitations set status='accepted',responded_at=now() where id=reverse_item.id;
  insert into public.introduction_messages(invitation_id,author_id,body)values(reverse_item.id,auth.uid(),trim(message_body));
  perform public.notify_user(target_profile_id,'network','Conversation opened',(select display_name from public.profiles where id=auth.uid())||' replied to your message request.');
  return reverse_item.id;
 end if;

 select * into same_item from public.collaboration_invitations where sender_id=auth.uid() and recipient_id=target_profile_id and status='pending' order by created_at desc limit 1 for update;
 if same_item.id is not null then
  update public.collaboration_invitations set note=trim(message_body),invitation_kind=contact_kind,request_id=target_request_id where id=same_item.id;
  return same_item.id;
 end if;

 insert into public.collaboration_invitations(sender_id,recipient_id,request_id,need_text,offer_text,note,invitation_kind)
 values(auth.uid(),target_profile_id,target_request_id,case when target_request_id is null then'Start a conversation'else'Question about '||left(request_title,480)end,'Discuss after connecting',trim(message_body),contact_kind)returning id into new_id;
 perform public.notify_user(target_profile_id,'network',case when contact_kind='question'then'New question about your work'else'New message request'end,(select display_name from public.profiles where id=auth.uid())||' would like to start a conversation.',target_request_id,null);
 return new_id;
end$$;
revoke all on function public.send_contact_request(uuid,text,uuid,text) from public,anon;
grant execute on function public.send_contact_request(uuid,text,uuid,text) to authenticated;
