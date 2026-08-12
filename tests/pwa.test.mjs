import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the installable shell wires a scoped manifest and versioned service worker", async () => {
  const [html, app, manifestSource, worker, deployment] = await Promise.all([
    read("index.html"), read("app.js"), read("manifest.webmanifest"), read("service-worker.js"), read(".github/workflows/pages.yml"),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(app, /serviceWorker\.register\("\.\/service-worker\.js"\)/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some(({ sizes, purpose }) => sizes === "512x512" && purpose === "maskable"));
  assert.match(worker, /const CACHE = "worktrade-v[\da-z]+"/);
  assert.match(worker, /assets\/worktrade-hero\.webp/);
  assert.match(worker, /caches\.match\("\.\/index\.html"\)/);
  assert.match(worker, /SKIP_WAITING/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /navigator\.onLine/);
  assert.match(app, /controllerchange/);
  assert.match(deployment, /manifest\.webmanifest service-worker\.js/);
  assert.match(deployment, /cp -r assets dist\//);
});
