create or replace function public.notify_agreement_history()
returns trigger language plpgsql security definer set search_path=public
as $$
declare recipient uuid; target_request uuid; event_title text;
begin
  select case when new.actor_id=a.requester_id then a.provider_id else a.requester_id end,a.request_id
  into recipient,target_request from public.work_agreements a where a.id=new.agreement_id;
  event_title:=case
    when new.note ilike '%milestone%' then 'Milestone updated'
    when new.note ilike '%hold%' then 'Dependency updated'
    when new.note ilike '%obligation%' then 'Exchange obligation updated'
    when new.to_status='proposed' then 'Agreement terms proposed'
    when new.to_status='agreed' then 'Agreement confirmed'
    when new.to_status='review' then 'Work submitted for review'
    when new.to_status='completed' then 'Agreement completed'
    when new.to_status='disputed' then 'Concern raised on agreement'
    when new.to_status='cancelled' then 'Agreement cancelled'
    else 'Agreement updated' end;
  perform public.notify_user(recipient,'agreement',event_title,coalesce(new.note,'A participant updated your work agreement.'),target_request,new.agreement_id);
  return new;
end $$;
create trigger agreement_history_notification after insert on public.agreement_history for each row execute function public.notify_agreement_history();

create or replace function public.record_request_creation()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
  insert into public.request_history(request_id,actor_id,action,snapshot) values(new.id,new.owner_id,'created',to_jsonb(new));
  return new;
end $$;
create trigger request_creation_history after insert on public.work_requests for each row execute function public.record_request_creation();
