export const seedData = {
  profile: {
    id: "me", name: "Jordan Lee", location: "Richmond, VA", initials: "JL",
    bio: "Practical generalist, careful neighbor, and weekend furniture builder.",
    needs: ["Mobile welding", "Bookkeeping help", "Reclaimed hardwood"],
    offers: ["Web design", "Furniture assembly", "Product photography"],
    onboardingComplete: true, preferredExchangeModes: ["cash", "barter", "hybrid"],
    following: [], joinedCircles: ["circle-makers"], blocked: [],
  },
  requests: [
    {
      id: "req-greenhouse", ownerId: "maya", owner: "Maya Chen", initials: "MC", title: "Build a backyard greenhouse",
      category: "Build", location: "Richmond, VA", distance: 2.4, urgency: "Flexible", status: "open",
      description: "Looking for help turning reclaimed windows into an 8×10 greenhouse. The foundation pad is ready; design input is welcome.",
      skills: ["Carpentry", "Glazing", "Design"], exchange: ["hybrid", "barter"], cashBudget: 900,
      offersInReturn: ["Brand photography", "Fresh produce share", "Cash"], createdAt: "2026-08-10",
      offers: [
        { id: "offer-a", provider: "Sam Rivera", initials: "SR", mode: "hybrid", cash: 500, gives: "Framing, assembly, and two site days", wants: "Food photography session + $500", duration: "2 weekends", note: "I can also source reclaimed cedar." },
      ],
      updates: [{ id: "u1", author: "Maya Chen", text: "Foundation pad is finished and the reclaimed windows are measured.", date: "Aug 10" }],
      messages: [{ id: "m1", authorId: "maya", author: "Maya Chen", text: "The largest window is 42 inches wide. I can share a complete measurement sheet.", date: "Aug 11" }], followers: [], reports: [],
    },
    {
      id: "req-mill", ownerId: "omar", owner: "Omar Davis", initials: "OD", title: "Diagnose a noisy milling machine",
      category: "Diagnose", location: "Petersburg, VA", distance: 24, urgency: "This week", status: "open",
      description: "Bridgeport-style mill developed a rhythmic spindle noise after a belt replacement. Need diagnosis before ordering anything.",
      skills: ["Machining", "Mechanical diagnosis"], exchange: ["cash", "barter"], cashBudget: 250,
      offersInReturn: ["Machine time", "Custom metal parts", "Cash"], createdAt: "2026-08-11", offers: [], updates: [], messages: [], followers: [], reports: [],
    },
    {
      id: "req-deck", ownerId: "nia", owner: "Nia Brooks", initials: "NB", title: "Restore and reseal storefront deck",
      category: "Restore", location: "Manchester, VA", distance: 4.1, urgency: "Before September", status: "active",
      description: "Replace several damaged boards, clean the surface, and apply a commercial-grade sealer outside business hours.",
      skills: ["Carpentry", "Exterior finishing"], exchange: ["hybrid"], cashBudget: 1200,
      offersInReturn: ["Catering credit", "Cash"], createdAt: "2026-08-04",
      agreement: { provider: "Jordan Lee", mode: "hybrid", summary: "$850 + catering for two events", status: "active", progress: 50 },
      hold: { type: "Weather", detail: "Two dry days needed before sealing", owner: "Conditions", reviewDate: "2026-08-16" },
      milestones: [{ title: "Assessment", done: true }, { title: "Replace boards", done: true }, { title: "Clean and dry", done: false }, { title: "Seal and review", done: false }],
      offers: [], updates: [{ id: "u2", author: "Jordan Lee", text: "Damaged boards replaced. Pausing before surface cleaning due to rain.", date: "Aug 11" }],
      messages: [{ id: "m2", authorId: "nia", author: "Nia Brooks", text: "The rear gate will remain unlocked Thursday morning.", date: "Aug 12" }], followers: ["me"], reports: [],
    },
  ],
  notifications: [
    { id: "demo-message", kind: "message", title: "New project message", body: "Nia shared updated site-access details.", request_id: "req-deck", created_at: "2026-08-12T14:20:00Z", read_at: null },
    { id: "demo-action", kind: "agreement", title: "Work issue needs your review", body: "Review the weather dependency before affected work continues.", request_id: "req-deck", created_at: "2026-08-12T13:10:00Z", read_at: null },
    { id: "demo-update", kind: "agreement", title: "Schedule accepted", body: "The shared work window is confirmed.", request_id: "req-deck", created_at: "2026-08-11T16:30:00Z", read_at: "2026-08-11T17:00:00Z" },
  ],
};

export function cloneSeed() { return structuredClone(seedData); }
