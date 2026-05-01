import { GoogleGenAI } from '@google/genai';

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const fallbackModelsInput = document.getElementById('fallback-models') as HTMLInputElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const testBtn = document.getElementById('test-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const testResult = document.getElementById('test-result') as HTMLDivElement;

chrome.storage.sync.get(['apiKey', 'model', 'fallbackModels']).then(({ apiKey, model, fallbackModels }) => {
  if (apiKey) apiKeyInput.value = apiKey as string;
  if (model) modelInput.value = model as string;
  if (fallbackModels) fallbackModelsInput.value = fallbackModels as string;
});

document.querySelectorAll<HTMLElement>('.hint code').forEach(chip => {
  chip.addEventListener('click', () => {
    modelInput.value = chip.textContent ?? '';
    modelInput.focus();
  });
});

saveBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || 'gemini-3-flash-preview';
  const fallbackModels = fallbackModelsInput.value.trim();
  await chrome.storage.sync.set({ apiKey, model, fallbackModels });
  statusEl.textContent = 'Saved ✓';
  setTimeout(() => { statusEl.textContent = ''; }, 2000);
});

testBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || 'gemini-3-flash-preview';

  if (!apiKey) {
    showTestResult('err', 'Enter an API key first.');
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = 'Testing…';
  testResult.className = '';

  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model,
      contents: 'Respond with the single word: OK',
      config: { temperature: 0, maxOutputTokens: 5 },
    });
    showTestResult('ok', `✓ ${model} is working.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showTestResult('err', `✗ ${message}`);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test model';
  }
});

function showTestResult(type: 'ok' | 'err', message: string): void {
  testResult.textContent = message;
  testResult.className = type;
}
