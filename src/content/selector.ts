import type { MessageToBackground } from "../types/index";

let styleInjected = false;
let currentHover: Element | null = null;
let onMouseover: ((e: MouseEvent) => void) | null = null;
let onClick: ((e: MouseEvent) => void) | null = null;
let onKeydown: ((e: KeyboardEvent) => void) | null = null;

function injectStyle(): void {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.textContent = `
    .ansura-hover {
      outline: 1px solid rgba(99, 179, 237, 0.35) !important;
      box-shadow: 0 0 0 3px rgba(99, 179, 237, 0.06) !important;
    }
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

export function activate(onSelected?: () => void): void {
  injectStyle();
  document.body.style.cursor = "crosshair";

  onMouseover = (e: MouseEvent) => {
    if (currentHover) currentHover.classList.remove("ansura-hover");
    currentHover = e.target as Element;
    currentHover.classList.add("ansura-hover");
  };

  onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target as Element;
    // Remove highlight synchronously before deactivate so there's no flicker
    el.classList.remove("ansura-hover");
    currentHover = null;
    deactivate();
    onSelected?.();
    const msg: MessageToBackground = {
      type: "ELEMENT_SELECTED",
      html: el.outerHTML,
    };
    chrome.runtime.sendMessage(msg);
  };

  onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      deactivate();
      const msg: MessageToBackground = { type: "SELECTION_CANCELLED" };
      chrome.runtime.sendMessage(msg);
    }
  };

  document.addEventListener("mouseover", onMouseover);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeydown);
}

export function deactivate(): void {
  if (onMouseover) document.removeEventListener("mouseover", onMouseover);
  if (onClick) document.removeEventListener("click", onClick, true);
  if (onKeydown) document.removeEventListener("keydown", onKeydown);
  onMouseover = null;
  onClick = null;
  onKeydown = null;

  if (currentHover) {
    currentHover.classList.remove("ansura-hover");
    currentHover = null;
  }
  document.body.style.cursor = "";
}
