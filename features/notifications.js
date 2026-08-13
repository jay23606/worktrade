export function createNotificationsFeature({ getState, openModal, esc }) {
  const state = getState();
  function notificationsModal() {
    const unread = state.notifications.filter((item) => !item.read_at);
    const groups = { action: [], message: [], update: [] };
    state.notifications.forEach((item) => {
      const group = notificationGroup(item);
      if (group === "update" && item.request_id && state.projectNotificationSettings[item.request_id] === "muted") return;
      groups[group].push(item);
    });
    openModal(
      `<span class="eyebrow">Inbox</span><div class="section-title inbox-title"><div><h2>Work that changed</h2><p>${unread.length ? `${unread.length} unread` : "You’re caught up"}</p></div>${unread.length ? `<button class="text-btn" data-action="read-all">Mark all read</button>` : ""}</div><div class="inbox-groups">${notificationGroupSection("Needs your action", groups.action, "Confirmations, proposals, and reviews that cannot move without you.")}${notificationGroupSection("Messages", groups.message, "Project conversations from other participants.")}${notificationGroupSection("Updates", groups.update, "Status changes and useful context; no response is required.")}</div><button class="text-btn" data-action="notification-preferences">Notification preferences</button>`,
    );
  }
  
  function notificationGroup(item) {
    if (item.kind === "message" || /message/i.test(item.title)) return "message";
    if (/new trade proposal|counterproposal|approval requested|needs? (your )?review|proposed|invitation|membership request|renewed consent|work issue reported/i.test(item.title)) return "action";
    return "update";
  }
  
  function notificationRoute(item) {
    if (/new introduction message|new message request|new question about your work/i.test(item.title)) return { view: "messages" };
    if (item.request_id) return { view: "detail", section: item.kind === "message" ? "activity" : /change|issue/i.test(item.title) ? "overview" : /cost|contribution|exchange/i.test(item.title) ? "exchange" : "overview" };
    if (item.kind === "network") return { view: "network" };
    if (item.kind === "safety") return { view: "profile" };
    return { view: "workspace" };
  }
  
  function notificationGroupSection(title, items, emptyText) {
    return `<section class="inbox-group"><div class="inbox-group-head"><h3>${title}</h3><span>${items.length}</span></div>${items.length ? `<div class="notification-list">${items.map(notificationItem).join("")}</div>` : `<div class="empty compact"><b>Nothing here</b><p>${emptyText}</p></div>`}</section>`;
  }
  
  function notificationItem(item) {
    const route = notificationRoute(item);
    const waiting = notificationGroup(item) === "action" ? "Waiting on you" : "For your awareness";
    const muted = item.request_id && state.projectNotificationSettings[item.request_id] === "muted";
    return `<article class="notification-item ${item.read_at ? "" : "unread"}"><button data-notification="${item.id}" data-request="${item.request_id || ""}" data-route="${route.view}" data-section="${route.section || ""}"><span>${esc(waiting)}</span><b>${esc(item.title)}</b><p>${esc(item.body)}</p><small>${new Date(item.created_at).toLocaleString()}</small></button>${item.request_id ? `<button class="notification-mute" data-project-notifications="${item.request_id}:${muted ? "normal" : "muted"}">${muted ? "Unmute project" : "Mute project"}</button>` : ""}</article>`;
  }
  
  function preferencesModal() {
    const p = state.notificationPreferences || {};
    openModal(
      `<span class="eyebrow">Notification preferences</span><h2>Choose what reaches you.</h2><p>Email routing is active in safe sink mode while the production sending domain is being authorized. Your preferences are already enforced.</p><form data-form="preferences" class="preference-form">${[
        ["in_app", "In-app notifications"],
        ["browser_notifications", "Browser/PWA new-message alerts"],
        ["email_enabled", "Allow transactional email"],
        ["email_proposals", "Proposal emails"],
        ["email_messages", "Message emails"],
        ["email_agreements", "Agreement emails"],
        ["email_reminders", "Reminder emails"],
        ["email_network", "Network and circle emails"],
        ["email_safety", "Safety and account emails"],
      ]
        .map(
          ([name, label]) =>
            `<label><span>${label}</span><input type="checkbox" name="${name}" ${(name === "browser_notifications" ? ("Notification" in window && Notification.permission === "granted") : p[name]) ? "checked" : ""}></label>`,
        )
        .join("")}<button class="primary">Save preferences</button></form>`,
    );
  }
  
    return { notificationRoute, notificationsModal, preferencesModal };
}

