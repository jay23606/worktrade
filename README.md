# WorkTrade

WorkTrade is a local-first marketplace for practical work exchanged through cash, barter, or both. It adapts OpenStart's browser-native architecture and operational lifecycle to work requests, proposals, agreements, dependency holds, milestones, and social proof.

## Included in the MVP

- Discover and filter public work requests
- Post work to build, repair, install, fabricate, restore, maintain, inspect, or diagnose
- Make cash, barter, or hybrid offers
- Accept an offer into a tracked agreement
- Add project updates and dependency holds
- Maintain `I need` and `I can offer` profile lists
- Device-local persistence with resettable demo data
- Supabase-ready relational schema in `supabase/migrations`

Run `npm test`, then `npm start` and open `http://localhost:8080`.

This first version deliberately has no real authentication, payments, file uploads, or private messaging. Those belong behind server-authoritative boundaries before production use.
