// 作品節點：膠囊（編號徽章＋名稱＋狀態圖示）；手機版只有編號徽章
import { svg, shortName, statusKind, STATUS, statusIconGroup } from './util.js';

export function drawNodes(layer, model, layout, { onActivate, wasDragged }) {
  layer.textContent = '';
  const names = layout.mode === 'names';
  model.works.forEach((w) => {
    const p = layout.pos[w.id];
    if (!p) return;
    const kind = statusKind(w);
    const g = svg('g', {
      class: `node zone-${w.zone} st-${kind}`, 'data-id': w.id, 'data-zone': w.zone, tabindex: 0, role: 'button',
      'aria-label': `${w.num}. ${w.name}（${STATUS[kind].label}：${w.status}）`,
      transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`
    });
    const activate = (e) => {
      if (wasDragged()) return;
      onActivate(w.id, { source: 'map', keyboard: e.type === 'keydown' });
    };
    g.addEventListener('click', activate);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e); }
    });

    const cap = svg('g', { class: 'cap' });
    if (names) {
      const name = svg('text', { class: 'cap-name', x: 0, y: 0, dy: '0.35em', text: shortName(w.name) });
      cap.append(
        svg('rect', { class: 'cap-ring', rx: 19 }),
        svg('rect', { class: 'cap-body', rx: 15 }),
        svg('circle', { class: 'cap-badge', r: 12 }),
        svg('text', { class: 'cap-num', dy: '0.35em', text: String(w.num) }),
        name,
        statusIconGroup(kind, 0, 0, 13)
      );
    } else {
      cap.append(
        svg('circle', { class: 'cap-hit', r: 22 }),
        svg('circle', { class: 'cap-ring', r: 20 }),
        svg('circle', { class: 'cap-badge', r: 15 }),
        svg('text', { class: 'cap-num', dy: '0.35em', text: String(w.num) })
      );
    }
    g.append(svg('ellipse', { class: 'cap-shadow', cx: 0, cy: 17, rx: names ? p.w / 2 - 8 : 13, ry: 4 }), cap);
    if (w.relationLabel) {
      g.appendChild(svg('text', { class: 'cap-rel', x: 0, y: names ? 33 : 30, text: w.relationLabel }));
    }
    g.appendChild(svg('title', { text: w.name }));
    layer.appendChild(g);
    if (names) sizeCapsule(g, p.w);
  });
}

// 依實際文字寬度調整膠囊（以中心對齊；版面計算用的是保守的估計寬度）
function sizeCapsule(g, estW) {
  const name = g.querySelector('.cap-name');
  let tw = 0;
  try { tw = name.getComputedTextLength(); } catch (e) { tw = 0; }
  const w = tw ? Math.min(estW, 33 + tw + 8 + 14 + 10) : estW;
  const x0 = -w / 2;
  const set = (sel, attrs) => Object.entries(attrs).forEach(([k, v]) => g.querySelector(sel).setAttribute(k, v));
  set('.cap-body', { x: x0, y: -15, width: w, height: 30 });
  set('.cap-ring', { x: x0 - 4, y: -19, width: w + 8, height: 38 });
  set('.cap-badge', { cx: x0 + 16, cy: 0 });
  set('.cap-num', { x: x0 + 16, y: 0 });
  set('.cap-name', { x: x0 + 33 });
  g.querySelector('.cap-status').setAttribute('transform', `translate(${x0 + w - 20.5} -6.5) scale(${13 / 16})`);
  set('.cap-shadow', { rx: w / 2 - 8 });
}

export function markNodes(layer, { selected, dimmed }) {
  layer.querySelectorAll('.node').forEach((n) => {
    const id = n.getAttribute('data-id');
    n.classList.toggle('is-selected', id === selected);
    n.classList.toggle('is-dim', !!dimmed && !dimmed.has(id));
  });
}

export function pulseNode(layer, id) {
  const n = layer.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
  if (!n) return;
  n.classList.remove('pulse');
  void n.getBoundingClientRect();
  n.classList.add('pulse');
}
