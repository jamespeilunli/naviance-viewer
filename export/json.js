/**
 * Serializes parsed scattergram data to a pretty-printed JSON string.
 *
 * @param {object} data - Normalized scattergram data object.
 * @returns {string} Pretty-printed JSON.
 */
export function serializeToJSON(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Triggers a JSON file download in the browser.
 *
 * @param {object} data - Normalized scattergram data object.
 * @param {string} filename - e.g. "boston-university.json"
 */
export function downloadJSON(data, filename) {
  const blob = new Blob([serializeToJSON(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
