import { getBackend, getSession, assertBackend } from "./core.js";

export async function submitOffer(requestId, input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("submit_trade_offer", {
    target_request_id: requestId,
    payload: input,
  });
  if (error) throw error;
  return data;
}

export async function proposeAmendment(agreementId, expectedVersion, input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("propose_agreement_amendment", {
    target_agreement_id: agreementId,
    expected_version: expectedVersion,
    payload: input,
  });
  if (error) throw error;
  return data;
}

export async function respondAmendment(amendmentId, accept) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("respond_agreement_amendment", {
    target_amendment_id: amendmentId,
    accept,
  });
  if (error) throw error;
  return data;
}

export async function getAgreementAmendments(agreementId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client
    .from("agreement_amendments")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function handleCompletion(agreementId, expectedVersion, action) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("handle_completion", {
    target_agreement_id: agreementId,
    expected_version: expectedVersion,
    action,
  });
  if (error) throw error;
  return data;
}

export async function addProjectUpdate(
  requestId,
  body,
  visibility = "participants",
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("add_project_update", {
    target_request_id: requestId,
    body_text: body,
    update_visibility: visibility,
  });
  if (error) throw error;
  return data;
}

export async function getProjectUpdates(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client
    .from("project_updates")
    .select("*, profiles!project_updates_author_id_fkey(display_name)")
    .eq("request_id", requestId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getRequestOffers(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client
    .from("trade_offers")
    .select("*, profiles!trade_offers_provider_id_fkey(display_name)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMyOffers() {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await client
    .from("trade_offers")
    .select("*, work_requests(title,stage,owner_id)")
    .eq("provider_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function reviseOffer(offerId, input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("revise_trade_offer", {
    target_offer_id: offerId,
    payload: input,
  });
  if (error) throw error;
  return data;
}

export async function withdrawOffer(offerId) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("withdraw_trade_offer", {
    target_offer_id: offerId,
  });
  if (error) throw error;
}

export async function acceptOffer(offerId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("accept_trade_offer", {
    target_offer_id: offerId,
  });
  if (error) throw error;
  return data;
}

export async function getMyAgreements() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_my_agreements");
  if (error) throw error;
  return data;
}

export async function getAgreementHistory(agreementId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client
    .from("agreement_history")
    .select("*, profiles!agreement_history_actor_id_fkey(display_name)")
    .eq("agreement_id", agreementId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function manageMilestone(
  agreementId,
  expectedVersion,
  action,
  payload,
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("manage_milestone", {
    target_agreement_id: agreementId,
    expected_version: expectedVersion,
    action,
    payload,
  });
  if (error) throw error;
  return data;
}

export async function getProposalQuestions(offerId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client
    .from("proposal_questions")
    .select("*, profiles!proposal_questions_author_id_fkey(display_name)")
    .eq("offer_id", offerId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function askProposalQuestion(offerId, body) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  const { data, error } = await client
    .from("proposal_questions")
    .insert({ offer_id: offerId, author_id: session.user.id, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setAgreementSchedule(
  agreementId,
  expectedVersion,
  payload,
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("set_agreement_schedule", {
    target_agreement_id: agreementId,
    expected_version: expectedVersion,
    payload,
  });
  if (error) throw error;
  return data;
}
export async function getAgreementSchedule(id){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("get_agreement_schedule",{target_agreement_id:id});if(error)throw error;return data;}
export async function proposeScheduleWindow(id,payload){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("propose_schedule_window",{target_agreement_id:id,payload});if(error)throw error;return data;}
export async function respondScheduleWindow(id,response){const client=await getBackend();assertBackend(client);const{error}=await client.rpc("respond_schedule_window",{target_proposal_id:id,response});if(error)throw error;}
export async function saveMyAvailability(payload){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("save_my_availability",{payload});if(error)throw error;return data;}
export async function getAgreementLedger(id){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("get_agreement_ledger",{target_agreement_id:id});if(error)throw error;return data;}
export async function saveLedgerItem(agreementId,itemId,payload){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("save_ledger_item",{target_agreement_id:agreementId,target_item_id:itemId||null,payload});if(error)throw error;return data;}
export async function manageLedgerItem(id,action,payload={}){const client=await getBackend();assertBackend(client);const{error}=await client.rpc("manage_ledger_item",{target_item_id:id,item_action:action,payload});if(error)throw error;}
export async function uploadLedgerReceipt(agreementId,itemId,file){const client=await getBackend();assertBackend(client);const session=await getSession();const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${agreementId}/${session.user.id}/receipt-${crypto.randomUUID()}.${ext}`;const{error}=await client.storage.from("work-evidence").upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;try{await manageLedgerItem(itemId,"receipt",{receipt_path:path});return path;}catch(cause){await client.storage.from("work-evidence").remove([path]);throw cause;}}

export async function getProjectMessages(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client
    .from("project_messages")
    .select("*, profiles!project_messages_author_id_fkey(display_name)")
    .eq("request_id", requestId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function performAgreementAction(
  action,
  agreementId,
  expectedVersion,
  payload = {},
) {
  const allowed = new Set([
    "confirm",
    "scheduled",
    "active",
    "review",
    "completed",
    "milestone",
    "hold",
    "resolve_hold",
    "fulfill",
    "approve",
    "dispute",
    "cancel",
  ]);
  if (!allowed.has(action)) throw new Error("Unsupported agreement action");
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.functions.invoke("wt-agreement-action", {
    body: { action, agreementId, expectedVersion, payload },
  });
  if (error) throw error;
  return data;
}

export async function sendProjectMessage(requestId, body) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to send a message");
  const { data, error } = await client
    .from("project_messages")
    .insert({ request_id: requestId, author_id: session.user.id, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}
