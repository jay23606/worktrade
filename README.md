# WorkTrade

WorkTrade is a connected alpha for exchanging practical work through cash, barter, or both. It adapts OpenStart's browser-native architecture and server-authoritative operational model to work requests, proposals, agreements, dependency holds, milestones, and evidence-backed reputation.

[Open the live alpha](https://jay23606.github.io/worktrade/) | [View the repository](https://github.com/jay23606/worktrade)

## Connected alpha capabilities

- Discover and filter public work requests
- Post work to build, repair, install, fabricate, restore, maintain, inspect, or diagnose
- Persist exchange modes, offered value, site constraints, location privacy, and request photos
- Edit, close, cancel, or archive open requests with immutable change history
- Save private drafts, publish when ready, duplicate prior requests, and reopen eligible requests
- Make cash, barter, or hybrid proposals
- Define exclusions, responsibilities, milestones, questions, and proposal expiration
- Revise or withdraw pending proposals and compare owner-visible terms
- Accept an offer through a server-authoritative transaction
- Independently confirm terms before an agreement becomes active
- Propose amendments that require counterparty acceptance and renewed confirmation
- Exchange private participant messages
- Keep persistent participant project journals
- Track milestones and general dependency holds
- Add assigned and dated milestones during the planning stages
- Track each party's cash, service, labor, or goods obligations independently
- Require counterpart approval of fulfilled obligations
- Prevent completion until every obligation is approved
- Require final approval from the counterparty who did not request completion
- Upload private JPG, PNG, or WebP work evidence
- Leave contextual reviews tied to completed work
- Maintain persistent `I need` and `I can offer` profile lists
- Receive proposal, message, and agreement notifications with unread state
- Review a readable agreement event history
- Use an action-oriented dashboard for requests, proposals, approvals, active work, and completed history
- Store notification preferences for future email delivery
- Export personal data and deactivate an account
- Use a resettable device-local sample experience while signed out

## Hosted environment

The live alpha is connected to a dedicated Supabase project in `us-east-1`. Database migrations, row-level policies, private evidence storage, authentication callbacks, and the `wt-agreement-action` Edge Function are deployed. `config.js` contains only browser-safe public configuration.

Signed-out visitors use device-local sample records. Signed-in users use hosted authentication and persistence.

Never put service-role keys, secret API keys, email-provider credentials, payment credentials, or identity-verification secrets in this repository.

## Trust boundary

- Important agreement mutations are authorized and locked in PostgreSQL.
- Both parties independently confirm terms.
- A responsible party cannot approve its own fulfilled obligation.
- Accepted requests cannot be silently rewritten.
- Active agreements block conflicting request closure and account deactivation.
- Evidence images remain private and use short-lived signed URLs.
- Reports are private and blocks are unilateral.
- Payments and barter settlement happen directly between participants.
- WorkTrade does not hold funds, create exchange credits, guarantee work, or verify professional competence.
- Trade-chain validation exists as domain groundwork but is not yet part of the connected workflow.

Account deactivation removes public profile details, capabilities, open requests, and pending proposals. Completed agreements retain a pseudonymous participant record so counterpart history remains coherent. Permanent authentication-record erasure is deferred until a formal retention policy is adopted.

## Run locally

```bash
npm test
npm start
```

Then open `http://localhost:8080`. Copy `config.example.js` to `config.js` and provide browser-safe Supabase configuration when connecting another deployment.

## Test scope

`npm test` checks browser modules and agreement invariants. `npm run test:integration` creates two temporary hosted users and exercises the real request → offer → agreement → message → milestone → dependency → reciprocal fulfillment → completion → evidence → review lifecycle. It also checks important authorization failures, data export, notifications, and deactivation before deleting temporary identities and evidence.

The integration test requires short-lived environment configuration and is not run by the public Pages workflow.

## Not yet ready

- Staff moderation dashboard and operational report handling
- Prohibited and regulated-work enforcement
- Production transactional email delivery
- Permanent account erasure policy and workflow
- Terms, privacy, safety, and marketplace disclosures
- Public multi-person trade chains
- Integrated payment collection or escrow

Until those safeguards are complete, WorkTrade should be treated as an internal alpha rather than an open public marketplace.
