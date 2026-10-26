// 畫面文字：全部來自 data/works.json 的 ui 段（站主改文字只改資料檔）。
// t('panel.title') 取文字；{n}、{name} 之類的位置會換成傳入的值。
// 找不到文字時顯示 key 本身並在 console 提示，畫面不會壞掉。
let ui = {};
const warned = new Set();

export function setText(obj) { ui = obj || {}; }

export function t(key, vars) {
  const v = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), ui);
  if (typeof v !== 'string') {
    if (!warned.has(key)) { warned.add(key); console.warn('[ui] works.json 缺少文字：', key); }
    return key;
  }
  return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : v;
}

// index.html 上的 data-t（文字）、data-t-aria（aria-label）、data-t-title（title）、data-t-ph（placeholder）
export function applyText(root = document) {
  root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
  root.querySelectorAll('[data-t-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.tAria)));
  root.querySelectorAll('[data-t-title]').forEach((n) => n.setAttribute('title', t(n.dataset.tTitle)));
  root.querySelectorAll('[data-t-ph]').forEach((n) => n.setAttribute('placeholder', t(n.dataset.tPh)));
}

