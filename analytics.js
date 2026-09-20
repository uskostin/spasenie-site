(function () {
  const measurementId = "G-4TMTXQZ8P9";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
  document.addEventListener("click", function (event) {
    const link = event.target.closest("a[href],button[data-lang]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    let eventName = "";
    let method = "";
    if (href.startsWith("tel:")) { eventName = "contact_click"; method = "phone"; }
    else if (href.startsWith("mailto:")) { eventName = "contact_click"; method = "email"; }
    else if (/maps\.google\.com|google\.com\/maps/.test(href)) { eventName = "directions_click"; method = "google_maps"; }
    else if (link.classList.contains("lang-link") || link.dataset.lang) { eventName = "language_switch"; method = link.hreflang || link.dataset.lang || "unknown"; }
    if (eventName) window.gtag("event", eventName, { interaction_type: method });
  });
})();
