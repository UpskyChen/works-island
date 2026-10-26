// 島嶼地圖：六角地塊、木橋、景物與地標、分區標籤、空地告示牌、已逛完章、插圖資產槽，
// 以及鏡頭（平滑聚焦、拖曳、雙指縮放）
import { svg, textUnits, reducedMotion, emit } from './util.js';

const S3 = Math.sqrt(3);
const SQUASH = 0.82; // 地塊壓扁一點，做出輕等角的俯視感

function hash(q, r) {
  const v = Math.sin(q * 127.1 + r * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function hexPath(cx, cy, s, dy = 0, squash = SQUASH) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    d += (i ? 'L' : 'M') + (cx + s * Math.cos(a)).toFixed(1) + ' ' + (cy + dy + s * Math.sin(a) * squash).toFixed(1);
  }
  return d + 'Z';
}
const hexes = (tiles, s, dx = 0, dy = 0) => tiles.map((t) => hexPath(t.cx + dx, t.cy, s, dy)).join('');
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + d * 2, h: r.h + d * 2 });

// 用共同的六角格網鋪滿島嶼矩形；四角修圓、邊緣隨機缺幾塊，看起來像自然的島
function tilesFor(isl, s) {
  const w = S3 * s;
  const vh = 1.5 * s * SQUASH;
  const R = 2.4 * s;
  const tol = 0.15 * s;
  const out = [];
  for (let r = Math.floor((isl.y - s) / vh); r * vh <= isl.y + isl.h + s; r++) {
    const off = ((r % 2) + 2) % 2 ? w / 2 : 0;
    for (let q = Math.floor((isl.x - w) / w); q * w + off <= isl.x + isl.w + w; q++) {
      const cx = q * w + off;
      const cy = r * vh;
      if (cx < isl.x - tol || cx > isl.x + isl.w + tol || cy < isl.y - tol || cy > isl.y + isl.h + tol) continue;
      const kx = Math.max(isl.x + R - cx, 0, cx - (isl.x + isl.w - R));
      const ky = Math.max(isl.y + R - cy, 0, cy - (isl.y + isl.h - R));
      if (kx > 0 && ky > 0 && kx * kx + ky * ky > R * R) continue;
      const edge = Math.min(cx - isl.x, isl.x + isl.w - cx, cy - isl.y, isl.y + isl.h - cy);
      if (edge < 0.35 * s && hash(q, r) < 0.35) continue;
      out.push({ cx, cy, q, r });
    }
  }
  return out;
}

// 兩島之間的木橋：有水平或垂直重疊就走直線，否則連兩島中心（橋畫在島的下層，只露出水面那段）
function bridgeLine(a, b) {
  const ox = [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)];
  const oy = [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)];
  if (ox[1] - ox[0] > 60) {
    const x = (ox[0] + ox[1]) / 2;
    const [top, bot] = a.y < b.y ? [a, b] : [b, a];
    return [x, top.y + top.h - 30, x, bot.y + 30];
  }
  if (oy[1] - oy[0] > 60) {
    const y = (oy[0] + oy[1]) / 2;
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    return [l.x + l.w - 30, y, r.x + 30, y];
  }
  return [a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2];
}

