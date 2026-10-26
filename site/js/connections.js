// 連線：只畫資料檔 connections 列出的線（彩色弧線，實線／虛線）；選取作品時相關連線高亮並流動，其餘淡化
import { svg } from './util.js';
import { t } from './text.js';

export function drawLinks(layer, model, layout) {
  layer.textContent = '';
  model.connections.forEach((c) => {
    const a = layout.pos[c.from];
    const b = layout.pos[c.to];
    if (!a || !b) return;
    // 微微彎曲的弧線：和直的、木色的步道一眼就能分開
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const bow = Math.min(40, len * 0.12);
    const cx = (a.x + b.x) / 2 + (-(b.y - a.y) / len) * bow;
    const cy = (a.y + b.y) / 2 + ((b.x - a.x) / len) * bow;
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    const g = svg('g', { class: 'link ' + (c.style === 'dashed' ? 'dashed' : 'solid'), 'data-from': c.from, 'data-to': c.to }, [
      svg('path', { class: 'link-base', d }),
      svg('path', { class: 'link-flow', d }),
      svg('title', { text: t('map.linkTitle', { from: model.byId[c.from].name, to: model.byId[c.to].name, label: c.label }) })
    ]);
    layer.appendChild(g);
  });
}

export function markLinks(layer, selected) {
  layer.classList.toggle('has-active', !!selected);
  layer.querySelectorAll('.link').forEach((l) => {
    const on = !!selected && (l.getAttribute('data-from') === selected || l.getAttribute('data-to') === selected);
    l.classList.toggle('is-active', on);
  });
}

export function setLinksVisible(layer, visible) {
  layer.classList.toggle('is-hidden', !visible);
}
