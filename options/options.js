async function loadSettings() {
  const { autoParse, captureMode } = await chrome.storage.sync.get({
    autoParse: null,
    captureMode: false,
  });

  // null = ask each time (first-run or reset state); 'once' is transient, treat as 'ask'
  const dropdownValue = (autoParse === null || autoParse === 'once') ? 'ask' : autoParse;
  document.getElementById('autoParse').value = dropdownValue;
  document.getElementById('captureMode').checked = captureMode;
}

document.getElementById('save').addEventListener('click', async () => {
  const rawValue = document.getElementById('autoParse').value;
  const captureMode = document.getElementById('captureMode').checked;

  // 'ask' maps back to null (the "prompt each time" sentinel in content.js)
  const autoParse = rawValue === 'ask' ? null : rawValue;

  await chrome.storage.sync.set({ autoParse, captureMode });

  const status = document.getElementById('status');
  status.textContent = 'Saved.';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

loadSettings();
