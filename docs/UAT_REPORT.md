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

## Automated hosted result

Passed on 2026-08-12 against the hosted WorkTrade project. Both tests create temporary identities and clean them up in `finally`.

- The two-user lifecycle covers profile setup, draft publishing and duplication, request editing, offer revision and authorization, agreement creation, milestones, mutual confirmation, amendments, messaging, notifications, evidence upload, holds, reciprocal obligation approval, mutual completion, review submission, history, data export, and account deactivation.
- The circle-and-chain lifecycle covers private membership approval, outsider REST denial, private resources and work, closed reciprocal links, unanimous versioned consent, revision resets, stale-version rejection, activation, sequential enforcement, dependency holds, self-approval denial, completion, history, and disputes.

## Remaining manual hosted UAT checklist

Run with three new accounts in separate browser profiles.

1. Complete profiles with reciprocal offers and needs.
2. Verify a signed-out visitor cannot see private profiles, circle members, resources, requests, introductions, or chains.
3. Decline, mute, and accept invitations; verify messaging appears only after acceptance.
4. Convert a mutually confirmed introduction workspace into a private draft.
5. Exercise circle role changes, removal, leaving, and invitation decline in the browser UI.
6. Test keyboard-only navigation at desktop and mobile widths.
7. Verify visible notification routing and unread counts for every major event.

## Remaining findings

- **P1:** A staff moderation console and operational report workflow do not exist.
- **P1:** Transactional email delivery is not active.
- **P2:** `app.js` still contains domain rendering and event orchestration; continue extracting feature controllers after pilot behavior is stable.
- **P2:** Circles and chains need dedicated routes for mobile use and deep linking.
- **P2:** Loading states need localized retry and disabled-submit behavior.
- **P2:** Temporary profiles from interrupted integration runs need an authorized cleanup job.
- **P3:** Add visual-regression and screen-reader testing before a broad pilot.

## Release gate

Do not open public registration until every P1 item is resolved. A supervised 5–15 person pilot may proceed with active operator oversight while the remaining browser-focused checklist is completed.
