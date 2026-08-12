create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_profile_id uuid references public.profiles(id) on delete cascade,
  followed_request_id uuid references public.work_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((followed_profile_id is not null)::int + (followed_request_id is not null)::int = 1),
  check (follower_id is distinct from followed_profile_id)
);
create unique index unique_profile_follow on public.follows(follower_id, followed_profile_id) where followed_profile_id is not null;
create unique index unique_request_follow on public.follows(follower_id, followed_request_id) where followed_request_id is not null;

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_profile_id uuid references public.profiles(id),
  request_id uuid references public.work_requests(id),
  reason text not null,
  detail text not null,
  status text not null default 'submitted' check (status in ('submitted','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (reported_profile_id is not null or request_id is not null)
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  description text,
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator','owner')),
  status text not null default 'active' check (status in ('invited','requested','active','removed')),
  joined_at timestamptz not null default now(),
  primary key(circle_id, profile_id)
);

create table public.skill_endorsements (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.work_evidence(id) on delete cascade,
  endorser_id uuid not null references public.profiles(id),
  contributor_id uuid not null references public.profiles(id),
  skill text not null,
  note text,
  created_at timestamptz not null default now(),
  unique(evidence_id, endorser_id),
  check (endorser_id <> contributor_id)
);

create table public.trade_chains (
  id uuid primary key default gen_random_uuid(),
  proposed_by uuid not null references public.profiles(id),
  status text not null default 'proposed' check (status in ('proposed','accepted','active','completed','cancelled','disputed')),
  created_at timestamptz not null default now()
);

create table public.trade_chain_links (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.trade_chains(id) on delete cascade,
  from_profile_id uuid not null references public.profiles(id),
  to_profile_id uuid not null references public.profiles(id),
  value_description text not null,
  accepted_at timestamptz,
  fulfilled_at timestamptz,
  approved_at timestamptz,
  check (from_profile_id <> to_profile_id),
  unique(chain_id, from_profile_id),
  unique(chain_id, to_profile_id)
);

alter table public.project_messages enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.safety_reports enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.skill_endorsements enable row level security;
alter table public.trade_chains enable row level security;
alter table public.trade_chain_links enable row level security;

create policy "participants read messages" on public.project_messages for select using (exists (select 1 from public.work_requests r left join public.work_agreements a on a.request_id = r.id where r.id = request_id and (r.owner_id = auth.uid() or a.provider_id = auth.uid())));
create policy "participants send messages" on public.project_messages for insert with check (author_id = auth.uid() and exists (select 1 from public.work_requests r left join public.work_agreements a on a.request_id = r.id where r.id = request_id and (r.owner_id = auth.uid() or a.provider_id = auth.uid())));
create policy "own follows" on public.follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "own blocks" on public.blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "submit own reports" on public.safety_reports for insert with check (reporter_id = auth.uid());
create policy "read own reports" on public.safety_reports for select using (reporter_id = auth.uid());
create policy "public circles readable" on public.circles for select using (visibility = 'public' or owner_id = auth.uid());
create policy "circle membership readable" on public.circle_members for select using (status = 'active' or profile_id = auth.uid());
create policy "request own membership" on public.circle_members for insert with check (profile_id = auth.uid() and role = 'member');
create policy "verified endorsements readable" on public.skill_endorsements for select using (true);
create policy "participants endorse evidence" on public.skill_endorsements for insert with check (endorser_id = auth.uid() and exists (select 1 from public.work_evidence e join public.work_agreements a on a.id = e.agreement_id where e.id = evidence_id and (a.requester_id = auth.uid() or a.provider_id = auth.uid())));

-- Chain creation and acceptance must be performed by server-authoritative
-- functions that validate one closed loop and require every linked party to
-- consent before any obligation becomes active.
