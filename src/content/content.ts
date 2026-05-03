import { activate, deactivate } from './selector';
import { showAnswer, showError, showLoading, showStatus, hide, setOpacity } from './overlay';
import type { MessageToContent, MessageToBackground } from '../types/index';

let isSelectionModeActive = false;
let waitingForResponse = false;

chrome.storage.sync.get('overlayOpacity').then(({ overlayOpacity }) => {
  if (typeof overlayOpacity === 'number') setOpacity(overlayOpacity);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.overlayOpacity) {
    setOpacity(changes.overlayOpacity.newValue as number);
  }
});

chrome.runtime.onMessage.addListener((message: MessageToContent) => {
  switch (message.type) {
    case 'TOGGLE_SELECTION_MODE':
      if (isSelectionModeActive) {
        isSelectionModeActive = false;
        deactivate();
      } else {
        isSelectionModeActive = true;
        activate(() => {
          isSelectionModeActive = false;
          waitingForResponse = true;
          showLoading(() => {
            waitingForResponse = false;
            const msg: MessageToBackground = { type: 'CANCEL_REQUEST' };
            chrome.runtime.sendMessage(msg);
          });
        });
      }
      break;
    case 'SHOW_ANSWER':
      if (!waitingForResponse) break;
      waitingForResponse = false;
      showAnswer(message.answer);
      break;
    case 'SHOW_STATUS':
      if (waitingForResponse) showStatus(message.message);
      break;
    case 'SHOW_ERROR':
      if (!waitingForResponse) {
        hide();
        break;
      }
      waitingForResponse = false;
      showError(message.message);
      break;
  }
});
