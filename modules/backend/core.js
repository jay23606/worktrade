import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../config.js";

export const backendConfigured =
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
let clientPromise = null;

export async function getBackend() {
  if (!backendConfigured) return null;
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(
      ({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }),
    );
  }
  return clientPromise;
}

export function assertBackend(client) {
  if (!client)
    throw new Error("WorkTrade is running in device-local demo mode");
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
  const { data, error } = await client
    .from("profiles")
    .select("*, capabilities(*), portfolio_entries(*)")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  if (data.avatar_path) {
    const { data: signed } = await client.storage.from("profile-media").createSignedUrl(data.avatar_path, 3600);
    data.avatar_url = signed?.signedUrl || "";
  }
  data.portfolio_entries = await Promise.all((data.portfolio_entries || []).map(async (entry) => {
    if (!entry.asset_path) return entry;
    const { data: signed } = await client.storage.from("profile-media").createSignedUrl(entry.asset_path, 3600);
    return { ...entry, asset_url: signed?.signedUrl || "" };
  }));
  return data;
}

export async function updateMyProfile(values) {
  const client = await getBackend();
  assertBackend(client);
  const session = await getSession();
  if (!session) throw new Error("Sign in to update your profile");
  const { data, error } = await client.rpc("set_my_profile", {
    payload: values,
  });
  if (error) throw error;
  return data;
}

export async function recordOnboardingState(firstGoal, status = "complete") {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("record_onboarding_state", {
    first_goal_value: firstGoal || null,
    state_value: status,
  });
  if (error) throw error;
  return data;
}

async function normalizedImage(file, maxEdge = 1600) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP image");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image must be smaller than 15 MB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .84));
  if (!blob) throw new Error("Could not prepare that image");
  return blob;
}

export async function uploadProfileAvatar(file, previousPath = null) {
  const client = await getBackend(); assertBackend(client);
  const session = await getSession(); if (!session) throw new Error("Sign in to add a photo");
  const blob = await normalizedImage(file, 900);
  const path = `${session.user.id}/avatar/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await client.storage.from("profile-media").upload(path, blob, { contentType: "image/webp" });
  if (uploadError) throw uploadError;
  const { error } = await client.rpc("set_profile_avatar", { asset_path_value: path });
  if (error) { await client.storage.from("profile-media").remove([path]); throw error; }
  if (previousPath) await client.storage.from("profile-media").remove([previousPath]);
  return path;
}

export async function removeProfileAvatar(path) {
  const client = await getBackend(); assertBackend(client);
  const { error } = await client.rpc("set_profile_avatar", { asset_path_value: null });
  if (error) throw error;
  if (path) await client.storage.from("profile-media").remove([path]);
}

export async function uploadPortfolioImage(entryId, file, previousPath = null) {
  const client = await getBackend(); assertBackend(client);
  const session = await getSession(); if (!session) throw new Error("Sign in to add a photo");
  const blob = await normalizedImage(file);
  const path = `${session.user.id}/portfolio/${entryId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await client.storage.from("profile-media").upload(path, blob, { contentType: "image/webp" });
  if (uploadError) throw uploadError;
  const { error } = await client.rpc("set_portfolio_image", { entry_id: entryId, asset_path_value: path });
  if (error) { await client.storage.from("profile-media").remove([path]); throw error; }
  if (previousPath) await client.storage.from("profile-media").remove([previousPath]);
}

export async function removePortfolioImage(entryId, path) {
  const client = await getBackend(); assertBackend(client);
  const { error } = await client.rpc("set_portfolio_image", { entry_id: entryId, asset_path_value: null });
  if (error) throw error;
  if (path) await client.storage.from("profile-media").remove([path]);
}

export async function signInWithEmail(email) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.href.split("#")[0] },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
