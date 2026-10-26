// 共用小工具：建立 DOM／SVG 元素、事件匯流排、文字寬度估算、狀態分類
export const SVGNS = 'http://www.w3.org/2000/svg';

function setAttrs(node, attrs) {
  if (!attrs) return;
  Object.keys(attrs).forEach((k) => {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  });
}
function appendAll(node, children) {
  if (children === null || children === undefined) return;
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
}
export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  appendAll(node, children);
  return node;
}
export function svg(tag, attrs, children) {
  const node = document.createElementNS(SVGNS, tag);
  setAttrs(node, attrs);
  appendAll(node, children);
  return node;
}

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// 元件之間用事件溝通，避免互相 import 造成循環
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));

// 產生器（tools/gen-islands.mjs）會在 Node 裡 import 本檔，沒有 window 時一律視為不減少動態
const motionQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => !!(motionQuery && motionQuery.matches);

// 文字寬度估算（以一個中文字寬為 1）
export function textUnits(text) {
  let u = 0;
  for (const ch of text) u += /[\u0000-ÿ]/.test(ch) ? (ch === ' ' ? 0.3 : 0.6) : 1;
  return u;
}

// 地圖節點用的短名稱：去掉全形括號說明；太長時取第一個空格前的部分。完整名稱在詳情卡與清單。
export function shortName(name) {
  const s = name.replace(/（[^）]*）/g, '').trim();
  if (textUnits(s) <= 11) return s;
  const head = s.split(' ')[0];
  return head || s;
}

// 依字數斷行（給告示牌等小區塊用），右括號與句讀不放行首
export function wrapChars(text, perLine) {
  const lines = [];
  let cur = '';
  let width = 0;
  for (const ch of text) {
    const w = /[\u0000-ÿ]/.test(ch) ? 0.55 : 1;
    if (width + w > perLine && cur && !/[）)。，、」]/.test(ch)) {
      lines.push(cur);
      cur = '';
      width = 0;
    }
    cur += ch;
    width += w;
  }
  if (cur) lines.push(cur);
  return lines;
}

// 狀態分類：每件作品的 statusKey 對照 works.json 的 statusLegend（符號、名稱、meaning 都在資料檔）。
// 顏色之外一律附圖示與文字；篩選鈕等短名稱在 works.json 的 ui.status
let legend = [];
export function setStatusLegend(list) { legend = Array.isArray(list) ? list : []; }
export const statusKinds = () => legend.map((s) => s.key);
export const statusEntry = (kind) => legend.find((s) => s.key === kind) || null;
export function statusKind(w) {
  return statusEntry(w.statusKey) ? w.statusKey : (console.warn('[狀態] statusKey 不在 statusLegend 裡：', w.id, w.statusKey), 'unknown');
}

// 符號畫法（16×16）：用 SVG 畫，不依賴字型。資料檔換了沒畫過的符號時，直接顯示該字元
const ICON_PATHS = {
  '✓': [['path', { d: 'M3 8.5 L6.5 12 L13 4.5', class: 'si-stroke' }]],
  '◐': [['circle', { cx: 8, cy: 8, r: 5.6, class: 'si-stroke' }], ['path', { d: 'M8 2.4 A5.6 5.6 0 0 1 8 13.6 Z', class: 'si-fill' }]],
  '❄': [['path', { d: 'M8 1.8 V14.2 M2.6 4.9 L13.4 11.1 M2.6 11.1 L13.4 4.9 M6.2 2.8 L8 4.4 L9.8 2.8 M6.2 13.2 L8 11.6 L9.8 13.2', class: 'si-stroke' }]]
};
function iconParts(kind) {
  const e = statusEntry(kind);
  const sym = e ? e.symbol : '?';
  return ICON_PATHS[sym] ? ICON_PATHS[sym].map(([tag, a]) => svg(tag, a)) : [svg('text', { class: 'si-char', x: 8, y: 8, dy: '0.35em', 'text-anchor': 'middle', text: sym })];
}
export function statusIcon(kind, attrs = {}) {
  return svg('svg', Object.assign({ class: 'st-svg', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' }, attrs), iconParts(kind));
}
export function statusIconGroup(kind, x, y, size) {
  return svg('g', { class: 'cap-status', transform: `translate(${x - size / 2} ${y - size / 2}) scale(${size / 16})`, 'aria-hidden': 'true' }, iconParts(kind));
}
