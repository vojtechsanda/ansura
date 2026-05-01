const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;

chrome.storage.sync.get(['apiKey', 'model']).then(({ apiKey, model }) => {
  if (apiKey) apiKeyInput.value = apiKey as string;
  if (model) modelInput.value = model as string;
});

document.querySelectorAll<HTMLElement>('.hint code').forEach(chip => {
  chip.addEventListener('click', () => {
    modelInput.value = chip.textContent ?? '';
    modelInput.focus();
  });
});

saveBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || 'gemini-2.0-flash';
  await chrome.storage.sync.set({ apiKey, model });
  statusEl.textContent = 'Saved ✓';
  setTimeout(() => { statusEl.textContent = ''; }, 2000);
});
