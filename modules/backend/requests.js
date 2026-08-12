import { getBackend, getSession, assertBackend } from "./core.js";

export async function listPublicRequests({ query = "", kind = null } = {}) {
  const client = await getBackend();
  assertBackend(client);
  let builder = client
    .from("work_requests")
    .select(
      "*, profiles!work_requests_owner_id_fkey(display_name), work_request_skills(skill)",
    )
    .eq("stage", "open")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);
  if (query)
    builder = builder.textSearch("search_document", query, {
      type: "websearch",
    });
  if (kind) builder = builder.eq("kind", kind);
  const { data, error } = await builder;
  if (error) throw error;
  return data;
}

export async function createRequest(input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("create_work_request", {
    payload: input,
  });
  if (error) throw error;
  return data;
}

export async function updateRequest(requestId, expectedVersion, input) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("update_work_request", {
    target_request_id: requestId,
    expected_version: expectedVersion,
    payload: input,
  });
  if (error) throw error;
  return data;
}

export async function uploadRequestMedia(requestId, file, caption = "") {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to upload photos");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${requestId}/${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage
    .from("request-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client
    .from("request_media")
    .insert({
      request_id: requestId,
      uploader_id: session.user.id,
      asset_path: path,
      caption,
    })
    .select()
    .single();
  if (error) {
    await client.storage.from("request-media").remove([path]);
    throw error;
  }
  return data;
}

export async function getRequestMedia(requestId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client
    .from("request_media")
    .select("*")
    .eq("request_id", requestId)
    .order("position");
  if (error) throw error;
  return Promise.all(
    data.map(async (item) => {
      const { data: signed, error: signedError } = await client.storage
        .from("request-media")
        .createSignedUrl(item.asset_path, 900);
      if (signedError) throw signedError;
      return { ...item, url: signed.signedUrl };
    }),
  );
}

export async function manageRequestMedia(mediaId, action, payload = {}) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("manage_request_media", {
    target_media_id: mediaId,
    action,
    payload,
  });
  if (error) throw error;
}

export async function closeRequest(requestId, expectedVersion, action) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("close_work_request", {
    target_request_id: requestId,
    expected_version: expectedVersion,
    requested_action: action,
  });
  if (error) throw error;
  return data;
}

export async function requestLifecycleAction(
  requestId,
  expectedVersion,
  action,
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("request_lifecycle_action", {
    target_request_id: requestId,
    expected_version: expectedVersion,
    requested_action: action,
  });
  if (error) throw error;
  return data;
}

export async function getMyRequests() {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await client
    .from("work_requests")
    .select("*, work_request_skills(skill)")
    .eq("owner_id", session.user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}
