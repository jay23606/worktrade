create extension if not exists pgcrypto;

create type public.work_kind as enum ('build','repair','install','fabricate','restore','modify','maintain','inspect','diagnose','other');
create type public.work_stage as enum ('draft','open','proposed','agreed','scheduled','active','review','completed','cancelled','disputed');
create type public.exchange_mode as enum ('cash','barter','hybrid','community');
create type public.hold_kind as enum ('materials','equipment','weather','access_permission','customer_decision','specialist','third_party','custom');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  location_text text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.capabilities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('need','offer')),
  label text not null check (char_length(label) between 2 and 100),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  unique(profile_id, direction, label)
);

create table public.work_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 5 and 140),
  description text not null,
  kind public.work_kind not null,
  stage public.work_stage not null default 'draft',
  location_text text,
  urgency_text text,
  cash_budget_cents bigint check (cash_budget_cents is null or cash_budget_cents >= 0),
  visibility text not null default 'public' check (visibility in ('public','circle','private')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_request_skills (
  request_id uuid not null references public.work_requests(id) on delete cascade,
  skill text not null,
  primary key (request_id, skill)
);

create table public.exchange_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.work_requests(id) on delete cascade,
  offer_id uuid,
  side text not null check (side in ('requester','provider')),
  item_type text not null check (item_type in ('cash','labor','service','goods','materials','equipment_access','space','future_credit','other')),
  description text not null,
  agreed_value_cents bigint check (agreed_value_cents is null or agreed_value_cents >= 0)
);

create table public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id),
  mode public.exchange_mode not null,
  scope text not null,
  exchange_summary text not null,
  duration_text text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','expired')),
  created_at timestamptz not null default now(),
  unique(request_id, provider_id, status) deferrable initially immediate
);

alter table public.exchange_items add constraint exchange_items_offer_fk foreign key (offer_id) references public.trade_offers(id) on delete cascade;

create table public.work_agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.work_requests(id),
  accepted_offer_id uuid not null unique references public.trade_offers(id),
  requester_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  scope_snapshot text not null,
  exchange_snapshot jsonb not null,
  accepted_at timestamptz not null default now(),
  completed_at timestamptz,
  check (requester_id <> provider_id)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.work_agreements(id) on delete cascade,
  title text not null,
  position integer not null check (position >= 0),
  completed_at timestamptz,
  unique(agreement_id, position)
);

create table public.dependency_holds (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.work_agreements(id) on delete cascade,
  kind public.hold_kind not null,
  detail text not null,
  action_owner_id uuid references public.profiles(id),
  action_owner_text text,
  review_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_active_hold_per_agreement on public.dependency_holds(agreement_id) where resolved_at is null;

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  visibility text not null default 'public' check (visibility in ('public','participants','circle')),
  created_at timestamptz not null default now()
);

create table public.work_evidence (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.work_agreements(id) on delete cascade,
  contributor_id uuid not null references public.profiles(id),
  skill text not null,
  description text not null,
  asset_path text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.capabilities enable row level security;
alter table public.work_requests enable row level security;
alter table public.work_request_skills enable row level security;
alter table public.exchange_items enable row level security;
alter table public.trade_offers enable row level security;
alter table public.work_agreements enable row level security;
alter table public.milestones enable row level security;
alter table public.dependency_holds enable row level security;
alter table public.project_updates enable row level security;
alter table public.work_evidence enable row level security;

create policy "public profiles readable" on public.profiles for select using (true);
create policy "own profile writable" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "public capabilities readable" on public.capabilities for select using (true);
create policy "own capabilities writable" on public.capabilities for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "visible requests readable" on public.work_requests for select using (visibility = 'public' or owner_id = auth.uid());
create policy "own requests insertable" on public.work_requests for insert with check (owner_id = auth.uid());
create policy "own requests editable" on public.work_requests for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "request skills readable" on public.work_request_skills for select using (exists (select 1 from public.work_requests r where r.id = request_id and (r.visibility = 'public' or r.owner_id = auth.uid())));
create policy "owner manages request skills" on public.work_request_skills for all using (exists (select 1 from public.work_requests r where r.id = request_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.work_requests r where r.id = request_id and r.owner_id = auth.uid()));
create policy "offer participants read offers" on public.trade_offers for select using (provider_id = auth.uid() or exists (select 1 from public.work_requests r where r.id = request_id and r.owner_id = auth.uid()));
create policy "provider creates offer" on public.trade_offers for insert with check (provider_id = auth.uid() and exists (select 1 from public.work_requests r where r.id = request_id and r.owner_id <> auth.uid() and r.stage = 'open'));
create policy "provider updates pending offer" on public.trade_offers for update using (provider_id = auth.uid() and status = 'pending');
create policy "agreement participants read" on public.work_agreements for select using (requester_id = auth.uid() or provider_id = auth.uid());
create policy "public updates readable" on public.project_updates for select using (visibility = 'public' or author_id = auth.uid());
create policy "participants create updates" on public.project_updates for insert with check (author_id = auth.uid() and exists (select 1 from public.work_requests r left join public.work_agreements a on a.request_id = r.id where r.id = request_id and (r.owner_id = auth.uid() or a.provider_id = auth.uid())));
create policy "verified evidence readable" on public.work_evidence for select using (verified_at is not null or contributor_id = auth.uid() or verified_by = auth.uid());

-- Agreement acceptance, milestone mutation, exchange settlement, disputes, and
-- multi-party trade chains should be exposed through security-definer database
-- functions or Edge Functions so clients cannot approve their own obligations.
