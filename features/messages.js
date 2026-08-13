export function createMessagesFeature({ getState, shell, esc }) {
  const state = getState();
function conversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderMessages() {
  if (!state.session) return shell(`<section class="messages-welcome"><span class="eyebrow">Private conversations</span><h1>Talk first. Trade when it makes sense.</h1><p>Sign in to see message requests and conversations.</p><button class="primary" data-action="sign-in">Sign in</button></section>`, "Messages");
  const inbox = state.networkInbox || { invitations: [], messages: [] };
  const query = (state.messageQuery || "").trim().toLowerCase();
  const seenPeople = new Set();
  const conversations = (inbox.invitations || []).filter((item) => {
    const archived = !!item.member_state?.archived_at;
    if (archived !== !!state.showArchivedMessages) return false;
    const other = item.sender_id === state.profile.id ? item.recipient_name : item.sender_name;
    const request = state.requests.find((entry) => entry.id === item.request_id);
    const otherId = item.sender_id === state.profile.id ? item.recipient_id : item.sender_id;
    if (seenPeople.has(otherId)) return false;
    seenPeople.add(otherId);
    return !query || `${other} ${item.note || ""} ${request?.title || ""}`.toLowerCase().includes(query);
  });
  const selected = state.messageListOnly && window.matchMedia("(max-width: 760px)").matches ? null : conversations.find((item) => item.id === state.selectedConversationId) || conversations[0] || null;
  if (selected && selected.id !== state.selectedConversationId) queueMicrotask(() => { state.selectedConversationId = selected.id; });
  const list = conversations.map((item) => {
    const other = item.sender_id === state.profile.id ? item.recipient_name : item.sender_name;
    const messages = (inbox.messages || []).filter((message) => message.invitation_id === item.id);
    const latest = messages.at(-1);
    const preview = latest?.body || item.note || (item.status === "pending" ? "Waiting for a response" : "Conversation opened");
    const unread = Number(item.unread_count || 0);
    return `<button class="conversation-row ${selected?.id === item.id ? "active" : ""} ${unread ? "unread" : ""}" data-conversation="${item.id}"><span class="avatar">${esc(other.split(/\s+/).map((part) => part[0]).join("").slice(0, 2))}</span><span><b>${esc(other)}</b><small>${esc(preview)}</small></span><span class="conversation-meta"><time>${conversationTime(latest?.created_at || item.created_at)}</time>${unread ? `<i>${unread}</i>` : ""}</span></button>`;
  }).join("");
  return shell(`<section class="messages-page"><div class="messages-title"><div><span class="eyebrow">Private conversations</span><h1>Messages</h1></div><button class="secondary" data-nav="network">Find people</button></div><div class="messages-layout ${selected ? "has-selection" : ""}"><aside class="conversation-list" aria-label="Conversations"><form data-form="message-search" class="message-search"><input name="query" aria-label="Search conversations" value="${esc(state.messageQuery || "")}" placeholder="Search conversations"><button class="secondary">Search</button></form><button class="text-btn archive-toggle" data-action="toggle-message-archive">${state.showArchivedMessages ? "Back to inbox" : "Archived"}</button>${list || `<div class="empty"><p>${state.showArchivedMessages ? "No archived conversations." : "No conversations yet."}</p><button class="secondary" data-nav="network">Find someone to message</button></div>`}</aside>${selected ? conversationPanel(selected, inbox) : `<section class="conversation-empty"><span aria-hidden="true">✉</span><h2>Choose a conversation</h2><p>Messages, questions, and formal exchange planning stay connected without becoming the same thing.</p></section>`}</div></section>`, "Messages");
}

function conversationPanel(invitation, inbox) {
  const incoming = invitation.recipient_id === state.profile.id;
  const otherId = incoming ? invitation.sender_id : invitation.recipient_id;
  const other = incoming ? invitation.sender_name : invitation.recipient_name;
  const allMessages = (inbox.messages || []).filter((item) => item.invitation_id === invitation.id);
  const pageSize = state.messagePageSizes[invitation.id] || 40;
  const messages = allMessages.slice(-pageSize);
  const attachments = inbox.attachments || [];
  const request = state.requests.find((item) => item.id === invitation.request_id);
  const pendingIncoming = incoming && invitation.status === "pending";
  const accepted = ["accepted", "converted"].includes(invitation.status);
  return `<section class="conversation-panel" aria-label="Conversation with ${esc(other)}"><header><button class="text-btn messages-back" data-action="messages-back">← Inbox</button><button class="conversation-person" data-view-profile="${otherId}"><span class="avatar">${esc(other.split(/\s+/).map((part) => part[0]).join("").slice(0, 2))}</span><span><b>${esc(other)}</b><small>${invitation.member_state?.muted ? "Notifications muted" : "Private conversation"}</small></span></button><div class="conversation-tools"><button class="text-btn" data-conversation-manage="${invitation.member_state?.muted ? "unmute" : "mute"}:${invitation.id}">${invitation.member_state?.muted ? "Unmute" : "Mute"}</button><button class="text-btn" data-conversation-manage="archive:${invitation.id}">Archive</button></div></header>${request ? `<aside class="conversation-context"><span><small>Related work</small><b>${esc(request.title)}</b></span><button class="secondary compact" data-open="${request.id}">View work</button></aside>` : ""}<div class="message-thread">${allMessages.length > messages.length ? `<button class="text-btn load-older" data-load-messages="${invitation.id}">Load ${Math.min(40, allMessages.length - messages.length)} older messages</button>` : ""}${invitation.note ? `<div class="message-bubble ${incoming ? "theirs" : "mine"}"><p>${esc(invitation.note)}</p><small>${esc(incoming ? invitation.sender_name : "You")} · ${conversationTime(invitation.created_at)}</small></div>` : ""}${messages.map((message) => { const files = attachments.filter((item) => item.message_id === message.id); const mine = message.author_id === state.profile.id; const receipt = mine ? (invitation.other_read_at && new Date(invitation.other_read_at) >= new Date(message.created_at) ? "Read" : "Delivered") : ""; return `<div class="message-bubble ${mine ? "mine" : "theirs"}"><p>${esc(message.body)}</p>${files.map((file) => file.mime_type.startsWith("image/") && file.url ? `<a class="message-image" href="${esc(file.url)}" target="_blank" rel="noopener"><img src="${esc(file.url)}" alt="${esc(file.file_name)}"><span>${esc(file.file_name)}</span></a>` : `<a class="message-file" href="${esc(file.url)}" target="_blank" rel="noopener"><span aria-hidden="true">📎</span><span><b>${esc(file.file_name)}</b><small>${Math.max(1, Math.round(file.byte_size / 1024))} KB</small></span></a>`).join("")}<small>${mine ? "You" : esc(message.author_name)} · ${conversationTime(message.created_at)}${receipt ? ` · ${receipt}` : ""}</small></div>`; }).join("") || (!invitation.note ? `<p class="thread-empty">No messages yet.</p>` : "")}</div>${pendingIncoming ? `<div class="message-consent"><p><b>${esc(other)} wants to start a conversation.</b> Open it to reply. You can decline or mute without notifying them further.</p><button class="primary" data-invite-response="accepted:${invitation.id}">Open conversation</button><button class="text-btn" data-invite-response="declined:${invitation.id}">Decline</button></div>` : accepted ? `<form data-form="intro-message" data-invitation="${invitation.id}" class="message-composer"><label><span class="sr-only">Message ${esc(other)}</span><textarea name="body" maxlength="1500" data-message-draft="${invitation.id}" placeholder="Write a message">${esc(state.messageDrafts[invitation.id] || "")}</textarea></label><label class="attachment-button" title="Attach a photo or document"><span aria-hidden="true">📎</span><span class="sr-only">Attach file</span><input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.doc,.docx"></label><button class="primary">Send</button><small class="composer-help">Enter to send · Shift+Enter for a new line · 10 MB maximum</small></form><div class="conversation-next"><span><b>Ready to make it concrete?</b><small>Turn the discussion into clear work and exchange terms.</small></span>${invitation.invitation_kind === "exchange" ? `<button class="secondary" data-workspace="${invitation.id}">Open exchange plan</button>` : `<button class="secondary" data-message-offer="${invitation.id}">${request && request.ownerId !== state.profile.id ? "Create an offer" : "Plan an exchange"}</button>`}</div>` : `<div class="message-consent"><p>${invitation.status === "pending" ? "Waiting for them to open the conversation." : `This conversation is ${esc(invitation.status)}.`}</p></div>`}<footer><button class="text-btn" data-network-manage="profile:report:${invitation.id}">Report</button><button class="danger-text" data-network-manage="profile:block:${invitation.id}">Block</button></footer></section>`;
}

  return { conversationTime, renderMessages };
}
