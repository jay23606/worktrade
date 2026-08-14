import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("application shell delegates matching and PWA lifecycle to feature modules", async () => {
  const [app, matching, messages, network, projects, workspace, communities, profile, dialogs, operations, coordination, notifications, clickHandler, projectClickHandler, socialClickHandler, communityClickHandler, profileClickHandler, managementClickHandler, coordinationClickHandler, coordinationSubmitHandler, networkSubmitHandler, communitySubmitHandler, profileSubmitHandler, pwa, deployment, worker] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("features/matching.js", root), "utf8"),
    readFile(new URL("features/messages.js", root), "utf8"),
    readFile(new URL("features/network.js", root), "utf8"),
    readFile(new URL("features/projects.js", root), "utf8"),
    readFile(new URL("features/workspace.js", root), "utf8"),
    readFile(new URL("features/communities.js", root), "utf8"),
    readFile(new URL("features/profile.js", root), "utf8"),
    readFile(new URL("features/collaboration-dialogs.js", root), "utf8"),
    readFile(new URL("features/operations-dialogs.js", root), "utf8"),
    readFile(new URL("features/project-coordination-dialogs.js", root), "utf8"),
    readFile(new URL("features/notifications.js", root), "utf8"),
    readFile(new URL("features/core-click-handler.js", root), "utf8"),
    readFile(new URL("features/project-click-handler.js", root), "utf8"),
    readFile(new URL("features/social-click-handler.js", root), "utf8"),
    readFile(new URL("features/community-click-handler.js", root), "utf8"),
    readFile(new URL("features/profile-click-handler.js", root), "utf8"),
    readFile(new URL("features/management-click-handler.js", root), "utf8"),
    readFile(new URL("features/coordination-click-handler.js", root), "utf8"),
    readFile(new URL("features/coordination-submit-handler.js", root), "utf8"),
    readFile(new URL("features/network-submit-handler.js", root), "utf8"),
    readFile(new URL("features/community-submit-handler.js", root), "utf8"),
    readFile(new URL("features/profile-submit-handler.js", root), "utf8"),
    readFile(new URL("shell/pwa.js", root), "utf8"),
    readFile(new URL(".github/workflows/pages.yml", root), "utf8"),
    readFile(new URL("service-worker.js", root), "utf8"),
  ]);
  assert.match(app, /createMatchingFeature/);
  assert.match(app, /initializePwa/);
  assert.match(matching, /scorePersonForProfile/);
  assert.match(messages, /conversationPanel/);
  assert.match(network, /hydrateLocalDiscovery/);
  assert.match(projects, /projectWorkspace/);
  assert.match(workspace, /buildJourneyActions/);
  assert.match(communities, /renderChainHub/);
  assert.match(profile, /validateOnboardingCapabilities/);
  assert.match(dialogs, /chainBuilderModal/);
  assert.match(operations, /moderationConsoleModal/);
  assert.match(coordination, /changeOrderHubModal/);
  assert.match(notifications, /notificationGroupSection/);
  assert.match(clickHandler, /handleCoreClick/);
  assert.match(projectClickHandler, /handleProjectClick/);
  assert.match(socialClickHandler, /handleSocialClick/);
  assert.match(communityClickHandler, /handleCommunityClick/);
  assert.match(profileClickHandler, /handleProfileClick/);
  assert.match(managementClickHandler, /handleManagementClick/);
  assert.match(coordinationClickHandler, /handleCoordinationClick/);
  assert.match(coordinationSubmitHandler, /handleCoordinationSubmit/);
  assert.match(networkSubmitHandler, /handleNetworkSubmit/);
  assert.match(communitySubmitHandler, /handleCommunitySubmit/);
  assert.match(profileSubmitHandler, /handleProfileSubmit/);
  assert.match(network, /circleDetail, renderChainHub/);
  assert.match(pwa, /applyConnectivityState/);
  assert.match(deployment, /cp -r features shell dist/);
  assert.match(worker, /features\/matching\.js/);
  assert.match(worker, /features\/projects\.js/);
  assert.match(worker, /features\/workspace\.js/);
  assert.match(worker, /features\/coordination-click-handler\.js/);
  assert.match(worker, /features\/coordination-submit-handler\.js/);
  assert.match(worker, /features\/network-submit-handler\.js/);
  assert.match(worker, /features\/community-submit-handler\.js/);
  assert.match(worker, /features\/profile-submit-handler\.js/);
  assert.ok(app.split(/\r?\n/).length < 1700, "app.js must keep shrinking as feature modules are extracted");
});
