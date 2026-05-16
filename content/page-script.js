/**
 * page-script.js
 *
 * Injected into the page's JavaScript context by content.js.
 * Wraps window.fetch and XMLHttpRequest to intercept Naviance scattergram
 * API responses and post them to the content script via window.postMessage.
 *
 * IMPORTANT: This file must NOT use any Chrome extension APIs (chrome.*).
 * It runs in the page context, not the extension context.
 */
(function () {
  const SCATTERGRAM_URL_PATTERN = /application-statistics/i;
  const MESSAGE_TYPE = 'NAVIANCE_VIEWER_INTERCEPT';

  function postIntercepted(rawText, sourceUrl) {
    try {
      const json = JSON.parse(rawText);
      window.postMessage({ type: MESSAGE_TYPE, data: json, url: sourceUrl }, '*');
    } catch {
      // Not JSON — not the API response we want
    }
  }

  // --- Wrap fetch ---
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? '';

    if (SCATTERGRAM_URL_PATTERN.test(url)) {
      const clone = response.clone();
      clone.text().then(text => postIntercepted(text, url)).catch(() => {});
    }

    return response;
  };

  // --- Wrap XMLHttpRequest ---
  const OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OriginalXHR();
    let capturedUrl = '';

    const originalOpen = xhr.open.bind(xhr);
    xhr.open = function (method, url, ...rest) {
      capturedUrl = url;
      return originalOpen(method, url, ...rest);
    };

    xhr.addEventListener('load', function () {
      if (SCATTERGRAM_URL_PATTERN.test(capturedUrl)) {
        postIntercepted(xhr.responseText, capturedUrl);
      }
    });

    return xhr;
  }
  Object.defineProperties(PatchedXHR, Object.getOwnPropertyDescriptors(OriginalXHR));
  window.XMLHttpRequest = PatchedXHR;
})();
