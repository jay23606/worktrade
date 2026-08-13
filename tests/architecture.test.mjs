import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("application shell delegates matching and PWA lifecycle to feature modules", async () => {
  const [app, matching, messages, network, pwa, deployment, worker] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("features/matching.js", root), "utf8"),
    readFile(new URL("features/messages.js", root), "utf8"),
    readFile(new URL("features/network.js", root), "utf8"),
    readFile(new URL("shell/pwa.js", root), "utf8"),
    readFile(new URL(".github/workflows/pages.yml", root), "utf8"),
    readFile(new URL("service-worker.js", root), "utf8"),
  ]);
  assert.match(app, /createMatchingFeature/);
  assert.match(app, /initializePwa/);
  assert.match(matching, /scorePersonForProfile/);
  assert.match(messages, /conversationPanel/);
  assert.match(network, /hydrateLocalDiscovery/);
  assert.match(pwa, /applyConnectivityState/);
  assert.match(deployment, /cp -r features shell dist/);
  assert.match(worker, /features\/matching\.js/);
  assert.ok(app.split(/\r?\n/).length < 3650, "app.js must keep shrinking as feature modules are extracted");
});
