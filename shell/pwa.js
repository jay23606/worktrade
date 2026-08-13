export function initializePwa({ notify }) {
  let installPrompt = null;
  let waitingWorker = null;
  let updateRequested = false;
  const installButton = document.querySelector("#install-app");
  const connectionBanner = document.querySelector("#connection-banner");
  const updateBanner = document.querySelector("#update-banner");
  const applyConnectivityState = (announce = false) => {
    const offline = !navigator.onLine;
    document.body.classList.toggle("is-offline", offline);
    connectionBanner.hidden = !offline;
    connectionBanner.querySelector("span").textContent = offline
      ? "You’re offline. Browsing and device-local work remain available; connected changes are paused."
      : "Back online.";
    document.querySelectorAll("[data-connected-action]").forEach((control) => {
      control.disabled = offline;
      control.title = offline ? "Reconnect to use this feature" : "";
    });
    if (announce) notify(offline ? "WorkTrade is offline" : "Connection restored", offline ? "warning" : "success");
  };
  addEventListener("online", () => applyConnectivityState(true));
  addEventListener("offline", () => applyConnectivityState(true));
  document.querySelector("#retry-connection").addEventListener("click", () => applyConnectivityState(true));
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
    if (choice.outcome === "accepted") notify("WorkTrade installed", "success");
  });
  addEventListener("appinstalled", () => {
    installButton.hidden = true;
    notify("WorkTrade installed", "success");
  });
  document.querySelector("#apply-update").addEventListener("click", () => {
    updateRequested = true;
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  });
  if ("serviceWorker" in navigator) addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
    const showUpdate = (worker) => {
      waitingWorker = worker;
      updateBanner.hidden = false;
    };
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !updateRequested) return;
      refreshing = true;
      location.reload();
    });
  });
  return { applyConnectivityState };
}
