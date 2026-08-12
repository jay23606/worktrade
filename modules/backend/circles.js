import { getBackend, getSession, assertBackend } from "./core.js";

export async function getCircleHub() {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_circle_hub");
  if (error) throw error;
  return data;
}

export async function createCircle({ name, description, visibility, rules }) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("create_circle", {
    circle_name: name,
    circle_description: description,
    circle_visibility: visibility,
    circle_rules: rules,
  });
  if (error) throw error;
  return data;
}

export async function requestCircleMembership(id) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("request_circle_membership", {
    target_circle_id: id,
  });
  if (error) throw error;
}

export async function inviteCircleMember(circleId, profileId) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("invite_circle_member", {
    target_circle_id: circleId,
    target_profile_id: profileId,
  });
  if (error) throw error;
}

export async function manageCircleMembership(
  circleId,
  profileId,
  action,
  role = null,
) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("manage_circle_membership", {
    target_circle_id: circleId,
    target_profile_id: profileId,
    member_action: action,
    new_role: role,
  });
  if (error) throw error;
}

export async function saveCircleResource(circleId, resourceId, payload) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("save_circle_resource", {
    target_circle_id: circleId,
    resource_id: resourceId,
    payload,
  });
  if (error) throw error;
  return data;
}

export async function deleteCircleResource(id) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("delete_circle_resource", {
    target_resource_id: id,
  });
  if (error) throw error;
}

export async function createCircleRequest(circleId, payload) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("create_circle_request", {
    target_circle_id: circleId,
    payload,
  });
  if (error) throw error;
  return data;
}

export async function updateCircleSettings(
  circleId,
  { description, visibility, rules },
) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("update_circle_settings", {
    target_circle_id: circleId,
    circle_description: description,
    circle_visibility: visibility,
    circle_rules: rules,
  });
  if (error) throw error;
}
