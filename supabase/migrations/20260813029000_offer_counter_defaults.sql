alter table public.trade_offers alter column last_proposed_by set default auth.uid();

update public.trade_offers set last_proposed_by=provider_id where last_proposed_by is null;

alter table public.trade_offers alter column last_proposed_by set not null;
