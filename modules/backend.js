import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.js";

export const backendConfigured = !SUPABASE_URL.includes("YOUR_PROJECT") && !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
let clientPromise = null;

export async function getBackend() {
  if (!backendConfigured) return null;
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  }
  return clientPromise;
}

function assertBackend(client) {
  if (!client) throw new Error("WorkTrade is running in device-local demo mode");
}

export async function getSession() {
  const client = await getBackend();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getMyProfile() {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await client.from("profiles").select("*, capabilities(*)").eq("id", session.user.id).single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(values) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to update your profile");
  const { data, error } = await client.rpc("set_my_profile", { payload: values });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
  if (error) throw error;
}

export async function signOut() {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function listPublicRequests({ query = "", kind = null } = {}) {
  const client = await getBackend();
  assertBackend(client);
  let builder = client.from("work_requests").select("*, profiles!work_requests_owner_id_fkey(display_name), work_request_skills(skill)").eq("stage", "open").eq("visibility", "public").order("created_at", { ascending: false }).limit(50);
  if (query) builder = builder.textSearch("search_document", query, { type: "websearch" });
  if (kind) builder = builder.eq("kind", kind);
  const { data, error } = await builder;
  if (error) throw error;
  return data;
}

export async function createRequest(input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("create_work_request", { payload: input });
  if (error) throw error;
  return data;
}

export async function updateRequest(requestId, expectedVersion, input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("update_work_request", { target_request_id: requestId, expected_version: expectedVersion, payload: input });
  if (error) throw error;
  return data;
}

export async function uploadRequestMedia(requestId,file,caption=""){
  const client=await getBackend();assertBackend(client);const session=await getSession();if(!session)throw new Error("Sign in to upload photos");
  const extension=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${requestId}/${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const {error:uploadError}=await client.storage.from("request-media").upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
  const {data,error}=await client.from("request_media").insert({request_id:requestId,uploader_id:session.user.id,asset_path:path,caption}).select().single();if(error){await client.storage.from("request-media").remove([path]);throw error}return data;
}

export async function getRequestMedia(requestId){const client=await getBackend();assertBackend(client);const {data,error}=await client.from("request_media").select("*").eq("request_id",requestId).order("position");if(error)throw error;return Promise.all(data.map(async(item)=>{const {data:signed,error:signedError}=await client.storage.from("request-media").createSignedUrl(item.asset_path,900);if(signedError)throw signedError;return {...item,url:signed.signedUrl}}))}
export async function manageRequestMedia(mediaId,action,payload={}){const client=await getBackend();assertBackend(client);const{error}=await client.rpc("manage_request_media",{target_media_id:mediaId,action,payload});if(error)throw error}

export async function closeRequest(requestId, expectedVersion, action) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("close_work_request", { target_request_id: requestId, expected_version: expectedVersion, requested_action: action });
  if (error) throw error;
  return data;
}

export async function requestLifecycleAction(requestId,expectedVersion,action){const client=await getBackend();assertBackend(client);const {data,error}=await client.rpc("request_lifecycle_action",{target_request_id:requestId,expected_version:expectedVersion,requested_action:action});if(error)throw error;return data}
export async function getMyRequests(){const client=await getBackend();assertBackend(client);const session=await getSession();if(!session)return[];const{data,error}=await client.from("work_requests").select("*, work_request_skills(skill)").eq("owner_id",session.user.id).order("updated_at",{ascending:false});if(error)throw error;return data}

export async function submitOffer(requestId, input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("submit_trade_offer", { target_request_id: requestId, payload: input });
  if (error) throw error;
  return data;
}

export async function proposeAmendment(agreementId, expectedVersion, input) {
  const client=await getBackend(); assertBackend(client);
  const {data,error}=await client.rpc("propose_agreement_amendment",{target_agreement_id:agreementId,expected_version:expectedVersion,payload:input});
  if(error) throw error; return data;
}

export async function respondAmendment(amendmentId, accept) {
  const client=await getBackend(); assertBackend(client);
  const {data,error}=await client.rpc("respond_agreement_amendment",{target_amendment_id:amendmentId,accept});
  if(error) throw error; return data;
}

export async function getAgreementAmendments(agreementId) {
  const client=await getBackend();assertBackend(client);
  const {data,error}=await client.from("agreement_amendments").select("*").eq("agreement_id",agreementId).order("created_at",{ascending:false});
  if(error)throw error;return data;
}

export async function handleCompletion(agreementId, expectedVersion, action) {
  const client=await getBackend(); assertBackend(client);
  const {data,error}=await client.rpc("handle_completion",{target_agreement_id:agreementId,expected_version:expectedVersion,action});
  if(error) throw error; return data;
}

export async function addProjectUpdate(requestId, body, visibility="participants") {
  const client=await getBackend(); assertBackend(client);
  const {data,error}=await client.rpc("add_project_update",{target_request_id:requestId,body_text:body,update_visibility:visibility});
  if(error) throw error; return data;
}

export async function getProjectUpdates(requestId) {
  const client=await getBackend(); assertBackend(client);
  const {data,error}=await client.from("project_updates").select("*, profiles!project_updates_author_id_fkey(display_name)").eq("request_id",requestId).order("created_at");
  if(error) throw error; return data;
}

export async function getRequestOffers(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.from("trade_offers").select("*, profiles!trade_offers_provider_id_fkey(display_name)").eq("request_id", requestId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMyOffers(){const client=await getBackend();assertBackend(client);const session=await getSession();if(!session)return[];const{data,error}=await client.from("trade_offers").select("*, work_requests(title,stage,owner_id)").eq("provider_id",session.user.id).order("created_at",{ascending:false});if(error)throw error;return data}
export async function reviseOffer(offerId,input){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("revise_trade_offer",{target_offer_id:offerId,payload:input});if(error)throw error;return data}
export async function withdrawOffer(offerId){const client=await getBackend();assertBackend(client);const{error}=await client.rpc("withdraw_trade_offer",{target_offer_id:offerId});if(error)throw error}

export async function acceptOffer(offerId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("accept_trade_offer", { target_offer_id: offerId });
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

export async function getAgreementHistory(agreementId){const client=await getBackend();assertBackend(client);const{data,error}=await client.from("agreement_history").select("*, profiles!agreement_history_actor_id_fkey(display_name)").eq("agreement_id",agreementId).order("created_at");if(error)throw error;return data}
export async function manageMilestone(agreementId,expectedVersion,action,payload){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("manage_milestone",{target_agreement_id:agreementId,expected_version:expectedVersion,action,payload});if(error)throw error;return data}
export async function getProposalQuestions(offerId){const client=await getBackend();assertBackend(client);const{data,error}=await client.from("proposal_questions").select("*, profiles!proposal_questions_author_id_fkey(display_name)").eq("offer_id",offerId).order("created_at");if(error)throw error;return data}
export async function askProposalQuestion(offerId,body){const client=await getBackend();assertBackend(client);const session=await getSession();const{data,error}=await client.from("proposal_questions").insert({offer_id:offerId,author_id:session.user.id,body}).select().single();if(error)throw error;return data}
export async function setAgreementSchedule(agreementId,expectedVersion,payload){const client=await getBackend();assertBackend(client);const{data,error}=await client.rpc("set_agreement_schedule",{target_agreement_id:agreementId,expected_version:expectedVersion,payload});if(error)throw error;return data}

export async function getProjectMessages(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.from("project_messages").select("*, profiles!project_messages_author_id_fkey(display_name)").eq("request_id", requestId).order("created_at");
  if (error) throw error;
  return data;
}

export async function performAgreementAction(action, agreementId, expectedVersion, payload = {}) {
  const allowed = new Set(["confirm", "scheduled", "active", "review", "completed", "milestone", "hold", "resolve_hold", "fulfill", "approve", "dispute", "cancel"]);
  if (!allowed.has(action)) throw new Error("Unsupported agreement action");
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.functions.invoke("wt-agreement-action", { body: { action, agreementId, expectedVersion, payload } });
  if (error) throw error;
  return data;
}

export async function submitReview(input) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to leave feedback");
  const { data, error } = await client.from("work_reviews").insert({ ...input, reviewer_id: session.user.id }).select().single();
  if (error) throw error;
  return data;
}

export async function uploadWorkEvidence(agreementId, file, { skill, description }) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to add evidence");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${agreementId}/${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from("work-evidence").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client.from("work_evidence").insert({ agreement_id: agreementId, contributor_id: session.user.id, skill, description, asset_path: path }).select().single();
  if (error) {
    await client.storage.from("work-evidence").remove([path]);
    throw error;
  }
  return data;
}

export async function getEvidenceUrl(path) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.storage.from("work-evidence").createSignedUrl(path, 900);
  if (error) throw error;
  return data.signedUrl;
}

export async function getNotifications() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_my_notifications");
  if (error) throw error;
  return data.map((row) => row.notification);
}

export async function markNotificationsRead(ids = null) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("mark_notifications_read", { notification_ids: ids });
  if (error) throw error;
  return data;
}

export async function getNotificationPreferences() {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await client.from("notification_preferences").select("*").eq("profile_id", session.user.id).maybeSingle();
  if (error) throw error;
  return data || { profile_id: session.user.id, in_app: true, email_proposals: true, email_messages: true, email_agreements: true, email_reminders: false };
}

export async function saveNotificationPreferences(values) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to save preferences");
  const { data, error } = await client.from("notification_preferences").upsert({ ...values, profile_id: session.user.id, updated_at: new Date().toISOString() }).select().single();
  if (error) throw error;
  return data;
}

export async function exportMyData() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("export_my_data");
  if (error) throw error;
  return data;
}

export async function deactivateMyAccount() {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("deactivate_my_account");
  if (error) throw error;
  await client.auth.signOut();
}

export async function sendProjectMessage(requestId, body) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to send a message");
  const { data, error } = await client.from("project_messages").insert({ request_id: requestId, author_id: session.user.id, body }).select().single();
  if (error) throw error;
  return data;
}
