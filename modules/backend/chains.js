import { getBackend, getSession, assertBackend } from "./core.js";

export async function getTradeChainHub(circleId) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("get_trade_chain_hub", {
    target_circle_id: circleId,
  });
  if (error) throw error;
  return data;
}

export async function createTradeChain(
  circleId,
  { title, description, executionMode, links },
) {
  const client = await getBackend();
  assertBackend(client);
  const { data, error } = await client.rpc("create_trade_chain", {
    target_circle_id: circleId,
    chain_title: title,
    chain_description: description,
    execution_value: executionMode,
    links,
  });
  if (error) throw error;
  return data;
}

export async function reviseTradeChain(id, version, payload) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("revise_trade_chain", {
    target_chain_id: id,
    expected_version: version,
    payload,
  });
  if (error) throw error;
}

export async function acceptTradeChain(id, version) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("accept_trade_chain", {
    target_chain_id: id,
    expected_version: version,
  });
  if (error) throw error;
}

export async function activateTradeChain(id) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("activate_trade_chain", {
    target_chain_id: id,
  });
  if (error) throw error;
}

export async function manageTradeChainLink(id, action, note = "") {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("manage_trade_chain_link", {
    target_link_id: id,
    link_action: action,
    note,
  });
  if (error) throw error;
}

export async function manageTradeChain(id, action, payload = {}) {
  const client = await getBackend();
  assertBackend(client);
  const { error } = await client.rpc("manage_trade_chain", {
    target_chain_id: id,
    chain_action: action,
    payload,
  });
  if (error) throw error;
}
