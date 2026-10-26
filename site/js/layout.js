// 版面計算：依 layout.json 排島嶼，依 works.json 自動擺放作品節點（不需要座標）
import { sum, textUnits, shortName, wrapChars } from './util.js';

// names：膠囊顯示編號＋名稱；numbers：只顯示編號（手機）
export const METRICS = {
  names: {
    capH: 30, gapX: 14, lineH: 48, relH: 18, pad: 26, head: 50, cellHead: 32, cellPad: 12,
    cellGap: 10, cellMin: 130, emptyMin: 190, labelFont: 15, noteFont: 12, propSize: 34, cellProp: 26, hex: 20
  },
  numbers: {
    capH: 30, gapX: 12, lineH: 44, relH: 16, pad: 14, head: 40, cellHead: 28, cellPad: 8,
    cellGap: 8, cellMin: 62, emptyMin: 120, labelFont: 12, noteFont: 10, propSize: 24, cellProp: 0, hex: 12
  }
};

export function capWidth(w, mode) {
  return mode === 'numbers' ? 30 : Math.round(62 + textUnits(shortName(w.name)) * 14.5);
}

export function pickLayoutKey(config, width) {
  const keys = Object.keys(config.layouts).sort((a, b) => config.layouts[b].minWidth - config.layouts[a].minWidth);
  return keys.find((k) => width >= config.layouts[k].minWidth) || keys[keys.length - 1];
}

// 依 connections 把同一格內相連的作品排成一條鏈（例如英文家族），其他照資料順序
function chainOrder(works, connections) {
  const ids = works.map((w) => w.id);
  const next = {};
  const hasPrev = {};
  connections.forEach((c) => {
    if (ids.includes(c.from) && ids.includes(c.to) && !next[c.from]) {
      next[c.from] = c.to;
      hasPrev[c.to] = true;
    }
  });
  const out = [];
  ids.forEach((id) => {
    if (hasPrev[id] || out.includes(id)) return;
    let cur = id;
    while (cur && !out.includes(cur)) { out.push(cur); cur = next[cur]; }
  });
  ids.forEach((id) => { if (!out.includes(id)) out.push(id); });
  const byId = Object.fromEntries(works.map((w) => [w.id, w]));
  return out.map((id) => byId[id]);
}

// 子區：該區每件作品都標了 subzone 才分格（目前是教材區）
function cellsOf(model, zone, order) {
  const works = model.worksInZone(zone.id);
  if (!works.length || !works.every((w) => w.subzone)) return null;
  const names = (zone.subzones || []).slice();
  works.forEach((w) => { if (!names.includes(w.subzone)) names.push(w.subzone); });
  const empties = Object.fromEntries((zone.emptySubzones || []).map((e) => [e.name, e.note]));
  if (order) {
    const rank = (n) => (order.includes(n) ? order.indexOf(n) : 99);
    names.sort((a, b) => rank(a) - rank(b));
  }
  return names.map((name) => {
    const list = works.filter((w) => w.subzone === name);
    return { name, works: list, note: list.length ? null : (empties[name] || '') };
  });
}

// 在一個矩形內排膠囊：放不下就換列；有 relationLabel（延伸作品）的作品另起一列，放在上一件的右下方
function packNodes(works, x, y, w, m, mode, pos) {
  const lines = [];
  let cur = [];
  let used = 0;
  works.forEach((wk) => {
    const cw = capWidth(wk, mode);
    if (cur.length && (used + m.gapX + cw > w || wk.relationLabel)) {
      lines.push(cur);
      cur = [];
      used = 0;
    }
    used = cur.length ? used + m.gapX + cw : cw;
    cur.push({ wk, cw });
  });
  if (cur.length) lines.push(cur);

  let cy = y;
  let prev = null;
  lines.forEach((line, li) => {
    const lw = sum(line.map((i) => i.cw)) + m.gapX * (line.length - 1);
    let x0 = x + (w - lw) / 2;
    const nextIsRel = lines[li + 1] && lines[li + 1][0].wk.relationLabel;
    if (mode === 'names' && nextIsRel) x0 = x; // 主作品靠左，延伸作品在右下方，連線不會穿過延伸作品
    if (prev && line[0].wk.relationLabel) {
      const p = prev[prev.length - 1];
      x0 = mode === 'names'
        ? Math.max(x, Math.min(x + w - lw, p.x + p.cw - 40))
        : Math.max(x, Math.min(x + w - lw, p.x + p.cw * 0.9));
    }
    const hasRel = line.some((i) => i.wk.relationLabel);
    let cx = x0;
    line.forEach((i) => {
      i.x = cx;
      pos[i.wk.id] = { x: cx + i.cw / 2, y: cy + m.capH / 2, w: i.cw };
      cx += i.cw + m.gapX;
    });
    cy += m.lineH + (hasRel ? m.relH : 0);
    prev = line;
  });
  return lines.length ? cy - y - (m.lineH - m.capH) : 0;
}

