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
    .select("*, capabilities(*)")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
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
