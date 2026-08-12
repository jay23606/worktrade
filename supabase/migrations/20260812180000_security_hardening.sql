revoke all on function public.is_chain_participant(uuid,uuid) from public,anon;
grant execute on function public.is_chain_participant(uuid,uuid) to authenticated;
revoke all on function public.validate_trade_chain(uuid) from public,anon,authenticated;

-- Trigger helpers and internal notification dispatch must never be callable by clients.
revoke all on function public.notify_user(uuid,text,text,text,uuid,uuid) from public,anon,authenticated;

-- Direct writes stay behind security-definer workflows and RLS policies.
revoke insert,update,delete on public.trade_chains,public.trade_chain_links,public.trade_chain_acceptances,public.trade_chain_messages,public.trade_chain_history,public.trade_chain_holds,public.circle_resources from anon,authenticated;
