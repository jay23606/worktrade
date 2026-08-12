# WorkTrade engineering review and UAT report

Date: 2026-08-12

## Outcome

The connected alpha has passed its automated two-user request lifecycle and three-user private-circle and reciprocal-chain lifecycle. It is suitable for a small, supervised pilot. It is not ready for unrestricted public launch because operational moderation, transactional email, legal policy, and permanent erasure remain incomplete.

## Issues fixed in this pass

- **P1 — Deployment exposed repository internals:** Pages uploaded the repository root, including migrations and tests. It now builds a minimal browser-only artifact.
- **P0 — Artifact dependency omission:** live smoke testing caught an empty application after `data.js` was omitted from the first allowlist. The dependency and its regression assertion are now included.
- **P1 — Excess database privileges:** chain internals explicitly revoke client writes; validation and notification helpers cannot be called directly.
- **P2 — Stale implementation:** obsolete demo network, fake people, and superseded renderers were removed.
- **P2 — Oversized backend module:** the backend is now split into request, agreement, network, circle, chain, trust, and core domains behind a stable facade.
- **P2 — Repeated UI infrastructure:** formatting, escaping, modal focus management, and remote request mapping now live in focused modules.
- **P2 — Modal keyboard behavior:** dialogs now have accessible names, trap focus, close with Escape, and restore focus.
- **P2 — Missing contract tests:** automated UAT contracts cover deployment, private-circle visibility, introduction consent, rate limiting, and unanimous chain consent.
- **P1 — Recursive circle authorization:** a self-referencing `circle_members` policy broke ordinary request reads and writes. Circle membership checks now use a security-definer predicate that preserves RLS without recursive evaluation.
- **P1 — Hosted lifecycle unverified:** the isolated two-account lifecycle now passes against hosted Supabase and runs from a protected GitHub Actions environment.
- **P1 — Chain creation failed:** an ambiguous PL/pgSQL identifier in the proposer guard prevented valid chains from being created. The function now uses explicit record aliases and has hosted regression coverage.
- **P1 — Moderation operations absent:** users can now submit private categorized reports, staff have a private review queue, restrictions block interaction writes, reporter updates exclude internal notes, appeals support reinstatement, and staff actions are immutable.
- **P1 — Transactional delivery absent:** notification events now feed a private idempotent outbox with category preferences, bounded retries, delivery attempts, generic privacy-safe templates, and a scheduled sink-mode dispatcher.
- **P1 — Browser UAT absent:** 24 Playwright and axe checks now cover desktop, tablet, phone, zoom/reflow, target sizes, accessible names, modal keyboard behavior, safety reporting, navigation, and duplicate-submit protection in CI.
- **P2 — Focus lost after rerender:** dialogs now restore focus through a stable selector when an asynchronous background render replaces the original trigger element.
- **P2 — Undersized controls:** primary navigation, profile, notification, filter, close, and brand controls now meet the tested minimum target size.
- **P2 — Duplicate submissions:** forms become busy and disable submit controls synchronously while an action is pending.

## Automated hosted result

Passed on 2026-08-12 against the hosted WorkTrade project. Both tests create temporary identities and clean them up in `finally`.

- The two-user lifecycle covers profile setup, draft publishing and duplication, request editing, offer revision and authorization, agreement creation, milestones, mutual confirmation, amendments, messaging, notifications, evidence upload, holds, reciprocal obligation approval, mutual completion, review submission, history, data export, and account deactivation.
- The circle-and-chain lifecycle covers private membership approval, outsider REST denial, private resources and work, closed reciprocal links, unanimous versioned consent, revision resets, stale-version rejection, activation, sequential enforcement, dependency holds, self-approval denial, completion, history, and disputes.
- The moderation lifecycle covers reporting, staff-only queue access, restriction enforcement, reporter-safe updates, appeals, reinstatement, safety notifications, and immutable audit history.

## Remaining manual hosted UAT checklist

Run with three new accounts in separate browser profiles.

1. Complete profiles with reciprocal offers and needs.
2. Verify a signed-out visitor cannot see private profiles, circle members, resources, requests, introductions, or chains.
3. Decline, mute, and accept invitations; verify messaging appears only after acceptance.
4. Convert a mutually confirmed introduction workspace into a private draft.
5. Exercise circle role changes, removal, leaving, and invitation decline in the browser UI.
6. Complete a manual screen-reader pass with NVDA or VoiceOver.
7. Verify visible notification routing and unread counts for every major event.

## Remaining findings

- **P2:** The pilot has one administrator; add a second trained reviewer before expanding so appeals and coverage do not depend on one person.
- **P1:** Production email remains intentionally disabled until a provider and authenticated sending domain are approved; the complete pipeline currently runs in non-delivering sink mode.
- **P2:** `app.js` still contains domain rendering and event orchestration; continue extracting feature controllers after pilot behavior is stable.
- **P2:** Circles and chains need dedicated routes for mobile use and deep linking.
- **P2:** Loading states need localized retry and disabled-submit behavior.
- **P2:** Temporary profiles from interrupted integration runs need an authorized cleanup job.
- **P3:** Add approved screenshot baselines after the visual design stabilizes; complete manual NVDA and VoiceOver passes before a broad pilot.

## Release gate

Do not open public registration until every P1 item is resolved. A supervised 5–15 person pilot may proceed with active operator oversight while the remaining browser-focused checklist is completed.
