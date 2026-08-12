# WorkTrade engineering review and UAT report

Date: 2026-08-12

## Outcome

The connected alpha is suitable for a small, supervised pilot after the P1 hosted journeys below are executed with three clean test accounts. It is not ready for unrestricted public launch because operational moderation, transactional email, legal policy, and permanent erasure remain incomplete.

## Issues fixed in this pass

- **P1 — Deployment exposed repository internals:** Pages uploaded the repository root, including migrations and tests. It now builds a minimal browser-only artifact.
- **P0 — Artifact dependency omission:** live smoke testing caught an empty application after `data.js` was omitted from the first allowlist. The dependency and its regression assertion are now included.
- **P1 — Excess database privileges:** chain internals explicitly revoke client writes; validation and notification helpers cannot be called directly.
- **P2 — Stale implementation:** obsolete demo network, fake people, and superseded renderers were removed.
- **P2 — Modal keyboard behavior:** dialogs now have accessible names, trap focus, close with Escape, and restore focus.
- **P2 — Missing contract tests:** automated UAT contracts cover deployment, private-circle visibility, introduction consent, rate limiting, and unanimous chain consent.

## Manual hosted UAT checklist

Run with three new accounts in separate browser profiles.

1. Complete profiles with reciprocal offers and needs.
2. Verify a signed-out visitor cannot see private profiles, circle members, resources, requests, introductions, or chains.
3. Decline, mute, and accept invitations; verify messaging appears only after acceptance.
4. Convert a mutually confirmed introduction workspace into a private draft.
5. Create an invite-only circle; approve membership; change roles; remove and leave members.
6. Post circle-only work and confirm a nonmember cannot retrieve it through REST.
7. Add a shared resource and confirm a nonmember cannot retrieve it.
8. Verify a chain cannot activate before every participant accepts the same version.
9. Revise the chain and confirm prior acceptances disappear.
10. Test sequential fulfillment, holds, approvals, completion, cancellation, and dispute.
11. Test keyboard-only navigation at desktop and mobile widths.
12. Verify notification routing and unread counts for every major event.

## Remaining findings

- **P1:** Hosted integration testing needs short-lived admin credentials in protected CI.
- **P1:** A staff moderation console and operational report workflow do not exist.
- **P1:** Transactional email delivery is not active.
- **P2:** `app.js` and `modules/backend.js` remain oversized and should be split by domain.
- **P2:** Circles and chains need dedicated routes for mobile use and deep linking.
- **P2:** Loading states need localized retry and disabled-submit behavior.
- **P2:** Temporary profiles from interrupted integration runs need an authorized cleanup job.
- **P3:** Add visual-regression and screen-reader testing before a broad pilot.

## Release gate

Do not open public registration until every P1 item is resolved. A supervised 5–15 person pilot may proceed after this checklist passes without authorization or workflow-breaking defects.
