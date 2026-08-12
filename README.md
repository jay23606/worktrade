# WorkTrade

WorkTrade is a local-first marketplace for practical work exchanged through cash, barter, or both. It adapts OpenStart's browser-native architecture and operational lifecycle to work requests, proposals, agreements, dependency holds, milestones, and social proof.

[Live demo](https://jay23606.github.io/worktrade/) · [Repository](https://github.com/jay23606/worktrade)

## Included in the MVP

- Discover and filter public work requests
- Post work to build, repair, install, fabricate, restore, maintain, inspect, or diagnose
- Make cash, barter, or hybrid offers
- Accept an offer into a tracked agreement
- Add project updates and dependency holds
- Maintain `I need` and `I can offer` profile lists
- Device-local persistence with resettable demo data
- Supabase-ready relational schema in `supabase/migrations`
- Mutual agreement confirmation, controlled transitions, and version checks
- Project conversations, follows, circles, blocking, and private safety reports
- Evidence-backed skill history and a validated reciprocal trade-chain model

Run `npm test`, then `npm start` and open `http://localhost:8080`.

The public build runs in clearly labeled device-local demo mode. Supabase adapters, migrations, row-level policies, and a server-authoritative agreement function are included, but are inactive until a dedicated project is configured.

## Production activation

1. Create a dedicated Supabase project in the chosen organization and region.
2. Run the migrations in order and deploy `wt-agreement-action`.
3. Copy the public project URL and publishable key into `config.js`.
4. Allow the production and local callback URLs in Supabase Auth.
5. Verify row-level policies and transactional functions against a staging project before accepting real users.

Never put the service-role key, email-provider credentials, payment credentials, or identity-verification secrets in this repository.

## Current trust boundary

- The demo stores records only in the current browser.
- Production clients may request privileged agreement actions, but database functions lock and authorize the affected record.
- Both parties independently confirm terms.
- A responsible party cannot approve its own fulfilled obligation.
- Reports are private; blocks are unilateral.
- Trade chains remain proposed until every linked participant consents.

Payments, file uploads, identity verification, moderation operations, and jurisdiction-specific contracting remain intentionally unconfigured because they require explicit ownership and policy decisions.
