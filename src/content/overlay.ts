const STYLES = `
  :host { all: initial; }

  @keyframes ansura-spin { to { transform: rotate(360deg); } }

  #ansura-root {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 2147483647;
    background: rgba(10, 10, 14, 0.6);
    color: rgba(255, 255, 255, 0.7);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    padding: 6px 10px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    max-width: 220px;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  #ansura-root.visible { opacity: 0.6; }

  .ansura-spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    border-top-color: rgba(255, 255, 255, 0.75);
    border-radius: 50%;
    animation: ansura-spin 0.65s linear infinite;
    margin-right: 6px;
    vertical-align: middle;
  }

  ul {
    margin: 0;
    padding-left: 13px;
  }

  li + li { margin-top: 2px; }
`;

let shadowHost: HTMLElement | null = null;
let ansuraRoot: HTMLElement | null = null;
let isDismissable = false;

function mount(): HTMLElement {
  if (ansuraRoot) return ansuraRoot;

  shadowHost = document.createElement('div');
  const shadow = shadowHost.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = STYLES;

  ansuraRoot = document.createElement('div');
  ansuraRoot.id = 'ansura-root';

  shadow.appendChild(style);
  shadow.appendChild(ansuraRoot);
  document.body.appendChild(shadowHost);
  return ansuraRoot;
}

function makeDismissable(): void {
  if (isDismissable) return;
  isDismissable = true;
  document.addEventListener('keydown', hide, { once: true });
  document.addEventListener('click', hide, { once: true });
}

export function showLoading(onCancel: () => void): void {
  isDismissable = false;
  const el = mount();
  el.innerHTML = '';
  const spinner = document.createElement('span');
  spinner.className = 'ansura-spinner';
  el.appendChild(spinner);
  el.appendChild(document.createTextNode('Thinking…'));
  requestAnimationFrame(() => el.classList.add('visible'));

  document.addEventListener('click', () => {
    hide();
    onCancel();
  }, { once: true });
}

export function showStatus(message: string): void {
  if (!ansuraRoot) return;
  ansuraRoot.innerHTML = '';
  const spinner = document.createElement('span');
  spinner.className = 'ansura-spinner';
  ansuraRoot.appendChild(spinner);
  ansuraRoot.appendChild(document.createTextNode(message));
}

export function showAnswer(answer: string): void {
  const lines = answer.split('\n').map(l => l.trim()).filter(Boolean);
  const el = mount();
  el.innerHTML = '';

  if (lines.length > 1) {
    const ul = document.createElement('ul');
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    }
    el.appendChild(ul);
  } else {
    el.textContent = lines[0] ?? answer;
  }

  requestAnimationFrame(() => el.classList.add('visible'));
  makeDismissable();
}

export function showError(message: string): void {
  const el = mount();
  el.textContent = `Error: ${message}`;
  requestAnimationFrame(() => el.classList.add('visible'));
  makeDismissable();
}

export function hide(): void {
  if (!ansuraRoot) return;
  isDismissable = false;
  ansuraRoot.classList.remove('visible');
  ansuraRoot.addEventListener(
    'transitionend',
    () => {
      shadowHost?.remove();
      shadowHost = null;
      ansuraRoot = null;
    },
    { once: true },
  );
}
