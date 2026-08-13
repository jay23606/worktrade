# WorkTrade

WorkTrade is built first for trusted local practical-work communities: neighborhoods, maker spaces, nonprofits, trade schools, shared shops, and small-business networks. Members coordinate real needs around location, availability, transport, tools, materials, equipment, workspace, and site access—then negotiate cash, barter, or both.

It is also an installable progressive web app. The application shell, artwork, and local demo data remain available after a successful first load without connectivity. The interface reports connection changes, disables server-authoritative actions while offline, offers an in-app install prompt when supported, and lets people activate a waiting update. Compact layouts use a persistent mobile navigation bar.

The wider public network remains available for discovery, but community context is the product's primary trust layer. WorkTrade supports ordinary two-person agreements and closed reciprocal exchanges among several members without creating platform credits.

[Open WorkTrade](https://jay23606.github.io/worktrade/) · [Repository](https://github.com/jay23606/worktrade) · [UAT report](docs/UAT_REPORT.md)

> WorkTrade is a connected pilot build, not an unrestricted public marketplace. Payments and barter settlement happen directly between participants. WorkTrade does not hold funds, guarantee work, or verify professional competence.

## What makes it different

- **Value is negotiated, not tokenized.** People may exchange money, labor, services, materials, goods, equipment, space, access, or a combination.
- **Reputation is tied to outcomes.** Reviews, evidence, portfolios, and activity reference completed work rather than popularity.
- **Conversation requires consent.** A profile invitation states both the need and offer; private messaging opens only after acceptance.
- **Place creates useful context.** Invite-only communities connect people through a shared area or organization and make transport, timing, tools, materials, workspace, and access visible before work begins.
- **Community trust is earned through work.** Each community shows open needs, shared resources, completed work, returning contributors, and completion history for its members.
- **Multi-person barter is operational.** A chain forms one closed loop, requires unanimous versioned consent, and tracks every contribution independently.
- **New members get an immediate starting point.** Guided match setup turns plain-language offers, needs, location, availability, privacy, and exchange preferences into ranked work and collaborator suggestions.

## Product status

| Area                       | Status                | Notes                                                                                            |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| Accounts and profiles      | Connected             | Email-link authentication plus resumable setup, profile completeness, private profile-photo storage, location privacy, availability, offers, needs, exchange preferences, and resources |
| Private pilot operations   | Connected             | Hashed invites, server-enforced membership, contextual feedback, private follow-up, triage, and activation funnel |
| Public work requests       | Connected             | Drafts, photos, constraints, lifecycle history, cash/barter/hybrid proposals                     |
| Proposal negotiation       | Connected             | Versioned counters, highlighted term changes, counterparty-only acceptance, declines, and readable history |
| Negotiation inbox          | Connected             | Waiting-on-you/them queues, direct request routing, expiration warnings, changed-term summaries, and proposal email delivery |
| Conversation-first contact | Connected             | Message people or ask about a request without drafting trade terms; recipients opt in before private conversation begins |
| Dedicated Messages         | Connected             | Live searchable conversations, private photo/document attachments, delivery/read state, saved drafts, pagination, related-work context, archive/mute controls, and a deliberate path into formal offers |
| Agreements                 | Connected             | Mutual confirmation, amendments, scheduling, milestones, holds, obligations, completion approval |
| Private scheduling         | Connected             | Recurring availability, mutual time proposals, counteroffers, participant-only arrival details, weather flags, and calendar export |
| Preparation ledger         | Connected             | Materials, tools, rentals, permits, delivery, cash/barter contributions, readiness, actual costs, shared approvals, and private receipt evidence |
| Active-work change orders  | Connected             | Documented issues, private evidence, isolated impact, baseline diffs, cash/time/barter deltas, mutual approval, and dispute escalation |
| Guided project path        | Connected             | Agreement → Schedule → Prepare → Work → Changes → Complete, with one contextual action and explicit ready, blocked, waiting, and available states |
| Active project workspace   | Connected             | Compact Overview, unified Activity, Exchange, and Files sections keep current work visible without an endless detail page |
| Action inbox               | Connected             | Groups required actions, messages, and updates; routes into project context; supports read state, global delivery settings, and per-project routine-update muting |
| First-use activation       | Connected             | Adaptive five-step checklist, profile-readiness guidance, reciprocal match setup, removable examples, and a guided first proposal grounded in actual account milestones |
| Evidence and reputation    | Connected             | Private evidence, contextual reviews, verified completion stories, and photo-backed portfolios tied to completed work |
| Social network             | Connected             | Outcome-aware reciprocal and project-specific ranking across skills, timing, location/remote intent, exchange modes, resources, proof, and private feedback; project owners can message, invite, save, or dismiss suggested collaborators |
| Local discovery            | Connected             | Nearby/remote modes, normalized skill aliases, explainable reciprocal ranking, availability and sort filters, coarse location bands, privacy controls, and saved alerts |
| Introductions              | Connected             | Consent gate, private messaging, shared planning workspace, conversion to work                   |
| Trusted communities        | Connected pilot       | Organizer guidance, membership workflows, roles, local needs, shared resources, rules, and scoped reputation |
| Multi-person barter chains | Connected pilot       | Circle-only discovery, unanimous consent, execution modes, holds, approvals, disputes            |
| Moderation operations      | Pilot ready           | Private reports, staff queue, restrictions, appeals, immutable actions, initial admin, and an operating runbook |
| Transactional email        | Safe staging          | Private outbox, preferences, retries, delivery logs, and sink dispatcher; production provider/domain remain disabled |
| Payments or escrow         | Not planned for pilot | Participants settle directly                                                                     |

## Primary journeys

### Request → agreement → verified outcome

1. A member publishes work with the desired outcome, constraints, skills, location privacy, and acceptable exchange modes.
2. Another member proposes scope, exclusions, responsibilities, milestones, timing, and value exchanged.
3. The requester selects a proposal; both people independently confirm the same terms.
4. The project path guides both people through scheduling, preparation and costs, dependencies, milestones, and documented change orders without losing the agreed baseline.
5. Completion requires counterparty approval. Evidence, contextual reviews, and an optional portfolio story remain tied to the agreement.

### Profile → introduction → work

1. Explainable matching shows how one member's offers and needs overlap another's.
2. A member can start with a message or question; formal offers state both sides of a possible exchange only when people are ready.
3. The recipient accepts, declines, or mutes it. Messaging opens only after acceptance.
4. Both people negotiate scope, responsibilities, materials, exclusions, exchange, and availability in a versioned workspace.
5. Both confirm the same version before it becomes a private work draft.

### Circle → reciprocal barter chain

1. Active members of the same trusted circle discover or manually build a closed loop of at least three contributions.
2. Every participant reviews the entire loop and accepts the same version. Any revision resets all consent.
3. The chain runs simultaneously, sequentially, or conditionally. Dependencies can pause the whole chain or one link.
4. Providers submit fulfillment and recipients approve it. The chain completes only when every link is approved.
5. Unfulfilled chains may be renegotiated; active chains may be cancelled or disputed without rewriting history.

## Trust and privacy boundaries

- PostgreSQL security-definer workflows authorize consequential mutations and lock current versions.
- Row-level security limits private requests, messages, evidence, circle data, and chains to eligible participants.
- Accepted request terms and chain versions cannot be silently rewritten.
- Agreement and chain revisions reset prior confirmations.
- A contributor cannot approve their own obligation.
- Private introduction messaging requires acceptance and honors blocks, cooldowns, and invitation rate limits.
- Circle member directories, resources, work, and chains require active membership.
- Evidence uses private object storage and short-lived signed URLs.
- Account deactivation removes public presence while preserving pseudonymous counterpart history.
- The public Pages artifact contains browser runtime files only; migrations, tests, and repository internals are not deployed.

## Architecture

```mermaid
flowchart LR
  Browser["Browser-native UI"] --> Facade["Backend facade"]
  Facade --> Domains["Request · Agreement · Network · Circle · Chain modules"]
  Domains --> Auth["Supabase Auth"]
  Domains --> DB["PostgreSQL RPCs + RLS"]
  Domains --> Storage["Private evidence storage"]
  DB --> History["Versioned terms + audit history"]
  GH["GitHub Pages"] --> Browser
```

The client is plain HTML, CSS, and ES modules. UI behavior is split into focused modules under `features/` and `shell/`; `app.js` composes those modules and owns the remaining interaction routing. `modules/backend.js` is a stable compatibility facade whose implementations live in domain modules under `modules/backend/`. High-risk transitions are database functions or the agreement Edge Function rather than client-side table writes.

## Repository map

```text
app.js                         UI composition and interaction routing
features/                      matching, messaging, network, community, profile, project, and workspace UI modules
features/collaboration-dialogs.js  collaboration and community modal builders
features/operations-dialogs.js     moderation and pilot operations dialogs
features/project-coordination-dialogs.js  scheduling, preparation, and change-order dialogs
features/notifications.js           inbox grouping, routing, and notification preferences
shell/                         PWA installation, updates, and connectivity lifecycle
modules/backend.js             stable backend export facade
modules/backend/               account, request, agreement, network, circle, chain, trust domains
modules/agreements.js          pure agreement and chain invariants
modules/store.js               reactive client state
supabase/migrations/           append-only hosted schema and authorization changes
supabase/functions/            server-authoritative agreement action function
tests/                         unit and UAT contract tests
scripts/integration-test.mjs   destructive temporary-user hosted lifecycle test
docs/UAT_REPORT.md             findings, release gates, and manual pilot checklist
docs/MODERATION_RUNBOOK.md     staff triage, action, appeal, and escalation procedure
```

## Run locally

Requirements: a recent Node.js release and Python available as `python`.

```bash
npm test
npm run test:uat
npm start
```

Open `http://localhost:8080`.

The committed `config.js` contains browser-safe public Supabase configuration only. For another deployment, copy `config.example.js` to `config.js` and provide that project's URL and publishable key. Never commit service-role keys, email-provider credentials, payment credentials, or identity-verification secrets.

## Supabase deployment

Link the CLI to the intended project, review the target, then apply migrations in order:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy wt-agreement-action
```

Do not edit an applied migration. Add a later migration that replaces the affected policy or function.

## Testing

```bash
npm test             # syntax, domain invariants, store tests, UAT contracts
npm run test:uat     # deployment and authorization contract checks only
npm run test:integration         # two-user request-to-completion lifecycle
npm run test:integration:chains  # private circle and three-party chain
npm run test:integration:moderation # report, restriction, appeal, audit
npm run test:integration:email      # private outbox and sink dispatcher
npm run test:integration:pilot      # invite redemption and admin authorization
npm run test:browser                # desktop, tablet, phone, zoom, keyboard, axe
```

The hosted integration tests create temporary users, exercise invitation acceptance, private messaging, versioned planning and confirmation reset, private-project conversion, the full request-to-completion workflow, reciprocal chains, and the member-to-admin pilot feedback loop; validate authorization failures; and remove their test identities and evidence in `finally`. They run through the protected `hosted-uat` GitHub Actions environment when backend or integration-test code changes. Local runs require:

- `WT_SUPABASE_URL`
- `WT_SUPABASE_PUBLISHABLE_KEY`
- `WT_SUPABASE_SECRET_KEY`

Do not place the secret key in GitHub Pages configuration or public CI logs. See [docs/UAT_REPORT.md](docs/UAT_REPORT.md) for automated coverage and the remaining manual checks.

Browser UAT runs 92 checks across desktop, tablet, phone, compact desktop, and a 200%-zoom-equivalent viewport. It covers serious/critical axe findings, horizontal overflow, filter collision, accessible names, target sizes, primary navigation, open email-link onboarding, community positioning, dark-mode feedback contrast, first-use activation, dedicated messaging, simple question-first contact, formal offers, project workspace and inbox routing, modal labeling and focus trapping, focus restoration after rerenders, safety guidance, and duplicate-submit prevention. CI retains traces and screenshots only when a check fails.

## Deployment

Pushing `main` runs the Pages workflow. It builds an explicit allowlisted artifact containing only the browser application and then deploys it. Database migrations and Edge Functions are deployed separately through Supabase. A protected scheduled workflow invokes the email dispatcher every five minutes; it remains in `sink` mode until production email is explicitly configured.

## Release gates

Before opening registration beyond a supervised 5–15 person pilot:

- Review moderation staffing and response coverage before expanding beyond the supervised pilot.
- Authorize a sending domain and explicitly change transactional email from `sink` to a configured production provider.
- Establish prohibited-work, safety, privacy, terms, retention, and permanent-erasure policies.
- Keep both protected hosted UAT lifecycles passing, including nonparticipant REST authorization attempts.
- Resolve all P1 findings in [the UAT report](docs/UAT_REPORT.md).

Integrated payment collection, custody, exchange credits, and escrow are intentionally outside the pilot.
