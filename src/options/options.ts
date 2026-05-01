import { GoogleGenAI } from "@google/genai";

const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const modelInput = document.getElementById("model") as HTMLInputElement;
const fallbackModelsInput = document.getElementById(
  "fallback-models",
) as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const testBtn = document.getElementById("test-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const testResult = document.getElementById("test-result") as HTMLDivElement;

chrome.storage.sync
  .get(["apiKey", "model", "fallbackModels"])
  .then(({ apiKey, model, fallbackModels }) => {
    if (apiKey) apiKeyInput.value = apiKey as string;
    if (model) modelInput.value = model as string;
    if (fallbackModels) fallbackModelsInput.value = fallbackModels as string;
  });

document.querySelectorAll<HTMLElement>(".hint code").forEach((chip) => {
  chip.addEventListener("click", () => {
    modelInput.value = chip.textContent ?? "";
    modelInput.focus();
  });
});

saveBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || "gemini-3-flash-preview";
  const fallbackModels = fallbackModelsInput.value.trim();
  await chrome.storage.sync.set({ apiKey, model, fallbackModels });
  statusEl.textContent = "Saved ✓";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
});

testBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const primary = modelInput.value.trim() || "gemini-3-flash-preview";
  const fallbackRaw = fallbackModelsInput.value.trim();
  const fallbacks = fallbackRaw
    ? fallbackRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const models = [...new Set([primary, ...fallbacks])];

  if (!apiKey) {
    renderRows([
      { model: "", status: "err", message: "Enter an API key first." },
    ]);
    return;
  }

  testBtn.disabled = true;
  saveBtn.disabled = true;

  type Row = {
    model: string;
    status: "pending" | "ok" | "err";
    message: string;
  };
  const rows: Row[] = models.map((m) => ({
    model: m,
    status: "pending",
    message: "Testing…",
  }));
  renderRows(rows);

  for (let i = 0; i < models.length; i++) {
    testBtn.textContent = `Testing ${i + 1} / ${models.length}…`;
    try {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: models[i],
        contents: "Respond with the single word: OK",
        config: { temperature: 0, maxOutputTokens: 5 },
      });
      rows[i] = { model: models[i], status: "ok", message: "✓ OK" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rows[i] = { model: models[i], status: "err", message };
    }
    renderRows(rows);
  }

  testBtn.disabled = false;
  testBtn.textContent = "Test models";
  saveBtn.disabled = false;
});

function renderRows(
  rows: { model: string; status: string; message: string }[],
): void {
  testResult.innerHTML = "";
  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "test-row";

    if (row.model) {
      const name = document.createElement("span");
      name.className = "test-model";
      name.textContent = row.model;
      div.appendChild(name);
    }

    const status = document.createElement("span");
    status.className = `test-status ${row.status}`;
    status.textContent = row.message;
    div.appendChild(status);

    testResult.appendChild(div);
  }
  testResult.className = rows.length ? "show" : "";
}