export function computeLayout(model, config, key) {
  const L = config.layouts[key];
  const mode = L.nodes;
  const m = METRICS[mode];
  const pos = {};
  const islands = [];
  let y = L.margin;

  L.rows.forEach((row) => {
    const rowW = sum(row.map((r) => r[1])) + L.gap * (row.length - 1);
    let x = (L.width - rowW) / 2;
    let rowH = 0;
    const rowIslands = [];
    row.forEach(([zoneId, w]) => {
      const zone = model.zoneById[zoneId];
      if (!zone) return;
      const inner = w - m.pad * 2;
      const top = y + m.head;
      const cells = cellsOf(model, zone, (L.cellOrder || {})[zoneId]);
      const cellBoxes = [];
      let h;
      if (cells) {
        // 子區格子：依最小寬度換列，再按比例撐滿一列
        cells.forEach((c) => {
          if (c.works.length) {
            const ws = c.works.map((wk) => capWidth(wk, mode));
            const want = sum(ws) + m.gapX * (ws.length - 1) + m.cellPad * 2;
            c.min = Math.min(inner, Math.max(m.cellMin, want, Math.max(...ws) + m.cellPad * 2));
          } else {
            c.min = m.emptyMin;
          }
        });
        const lines = [[]];
        let used = 0;
        cells.forEach((c) => {
          const last = lines[lines.length - 1];
          const need = c.min + (last.length ? m.cellGap : 0);
          if (used + need > inner && last.length) {
            lines.push([c]);
            used = c.min;
          } else {
            last.push(c);
            used += need;
          }
        });
        let cy = top;
        lines.forEach((line) => {
          const free = inner - m.cellGap * (line.length - 1);
          const scale = free / sum(line.map((c) => c.min));
          let cx = x + m.pad;
          let lineH = 0;
          const boxes = line.map((c) => {
            const cw = c.min * scale;
            let ch;
            if (c.works.length) {
              ch = m.cellHead + packNodes(chainOrder(c.works, model.connections), cx + m.cellPad, cy + m.cellHead, cw - m.cellPad * 2, m, mode, pos) + m.cellPad;
            } else {
              // 空子區：空地＋告示牌（文字照資料檔 note）
              const boardW = Math.min(cw - m.cellPad * 2, 220);
              c.noteLines = wrapChars(c.note, Math.max(4, Math.floor((boardW - 14) / (m.noteFont + 0.5))));
              c.boardW = boardW;
              ch = m.cellHead + c.noteLines.length * (m.noteFont + 4) + 14 + 18 + m.cellPad;
            }
            const box = { cell: c, x: cx, y: cy, w: cw, h: ch };
            lineH = Math.max(lineH, ch);
            cx += cw + m.cellGap;
            return box;
          });
          boxes.forEach((b) => { b.h = lineH; cellBoxes.push(b); });
          cy += lineH + m.cellGap;
        });
        h = cy - m.cellGap - y + m.pad;
      } else {
        h = m.head + packNodes(model.worksInZone(zoneId), x + m.pad, top, inner, m, mode, pos) + m.pad;
      }
      rowIslands.push({ zone, x, y, w, h, cells: cellBoxes, contentH: h });
      rowH = Math.max(rowH, h);
      x += w + L.gap;
    });
    rowIslands.forEach((isl) => {
      // 島的高度依內容而定；同一列中較矮的島垂直置中，看起來像自然的群島
      const dy = (rowH - isl.contentH) / 2;
      if (dy) {
        isl.y += dy;
        isl.cells.forEach((b) => { b.y += dy; });
        model.worksInZone(isl.zone.id).forEach((w) => { if (pos[w.id]) pos[w.id].y += dy; });
      }
    });
    islands.push(...rowIslands);
    y += rowH + L.gap;
  });

  const height = y - L.gap + L.margin;
  return { key, mode, m, width: L.width, height, islands, pos, config };
}
