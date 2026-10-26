// 小貓嚮導（原創）：對話泡泡只會說兩種話——
//   1. works.json 的 ui.guide.hints 固定操作提示（站主可直接在資料檔修改）
//   2. 資料檔裡的原文（分區名稱、作品狀態），原樣顯示、不加評論
// 不會說出任何資料檔沒有的作品描述、成效或評價。
import { el, svg } from './util.js';
import { t } from './text.js';

// 提示句的代號；文字在 works.json 的 ui.guide.hints
export const HINTS = Object.fromEntries(['welcome', 'zone', 'work', 'zoneDone', 'allDone', 'tour', 'tourStop', 'reset'].map((k) => [k, 'guide.hints.' + k]));

function catSvg() {
  // 原創的小橘貓：圓臉、三角耳、額頭條紋、青綠色領巾
  return svg('svg', { class: 'cat', viewBox: '0 0 64 64', 'aria-hidden': 'true', focusable: 'false' }, [
    svg('ellipse', { class: 'cat-shadow', cx: 31, cy: 61, rx: 17, ry: 2.6 }),
    svg('path', { class: 'cat-tail', d: 'M42 54 Q57 54 56 40 Q55.5 33 50.5 34.5' }),
    svg('g', { class: 'cat-body' }, [
      svg('ellipse', { class: 'cat-fur', cx: 30, cy: 48, rx: 15, ry: 12 }),
      svg('ellipse', { class: 'cat-belly', cx: 30, cy: 51, rx: 8.5, ry: 7.5 }),
      svg('ellipse', { class: 'cat-fur cat-line', cx: 23, cy: 59, rx: 4.5, ry: 2.6 }),
      svg('ellipse', { class: 'cat-fur cat-line', cx: 37, cy: 59, rx: 4.5, ry: 2.6 })
    ]),
    svg('g', { class: 'cat-head' }, [
      svg('path', { class: 'cat-fur cat-line', d: 'M14 21 L16 5 L27 13 Z' }),
      svg('path', { class: 'cat-fur cat-line', d: 'M46 21 L44 5 L33 13 Z' }),
      svg('path', { class: 'cat-ear', d: 'M17 17 L18 9 L23 13 Z M43 17 L42 9 L37 13 Z' }),
      svg('ellipse', { class: 'cat-fur cat-line', cx: 30, cy: 24, rx: 17, ry: 14 }),
      svg('path', { class: 'cat-stripe', d: 'M26 11.5 L27 16 M30 10.5 V16 M34 11.5 L33 16' }),
      svg('g', { class: 'cat-eyes' }, [
        svg('ellipse', { class: 'cat-eye', cx: 23, cy: 24, rx: 2.3, ry: 3 }),
        svg('ellipse', { class: 'cat-eye', cx: 37, cy: 24, rx: 2.3, ry: 3 }),
        svg('circle', { class: 'cat-glint', cx: 23.8, cy: 23, r: 0.8 }),
        svg('circle', { class: 'cat-glint', cx: 37.8, cy: 23, r: 0.8 })
      ]),
      svg('circle', { class: 'cat-cheek', cx: 19, cy: 29, r: 2.6 }),
      svg('circle', { class: 'cat-cheek', cx: 41, cy: 29, r: 2.6 }),
      svg('path', { class: 'cat-nose', d: 'M28.6 28 L31.4 28 L30 29.8 Z' }),
      svg('path', { class: 'cat-mouth', d: 'M27 31 Q28.5 32.6 30 31 Q31.5 32.6 33 31' }),
      svg('path', { class: 'cat-whisker', d: 'M13 27 L20 28 M13 31 L20 30 M47 27 L40 28 M47 31 L40 30' })
    ]),
    svg('path', { class: 'cat-scarf', d: 'M18 36 Q30 41 42 36 L42 39.5 Q30 44.5 18 39.5 Z' }),
    svg('path', { class: 'cat-scarf', d: 'M35 39 L40 47 L35.5 46 L33 49 Z' })
  ]);
}

export function createGuide(root) {
  const text = el('p', { class: 'bubble-hint' });
  const data = el('p', { class: 'bubble-data' });
  const bubble = el('div', { class: 'bubble', role: 'status', 'aria-live': 'polite' }, [text, data]);
  const cat = el('button', { type: 'button', class: 'cat-btn', 'aria-label': t('guide.catLabel'), title: t('guide.catTitle') }, catSvg());
  root.append(bubble, cat);

  let last = { hint: HINTS.welcome, dataText: '' };
  let timer = null;

  function say(hint, dataText = '') {
    last = { hint, dataText };
    text.textContent = hint ? t(hint) : '';
    text.hidden = !hint;
    data.textContent = dataText || '';
    data.hidden = !dataText;
    root.classList.remove('is-talking');
    void root.offsetWidth;
    root.classList.add('is-talking', 'has-bubble');
    clearTimeout(timer);
    timer = setTimeout(() => root.classList.remove('has-bubble'), 7000);
  }
  cat.addEventListener('click', () => say(last.hint, last.dataText));
  return { say };
}
