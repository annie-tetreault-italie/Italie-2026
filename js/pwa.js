// Mon Carnet de Voyages — PWA 0.9.6.0
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) document.body.classList.add("pwa-standalone");

  const splash = $("pwaSplash");
  if (splash && isStandalone && !sessionStorage.getItem("pwaSplashShown")) {
    splash.setAttribute("aria-hidden", "false");
    splash.classList.add("is-visible");
    sessionStorage.setItem("pwaSplashShown", "1");
    window.setTimeout(() => {
      splash.classList.remove("is-visible");
      splash.setAttribute("aria-hidden", "true");
    }, 1100);
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./service-worker.js", {scope: "./"});
        console.info("[PWA] Service Worker actif :", registration.scope);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              document.dispatchEvent(new CustomEvent("pwa:update-ready"));
            }
          });
        });
      } catch (error) {
        console.warn("[PWA] Service Worker non enregistré :", error);
      }
    });
  }

  let deferredPrompt = null;
  const banner = $("pwaInstallBanner");
  const installButton = $("pwaInstallButton");
  const dismissButton = $("pwaInstallDismiss");
  const iosModal = $("pwaIosModal");

  function wasDismissed(){
    return sessionStorage.getItem("pwaInstallDismissed") === "1";
  }

  function showBanner(){
    if (!banner || isStandalone || wasDismissed()) return;
    banner.hidden = false;
  }

  function hideBanner(){
    if (banner) banner.hidden = true;
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    showBanner();
  });

  if (isIos && !isStandalone) {
    window.setTimeout(showBanner, 1600);
  }

  installButton?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideBanner();
      return;
    }
    if (isIos && iosModal) {
      iosModal.hidden = false;
      return;
    }
  });

  dismissButton?.addEventListener("click", () => {
    sessionStorage.setItem("pwaInstallDismissed", "1");
    hideBanner();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-pwa-close]")) return;
    if (iosModal) iosModal.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    hideBanner();
    deferredPrompt = null;
  });

  // Ouvre le bon onglet lorsqu'un raccourci du manifeste est utilisé.
  window.addEventListener("load", () => {
    const panel = location.hash.replace("#", "");
    if (panel && typeof window.showPanel === "function") {
      window.setTimeout(() => window.showPanel(panel), 300);
    }
  });
})();
