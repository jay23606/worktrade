import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the installable shell wires a scoped manifest and versioned service worker", async () => {
  const [html, app, pwa, manifestSource, worker, deployment] = await Promise.all([
    read("index.html"), read("app.js"), read("shell/pwa.js"), read("manifest.webmanifest"), read("service-worker.js"), read(".github/workflows/pages.yml"),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(pwa, /serviceWorker\.register\("\.\/service-worker\.js"\)/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.id, "/worktrade/");
  assert.equal(manifest.start_url, "/worktrade/");
  assert.equal(manifest.scope, "/worktrade/");
  assert.ok(manifest.icons.some(({ sizes, purpose }) => sizes === "512x512" && purpose === "maskable"));
  assert.match(worker, /const CACHE_PREFIX = "worktrade-"/);
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(worker, /assets\/worktrade-hero\.webp/);
  assert.match(worker, /caches\.match\("\.\/index\.html"\)/);
  assert.match(worker, /SKIP_WAITING/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /navigator\.onLine/);
  assert.match(pwa, /controllerchange/);
  assert.match(deployment, /manifest\.webmanifest service-worker\.js/);
  assert.match(deployment, /cp -r assets dist\//);
});
