let pptxGenLoadPromise = null;

async function ensurePptxGenLoaded() {
  if (typeof PptxGenJS === "function") return;
  if (!pptxGenLoadPromise) {
    pptxGenLoadPromise = loadScriptWithFallback("jszip.min.js", "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js")
      .then(() => loadScriptWithFallback("pptxgen.min.js", "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.min.js"))
      .then(() => {
        if (typeof PptxGenJS !== "function") {
          throw new Error("PptxGenJS global was not created.");
        }
      })
      .catch((error) => {
        pptxGenLoadPromise = null;
        throw error;
      });
  }
  await pptxGenLoadPromise;
}

function loadScriptWithFallback(localSrc, fallbackSrc) {
  return loadScriptOnce(localSrc).catch(() => loadScriptOnce(fallbackSrc));
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.dynamicSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}
