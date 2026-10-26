// 連線：只畫資料檔 connections 列出的線（實線／虛線）；選取作品時相關連線高亮並流動，其餘淡化
import { svg } from './util.js';

export function drawLinks(layer, model, layout) {
  layer.textContent = '';
  model.connections.forEach((c) => {
    const a = layout.pos[c.from];
    const b = layout.pos[c.to];
    if (!a || !b) return;
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    const g = svg('g', { class: 'link ' + (c.style === 'dashed' ? 'dashed' : 'solid'), 'data-from': c.from, 'data-to': c.to }, [
      svg('path', { class: 'link-base', d }),
      svg('path', { class: 'link-flow', d }),
      svg('title', { text: `${model.byId[c.from].name} → ${model.byId[c.to].name}：${c.label}` })
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
