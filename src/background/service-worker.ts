import { GoogleGenAI } from '@google/genai';
import type { MessageToContent, MessageToBackground } from '../types/index';

const SESSION_KEY = 'selectionModeTabs';
const activeControllers = new Map<number, AbortController>();

async function getActiveTabs(): Promise<Set<number>> {
  const result = await chrome.storage.session.get(SESSION_KEY);
  return new Set<number>(result[SESSION_KEY] ?? []);
}

async function setActiveTabs(tabs: Set<number>): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: [...tabs] });
}

async function callGemini(
  html: string,
  apiKey: string,
  model: string,
  signal: AbortSignal,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are a quiz assistant. The following HTML contains a question, which may or may not include answer choices.

If the question has answer choices: identify all correct answers. One answer per line, no numbering, bullets, or extra punctuation.
If the question is free-text (no choices given): respond with the correct answer as concisely as possible — a word, phrase, number, or short sentence as appropriate.

Never add explanation or preamble. Respond with the answer only.

HTML:
${html}
  `.trim();

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: 0.1, abortSignal: signal },
  });

  const answer = response.text?.trim();
  if (!answer) throw new Error('Empty response from Gemini');
  return answer;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const tabId = tab.id;

  const tabs = await getActiveTabs();
  const isActive = tabs.has(tabId);

  if (isActive) {
    tabs.delete(tabId);
    chrome.action.setBadgeText({ text: '', tabId });
  } else {
    tabs.add(tabId);
    chrome.action.setBadgeText({ text: 'ON', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#63B3ED', tabId });
  }

  await setActiveTabs(tabs);
  const msg: MessageToContent = { type: 'TOGGLE_SELECTION_MODE' };
  chrome.tabs.sendMessage(tabId, msg);
});

chrome.runtime.onMessage.addListener((message: MessageToBackground, sender) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (message.type === 'ELEMENT_SELECTED') {
    handleElementSelected(tabId, message.html);
  } else if (message.type === 'SELECTION_CANCELLED') {
    handleSelectionCancelled(tabId);
  } else if (message.type === 'CANCEL_REQUEST') {
    activeControllers.get(tabId)?.abort();
    activeControllers.delete(tabId);
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

async function handleElementSelected(tabId: number, html: string): Promise<void> {
  const tabs = await getActiveTabs();
  tabs.delete(tabId);
  await setActiveTabs(tabs);
  chrome.action.setBadgeText({ text: '', tabId });

  const controller = new AbortController();
  activeControllers.set(tabId, controller);

  try {
    const stored = await chrome.storage.sync.get(['apiKey', 'model', 'fallbackModels']);
    const apiKey = stored.apiKey as string | undefined;

    if (!apiKey) {
      activeControllers.delete(tabId);
      chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_ERROR',
        message: 'No API key set — open extension options to add your Gemini API key.',
      } satisfies MessageToContent);
      return;
    }

    const primaryModel = stored.model as string | undefined;
    if (!primaryModel) {
      activeControllers.delete(tabId);
      chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_ERROR',
        message: 'No model set — open extension options to choose a model.',
      } satisfies MessageToContent);
      return;
    }

    const fallbackModels: string[] = parseFallbackModels(
      stored.fallbackModels as string | undefined,
    );
    const modelsToTry = [...new Set([primaryModel, ...fallbackModels])];

    let lastError: unknown;
    for (const model of modelsToTry) {
      if (controller.signal.aborted) return;

      // Notify the overlay which model we're trying
      if (model !== primaryModel) {
        chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_STATUS',
          message: `Trying fallback ${model}…`,
        } satisfies MessageToContent);
      }

      try {
        const answer = await callGemini(html, apiKey, model, controller.signal);
        activeControllers.delete(tabId);
        chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_ANSWER',
          answer,
        } satisfies MessageToContent);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (model !== modelsToTry[modelsToTry.length - 1]) {
          lastError = err;
          continue; // try next model
        }
        lastError = err;
        break;
      }
    }

    activeControllers.delete(tabId);
    if (lastError instanceof DOMException && (lastError as DOMException).name === 'AbortError')
      return;
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_ERROR',
      message: lastError instanceof Error ? lastError.message : 'Unknown error',
    } satisfies MessageToContent);
  } catch (err) {
    activeControllers.delete(tabId);
    if (err instanceof DOMException && err.name === 'AbortError') return;
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
    } satisfies MessageToContent);
  }
}

function parseFallbackModels(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function handleSelectionCancelled(tabId: number): Promise<void> {
  const tabs = await getActiveTabs();
  tabs.delete(tabId);
  await setActiveTabs(tabs);
  chrome.action.setBadgeText({ text: '', tabId });
}
