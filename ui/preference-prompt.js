/**
 * Shows a one-time preference prompt asking the user whether to auto-parse
 * Naviance scattergram pages. Saves the choice to chrome.storage.sync.
 *
 * @returns {Promise<'always'|'once'|'never'>} The user's choice.
 */
export function showPreferencePrompt() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'naviance-viewer-pref-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      z-index: 2147483646; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 12px; padding: 24px 28px; max-width: 380px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    `;
    modal.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:16px;color:#1a1a1a;">Naviance Viewer detected a scattergram</h3>
      <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.5;">
        Auto-parse scattergram pages and show a summary panel?
      </p>
      <div style="display:flex;gap:8px;flex-direction:column;">
        <button id="naviance-viewer-always" style="padding:10px;border-radius:8px;border:none;background:#1a73e8;color:#fff;font-size:14px;cursor:pointer;">Always auto-parse</button>
        <button id="naviance-viewer-once" style="padding:10px;border-radius:8px;border:1px solid #dadce0;background:#fff;font-size:14px;cursor:pointer;">Just this once</button>
        <button id="naviance-viewer-never" style="padding:10px;border-radius:8px;border:none;background:none;color:#888;font-size:13px;cursor:pointer;">Never</button>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#aaa;">Change this anytime in extension options.</p>
    `;

    overlay.appendChild(modal);
    (document.body ?? document.documentElement).appendChild(overlay);

    function choose(value) {
      overlay.remove();
      chrome.storage.sync.set({ autoParse: value });
      resolve(value);
    }

    modal.querySelector('#naviance-viewer-always').addEventListener('click', () => choose('always'));
    modal.querySelector('#naviance-viewer-once').addEventListener('click', () => choose('once'));
    modal.querySelector('#naviance-viewer-never').addEventListener('click', () => choose('never'));
  });
}