export function createMap(stage, host, opts) {
  const svgEl = svg('svg', { class: 'island-map', role: 'group', 'aria-label': opts.label, preserveAspectRatio: 'xMinYMin meet' });
  host.appendChild(svgEl);

  let layout = null;
  let cam = { vx: 0, vy: 0, k: 1 };
  let W = 1;
  let H = 1;
  let target = { type: 'pano' };
  let tween = null;
  let lastDragged = false;
  const layers = {};
  const labelBoxes = {};

  // ---------- 繪製 ----------
  function build(model, lay, propsDoc, { intro } = {}) {
    layout = lay;
    const m = lay.m;
    const names = lay.mode === 'names';
    const cfg = lay.config;
    svgEl.textContent = '';
    svgEl.setAttribute('class', 'island-map nodes-' + lay.mode + (intro && !reducedMotion() ? ' intro' : ''));

    const gUnder = svg('g', { class: 'under' });
    const gIslands = svg('g', { class: 'islands' });
    const gTitles = svg('g', { class: 'titles' });
    layers.links = svg('g', { class: 'links' });
    layers.nodes = svg('g', { class: 'nodes' });
    layers.stamps = svg('g', { class: 'stamps' });
    const byZone = Object.fromEntries(lay.islands.map((isl) => [isl.zone.id, isl]));

    // 木橋（裝飾步道，中性木色；與作品連線分開）
    const bridges = (cfg.layouts[lay.key].bridges || []).filter(([a, b]) => byZone[a] && byZone[b]);
    bridges.forEach(([a, b]) => {
      const [x1, y1, x2, y2] = bridgeLine(byZone[a], byZone[b]);
      const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
      gUnder.appendChild(svg('g', { class: 'bridge', 'aria-hidden': 'true' }, [
        svg('path', { class: 'bridge-shadow', d, 'stroke-width': names ? 22 : 13 }),
        svg('path', { class: 'bridge-deck', d, 'stroke-width': names ? 16 : 9 }),
        svg('path', { class: 'bridge-planks', d, 'stroke-width': names ? 16 : 9, 'stroke-dasharray': names ? '3 5' : '2 3' })
      ]));
    });

    lay.islands.forEach((isl, i) => {
      const z = isl.zone;
      const s = m.hex;
      const tiles = tilesFor(isl, s);
      const depth = s * 0.5;
      const g = svg('g', { class: 'island zone-' + z.id, 'data-zone': z.id, style: { animationDelay: i * 0.13 + 's' } });
      const allTop = hexes(tiles, s);
      // 水中倒影陰影與岸邊泡沫
      const shadow = svg('path', { class: 'island-shadow', d: hexes(tiles, s, s * 0.35, depth + s * 0.5) });
      gUnder.appendChild(shadow);
      g.appendChild(svg('path', { class: 'foam', d: allTop, 'stroke-width': s * 1.1 }));
      g.appendChild(svg('path', { class: 'shore', d: allTop, 'stroke-width': s * 0.6 }));
      g.appendChild(svg('path', { class: 'side', d: hexes(tiles, s, 0, depth) }));
      g.appendChild(svg('path', { class: 'top', d: allTop }));

      // 子區：地塊染色；空子區是空地
      isl.cells.forEach((b) => {
        const inCell = tiles.filter((t) => t.cx >= b.x - 2 && t.cx <= b.x + b.w + 2 && t.cy >= b.y - 2 && t.cy <= b.y + b.h + 2);
        g.appendChild(svg('path', { class: b.cell.works.length ? 'cell-tint' : 'cell-lot', d: hexes(inCell, s) }));
        g.appendChild(svg('rect', { class: 'cell-frame' + (b.cell.works.length ? '' : ' empty'), x: b.x, y: b.y, width: b.w, height: b.h, rx: 12 }));
      });

      // 版面上已被佔用的位置（節點、標籤、告示牌），景物不放在這些地方
      const busy = [];
      model.worksInZone(z.id).forEach((w) => {
        const p = lay.pos[w.id];
        if (!p) return;
        busy.push(grow({ x: p.x - p.w / 2, y: p.y - 15, w: p.w, h: 30 }, 8));
        if (w.relationLabel) busy.push({ x: p.x - 75, y: p.y + 14, w: 150, h: 26 });
      });

      // 分區標籤：六角徽章（件數）＋區名
      const labelH = names ? 28 : 24;
      const font = names ? 15 : 12;
      const count = model.worksInZone(z.id).length;
      const labelW = labelH + 8 + textUnits(z.name) * font + 12;
      const lx = isl.x + (names ? 16 : 10);
      const ly = isl.y + (names ? 11 : 8);
      labelBoxes[z.id] = { x: lx, y: ly, w: labelW, h: labelH };
      busy.push(grow({ x: lx, y: ly, w: labelW + (names ? 60 : 26), h: labelH }, 6));
      gTitles.appendChild(svg('g', { class: 'zone-label zone-' + z.id, 'data-zone': z.id, transform: `translate(${lx} ${ly})` }, [
        svg('rect', { class: 'zl-body', x: 0, y: 0, width: labelW, height: labelH, rx: labelH / 2 }),
        svg('path', { class: 'zl-badge', d: hexPath(labelH / 2, labelH / 2, labelH / 2 - 1, 0, 1) }),
        svg('text', { class: 'zl-count', x: labelH / 2, y: labelH / 2, dy: '0.35em', 'font-size': font - 2, text: String(count) }),
        svg('text', { class: 'zl-name', x: labelH + 6, y: labelH / 2, dy: '0.35em', 'font-size': font, text: z.name })
      ]));

      // 標題列右側的小插畫
      const props = (cfg.props || {})[z.id] || [];
      const ps = m.propSize;
      const room = isl.x + isl.w - 12 - (lx + labelW + (names ? 64 : 30));
      const n = Math.min(props.length, Math.max(0, Math.floor(room / (ps + 4))), names ? 3 : 1);
      for (let j = 0; j < n; j++) {
        const px = isl.x + isl.w - 12 - (j + 1) * (ps + 4);
        const py = isl.y + (m.head - ps) / 2 - 1;
        g.appendChild(placeProp(propsDoc, props[j], px, py, ps));
        busy.push(grow({ x: px, y: py, w: ps, h: ps }, 4));
      }

      isl.cells.forEach((b) => {
        const c = b.cell;
        const cf = names ? 14 : 11;
        busy.push({ x: b.x, y: b.y, w: b.w, h: m.cellHead });
        if (!c.works.length) busy.push(b);
        gTitles.appendChild(svg('text', { class: 'cell-name', 'data-zone': z.id, x: b.x + 10, y: b.y + (names ? 21 : 17), 'font-size': cf }, [
          c.name, svg('tspan', { class: 'cell-count', dx: 5, 'font-size': cf - 2, text: String(c.works.length) })
        ]));
        const pname = (cfg.subzoneProps || {})[c.name];
        const cp = m.cellProp;
        if (pname && cp && b.w > textUnits(c.name) * cf + 40 + cp) {
          g.appendChild(placeProp(propsDoc, pname, b.x + b.w - cp - 6, b.y + 3, cp));
        }
        if (!c.works.length) gTitles.appendChild(signpost(b, m, lay.mode, z.id));
      });

      // 景物與地標：放在空著的地塊上
      g.appendChild(scenery(propsDoc, (cfg.scenery || {})[z.id], tiles, isl, busy, names));

      // 插圖資產槽：設定了圖片且載入成功才取代 SVG 地塊；節點與文字永遠在 SVG 上層
      const art = (cfg.art || {})[z.id];
      if (art) {
        const img = svg('image', { class: 'zone-art', href: art, x: isl.x - 10, y: isl.y - 10, width: isl.w + 20, height: isl.h + 20, preserveAspectRatio: 'xMidYMid meet' });
        img.addEventListener('load', () => { g.classList.add('has-art'); shadow.remove(); });
        img.addEventListener('error', () => img.remove());
        g.insertBefore(img, g.firstChild);
      }
      gIslands.appendChild(g);
    });

    svgEl.append(gUnder, gIslands, layers.links, gTitles, layers.stamps, layers.nodes);
    if (intro && !reducedMotion()) {
      const done = () => svgEl.classList.remove('intro');
      setTimeout(done, 1700);
      stage.addEventListener('pointerdown', done, { once: true });
      window.addEventListener('keydown', done, { once: true });
    }
    measure();
    return layers;
  }

  function scenery(propsDoc, conf, tiles, isl, busy, names) {
    const g = svg('g', { class: 'scenery', 'aria-hidden': 'true' });
    if (!conf || !propsDoc) return g;
    const want = [conf.landmark ? 'l-' + conf.landmark.replace(/^l-/, '') : null, ...(conf.items || [])].filter(Boolean);
    const limit = names ? want.length : Math.min(want.length, 3);
    const cand = tiles.slice().sort((a, b) => hash(a.q + 7, a.r - 3) - hash(b.q + 7, b.r - 3));
    const placed = [];
    for (let k = 0; k < limit; k++) {
      const big = want[k].startsWith('l-');
      const size = (big ? 58 : 34) * (names ? 1 : 0.6);
      const spot = cand.find((t) => {
        const box = { x: t.cx - size / 2, y: t.cy - size * 0.92, w: size, h: size * 0.95 };
        if (box.x < isl.x + 6 || box.x + box.w > isl.x + isl.w - 6 || box.y < isl.y + 6) return false;
        if (busy.some((b) => hit(box, b))) return false;
        return placed.every((p) => Math.hypot(p.cx - t.cx, p.cy - t.cy) > (size + p.size) * 0.55);
      });
      if (!spot) continue;
      placed.push({ cx: spot.cx, cy: spot.cy, size });
      g.appendChild(placeProp(propsDoc, want[k], spot.cx - size / 2, spot.cy - size * 0.92, size));
    }
    // 由上往下排，讓前面的景物蓋住後面的
    [...g.children].sort((a, b) => parseFloat(a.dataset.y) - parseFloat(b.dataset.y)).forEach((c) => g.appendChild(c));
    return g;
  }

  // 空子區的告示牌：文字完全照資料檔 note
  function signpost(b, m, mode, zoneId) {
    const c = b.cell;
    const lineH = m.noteFont + 4;
    const bw = c.boardW;
    const bh = c.noteLines.length * lineH + 12;
    const x = b.x + (b.w - bw) / 2;
    const y = b.y + m.cellHead + 2;
    const g = svg('g', { class: 'sign', 'data-zone': zoneId });
    g.appendChild(svg('rect', { class: 'sign-post', x: b.x + b.w / 2 - 2, y: y + bh - 2, width: 4, height: 18, rx: 1 }));
    g.appendChild(svg('rect', { class: 'sign-board', x, y, width: bw, height: bh, rx: 4 }));
    c.noteLines.forEach((line, i) => {
      g.appendChild(svg('text', { class: 'sign-text', x: x + bw / 2, y: y + 8 + lineH * i + m.noteFont * 0.85, 'font-size': m.noteFont, text: line }));
    });
    if (mode === 'numbers') g.setAttribute('aria-hidden', 'true');
    return g;
  }

  function placeProp(propsDoc, name, x, y, size) {
    const wrap = svg('g', { class: 'prop prop-' + name, 'data-y': y.toFixed(1), transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(size / 40).toFixed(3)})`, 'aria-hidden': 'true' });
    const src = propsDoc && propsDoc.getElementById('p-' + name);
    if (src) {
      const g = document.importNode(src, true);
      g.removeAttribute('id');
      wrap.appendChild(g);
    }
    return wrap;
  }

  // 「已逛完」章：蓋在分區標籤右側
  function setStamps(doneZones) {
    if (!layers.stamps) return;
    layers.stamps.textContent = '';
    const names = layout.mode === 'names';
    doneZones.forEach((zid) => {
      const lb = labelBoxes[zid];
      if (!lb) return;
      const r = names ? 24 : 11;
      const cx = lb.x + lb.w + r + 4;
      const cy = lb.y + lb.h / 2;
      const g = svg('g', { class: 'stamp', transform: `translate(${cx} ${cy}) rotate(-12)` }, [
        svg('circle', { class: 'stamp-ring', r }),
        svg('circle', { class: 'stamp-ring2', r: r - 3 })
      ]);
      if (names) g.appendChild(svg('text', { class: 'stamp-text', y: 0, dy: '0.35em', text: '已逛完' }));
      else g.appendChild(svg('path', { class: 'stamp-check', d: 'M-5 0 L-1.5 3.5 L5 -3.5' }));
      g.appendChild(svg('title', { text: '已逛完' }));
      layers.stamps.appendChild(g);
    });
  }

  // ---------- 鏡頭 ----------
  function measure() {
    const r = svgEl.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
  }
  function apply() {
    svgEl.setAttribute('viewBox', `${cam.vx.toFixed(2)} ${cam.vy.toFixed(2)} ${(W / cam.k).toFixed(2)} ${(H / cam.k).toFixed(2)}`);
  }
  function safeRect() {
    const ins = opts.insets();
    return {
      x: ins.left, y: ins.top,
      w: Math.max(120, W - ins.left - ins.right), h: Math.max(120, H - ins.top - ins.bottom)
    };
  }
  function panoRect() { return { x: 0, y: 0, w: layout.width, h: layout.height }; }
  function camFor(rect, maxK) {
    const S = safeRect();
    let k = Math.min(S.w / rect.w, S.h / rect.h);
    if (maxK) k = Math.min(k, maxK);
    return { k, vx: rect.x + rect.w / 2 - (S.x + S.w / 2) / k, vy: rect.y + rect.h / 2 - (S.y + S.h / 2) / k };
  }
  const kPano = () => camFor(panoRect()).k;

  function clamp(c) {
    const kp = kPano();
    const k = Math.min(kp * 5, Math.max(kp * 0.6, c.k));
    const cx = Math.min(layout.width, Math.max(0, c.vx + W / (2 * c.k)));
    const cy = Math.min(layout.height, Math.max(0, c.vy + H / (2 * c.k)));
    return { k, vx: cx - W / (2 * k), vy: cy - H / (2 * k) };
  }

  function moving(onOff) { stage.classList.toggle('cam-moving', onOff); }

  function tweenTo(next, animate = true) {
    if (tween) cancelAnimationFrame(tween.raf);
    tween = null;
    if (!animate || reducedMotion()) {
      cam = next;
      apply();
      return;
    }
    const S = safeRect();
    const sx = S.x + S.w / 2;
    const sy = S.y + S.h / 2;
    const from = { k: cam.k, cx: cam.vx + sx / cam.k, cy: cam.vy + sy / cam.k };
    const to = { k: next.k, cx: next.vx + sx / next.k, cy: next.vy + sy / next.k };
    const t0 = performance.now();
    const dur = 520;
    moving(true);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const k = from.k * Math.pow(to.k / from.k, e);
      const cx = from.cx + (to.cx - from.cx) * e;
      const cy = from.cy + (to.cy - from.cy) * e;
      cam = { k, vx: cx - sx / k, vy: cy - sy / k };
      apply();
      if (t < 1) tween = { raf: requestAnimationFrame(step) };
      else { tween = null; moving(false); }
    };
    tween = { raf: requestAnimationFrame(step) };
  }

  function fitPanorama(animate = true) {
    target = { type: 'pano' };
    tweenTo(camFor(panoRect()), animate);
  }
  function focusRect(rect, animate = true) {
    target = { type: 'rect', rect };
    tweenTo(camFor(rect, kPano() * 3.2), animate);
  }
  function zoneRect(zoneId) {
    const isl = layout.islands.find((i) => i.zone.id === zoneId);
    return isl ? { x: isl.x - 20, y: isl.y - 20, w: isl.w + 40, h: isl.h + 40 } : null;
  }
  // 聚焦某件作品：有子區時聚焦子區（放大一點），否則聚焦整個分區
  function rectForWork(id) {
    const p = layout.pos[id];
    if (!p) return null;
    for (const isl of layout.islands) {
      const cell = isl.cells.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      if (cell) {
        const minW = layout.mode === 'names' ? 440 : 200;
        const minH = layout.mode === 'names' ? 260 : 150;
        const maxW = layout.mode === 'names' ? 480 : 240;
        const w = Math.min(Math.max(cell.w + 40, minW), maxW);
        const h = Math.max(cell.h + 40, minH);
        // 子區比聚焦範圍寬時，以作品本身為中心
        const cx = cell.w + 40 > maxW ? p.x : cell.x + cell.w / 2;
        return { x: cx - w / 2, y: cell.y + cell.h / 2 - h / 2, w, h };
      }
      if (p.x >= isl.x && p.x <= isl.x + isl.w && p.y >= isl.y && p.y <= isl.y + isl.h) return zoneRect(isl.zone.id);
    }
    return { x: p.x - 150, y: p.y - 100, w: 300, h: 200 };
  }
  function focusWork(id, animate = true) {
    const rect = rectForWork(id);
    if (rect) focusRect(rect, animate);
  }
  function focusZone(zoneId, animate = true) {
    const rect = zoneRect(zoneId);
    if (rect) focusRect(rect, animate);
  }
  function zoomBy(f) {
    const S = safeRect();
    const sx = S.x + S.w / 2;
    const sy = S.y + S.h / 2;
    const wx = cam.vx + sx / cam.k;
    const wy = cam.vy + sy / cam.k;
    const k = cam.k * f;
    target = null;
    tweenTo(clamp({ k, vx: wx - sx / k, vy: wy - sy / k }));
  }
  // 視窗大小或面板開合改變時，重新套用目前的鏡頭目標
  function refit(animate = false) {
    measure();
    if (!layout) return;
    if (!target) { cam = clamp(cam); apply(); return; }
    if (target.type === 'pano') fitPanorama(animate);
    else focusRect(target.rect, animate);
  }

  // ---------- 滑過分區（滑鼠） ----------
  const zoneOf = (t) => {
    if (!t || !t.closest) return null;
    const n = t.closest('.node');
    if (n) return n.getAttribute('data-zone');
    const z = t.closest('[data-zone]');
    return z ? z.getAttribute('data-zone') : null;
  };
  svgEl.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || pointers.size) return;
    opts.onZoneHover(zoneOf(e.target));
  });
  svgEl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') opts.onZoneHover(null);
  });

  // ---------- 手勢：拖曳平移、雙指縮放、觸控板縮放 ----------
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let moved = false;
  const local = (e) => {
    const r = svgEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  svgEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, local(e));
    if (tween) { cancelAnimationFrame(tween.raf); tween = null; moving(false); }
    emit('user-interact');
    if (pointers.size === 1) {
      moved = false;
      lastDragged = false;
      drag = { start: local(e), cam: { ...cam } };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam: { ...cam } };
      drag = null;
    }
  });
  svgEl.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = pinch.cam.k * (dist / pinch.dist);
      const wx = pinch.cam.vx + pinch.mid.x / pinch.cam.k;
      const wy = pinch.cam.vy + pinch.mid.y / pinch.cam.k;
      cam = clamp({ k, vx: wx - mid.x / k, vy: wy - mid.y / k });
      target = null;
      moved = true;
      moving(true);
      apply();
    } else if (drag) {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        moving(true);
        svgEl.setPointerCapture(e.pointerId);
      }
      if (moved) {
        cam = clamp({ k: drag.cam.k, vx: drag.cam.vx - dx / drag.cam.k, vy: drag.cam.vy - dy / drag.cam.k });
        target = null;
        apply();
      }
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 1) {
      // 雙指放開一指：以剩下那一指繼續拖曳，避免跳動
      const rest = [...pointers.values()][0];
      pinch = null;
      drag = { start: rest, cam: { ...cam } };
      return;
    }
    if (pointers.size === 0) {
      lastDragged = moved;
      if (!moved && e.type === 'pointerup' && !(e.target.closest && e.target.closest('.node'))) {
        // 點島上空地＝選這個分區；點水面＝回到全景
        const z = zoneOf(e.target);
        if (z) opts.onZone(z);
        else opts.onBackground();
      }
      drag = null;
      pinch = null;
      moving(false);
    }
  };
  svgEl.addEventListener('pointerup', end);
  svgEl.addEventListener('pointercancel', end);
  svgEl.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return; // 一般滾輪留給頁面捲動；觸控板雙指縮放會帶 ctrlKey
    e.preventDefault();
    const p = local(e);
    const k = cam.k * Math.exp(-e.deltaY * 0.01);
    const wx = cam.vx + p.x / cam.k;
    const wy = cam.vy + p.y / cam.k;
    cam = clamp({ k, vx: wx - p.x / k, vy: wy - p.y / k });
    target = null;
    apply();
  }, { passive: false });

  return {
    svg: svgEl, build, fitPanorama, focusWork, focusZone, zoomBy, refit, setStamps,
    wasDragged: () => lastDragged,
    get layout() { return layout; }
  };
}
