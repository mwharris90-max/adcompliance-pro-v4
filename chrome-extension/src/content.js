// Content script: detects ad content on Meta Ads Manager and Google Ads
// Adds a "Check Compliance" button overlay on detected ads

(function () {
  const BUTTON_CLASS = "acp-check-btn";

  // Debounce observer callbacks
  let debounceTimer = null;
  function debounce(fn, ms) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
  }

  // Create the compliance check button
  function createCheckButton(adData) {
    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.textContent = "Check Compliance";
    btn.title = "Check this ad with Ad Compliance Pro";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      chrome.runtime.sendMessage({
        type: "FILL_AD_CONTENT",
        headline: adData.headline || "",
        body: adData.body || "",
        cta: adData.cta || "",
      });
      // Open the popup (can't programmatically open, so notify user)
      btn.textContent = "Copied! Open extension";
      setTimeout(() => {
        btn.textContent = "Check Compliance";
      }, 2000);
    });
    return btn;
  }

  // Meta Ads Manager detection
  function scanMetaAds() {
    // Meta Ads Manager ad preview cards
    const adPreviews = document.querySelectorAll('[data-testid="ad-preview-container"], [class*="adPreview"]');
    adPreviews.forEach((preview) => {
      if (preview.querySelector(`.${BUTTON_CLASS}`)) return;

      const headline = preview.querySelector('[class*="headline"], [class*="title"]')?.textContent?.trim() || "";
      const body = preview.querySelector('[class*="primaryText"], [class*="body"]')?.textContent?.trim() || "";
      const cta = preview.querySelector('[class*="callToAction"], button[class*="cta"]')?.textContent?.trim() || "";

      if (!headline && !body) return;

      const btn = createCheckButton({ headline, body, cta });
      preview.style.position = "relative";
      preview.appendChild(btn);
    });
  }

  // Google Ads detection
  function scanGoogleAds() {
    // Google Ads Editor panels with RSA content
    const adRows = document.querySelectorAll('[class*="ad-preview"], [class*="creative-preview"]');
    adRows.forEach((row) => {
      if (row.querySelector(`.${BUTTON_CLASS}`)) return;

      const headlines = [];
      const descriptions = [];

      row.querySelectorAll('[class*="headline"]').forEach((el) => {
        const text = el.textContent?.trim();
        if (text) headlines.push(text);
      });
      row.querySelectorAll('[class*="description"]').forEach((el) => {
        const text = el.textContent?.trim();
        if (text) descriptions.push(text);
      });

      if (headlines.length === 0 && descriptions.length === 0) return;

      const btn = createCheckButton({
        headline: headlines.join(" | "),
        body: descriptions.join(" "),
        cta: "",
      });
      row.style.position = "relative";
      row.appendChild(btn);
    });
  }

  // Scan based on current URL
  function scan() {
    const url = window.location.href;
    if (url.includes("facebook.com") || url.includes("business.facebook.com")) {
      scanMetaAds();
    } else if (url.includes("ads.google.com")) {
      scanGoogleAds();
    }
  }

  // Watch for DOM changes
  const observer = new MutationObserver(() => {
    debounce(scan, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial scan
  scan();
})();
