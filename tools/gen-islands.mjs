// 島嶼輪廓產生器：用固定種子產生三種寬度（wide／medium／narrow）的島嶼輪廓、位置、裝飾與步道，
// 寫進 site/data/layout.json。網站載入時直接讀這些座標，每次形狀都一樣；網站本身不會執行這支程式。
//
// 用法（只有想重新設計島嶼形狀時才需要）：
//   node tools/gen-islands.mjs            依 layout.json 裡的 seed 重新產生
//   node tools/gen-islands.mjs 新種子字串   換一組形狀
//
// 新增作品「不需要」重跑：島放不下時，網站會自動把那座島等比例放大。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prepare } from '../site/js/data-loader.js';
import { computeLayout, packZone, METRICS } from '../site/js/layout.js';
import { rng, genOutline, genBlob, separate, absPts, pointInPoly, closest } from '../site/js/terrain.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const worksPath = join(root, 'site/data/works.json');
const layoutPath = join(root, 'site/data/layout.json');
const model = prepare(JSON.parse(readFileSync(worksPath, 'utf8')));
const old = JSON.parse(readFileSync(layoutPath, 'utf8'));
const seed = process.argv[2] || old.seed || 'works-island-v3';

// 三種版面的基本設定。anchor 是各島的大致方位（之後會往中間收攏再推開到間距 gap）；
// contentW 依作品件數決定內容寬度（件數多的島比較大），jitter 讓同件數的島大小也略有不同。
const PLANS = {
  wide: {
    minWidth: 1000, nodes: 'names', margin: 34, gap: 46, squeezeX: 1, squeezeY: 1,
    width: (n, sub) => (sub ? 540 : 170 + n * 30), jitter: 50,
    anchors: { campus: [240, 210], subjects: [800, 240], tools: [200, 640], games: [600, 700], frozen: [1000, 640] },
    walkways: [['campus', 'subjects'], ['subjects', 'frozen'], ['frozen', 'games'], ['games', 'tools'], ['tools', 'campus']]
  },
  medium: {
    minWidth: 600, nodes: 'names', margin: 28, gap: 40, squeezeX: 1, squeezeY: 0.5,
    width: (n, sub) => (sub ? 520 : 160 + n * 25), jitter: 40,
    anchors: { subjects: [400, 200], campus: [190, 560], tools: [610, 560], games: [200, 880], frozen: [600, 880] },
    walkways: [['subjects', 'tools'], ['tools', 'frozen'], ['frozen', 'games'], ['games', 'campus'], ['campus', 'subjects']]
  },
  narrow: {
    minWidth: 0, nodes: 'numbers', margin: 14, gap: 22, squeezeX: 1, squeezeY: 0.15,
    width: (n, sub) => (sub ? 330 : 110 + n * 14), jitter: 24,
    anchors: { subjects: [210, 170], campus: [110, 430], tools: [310, 430], games: [110, 640], frozen: [310, 640] },
    walkways: [['subjects', 'tools'], ['tools', 'frozen'], ['frozen', 'games'], ['games', 'campus'], ['campus', 'subjects']]
  }
};
const CELL_ORDER = (old.layouts && old.layouts.wide && old.layouts.wide.cellOrder) || {};

function planLayout(key, P) {
  const m = METRICS[P.nodes];
  const R = rng(seed + ':' + key);
  const islands = model.zones.map((zone) => {
    const works = model.worksInZone(zone.id);
    const sub = works.length > 0 && works.every((w) => w.subzone);
    const contentW = Math.round(P.width(works.length, sub) + (R() - 0.5) * P.jitter);
    const { h } = packZone(model, zone, contentW, m, P.nodes, CELL_ORDER[zone.id]);
    const pts = genOutline({ w: contentW, h, pad: m.pad * 1.25, seed: seed + ':' + key + ':' + zone.id, bays: 1 + Math.floor(R() * 2), capes: 1 + Math.floor(R() * 2) });
    const [ax, ay] = P.anchors[zone.id] || [R() * 800, R() * 800];
    return { zone, contentW, cx: ax * 1.8, cy: ay * 1.8, pts, s: 1 };
  });

  // 往群島中心收攏、再推開到間距 gap，重複幾次，讓島與島靠近但不重疊
  separate(islands, P.gap);
  for (let round = 0; round < 40; round++) {
    const gx = islands.reduce((a, i) => a + i.cx, 0) / islands.length;
    const gy = islands.reduce((a, i) => a + i.cy, 0) / islands.length;
    islands.forEach((i) => { i.cx += (gx - i.cx) * 0.08 * P.squeezeX; i.cy += (gy - i.cy) * 0.08 * P.squeezeY; });
    separate(islands, P.gap);
  }

  // 裝飾：沙洲、礁石、小浮島，放在島外的水面上，不碰到任何島
  const abs = islands.map(absPts);
  const k = P.nodes === 'names' ? 1 : 0.6;
  const decor = [];
  const freeAt = (x, y, clear) => abs.every((A) => !pointInPoly(x, y, A) && A.every(([px, py]) => Math.hypot(px - x, py - y) > clear))
    && decor.every((d) => Math.hypot(d.x - x, d.y - y) > clear * 1.6);
  const shoreDist = (isl, a) => {
    // 沿角度 a 找輪廓上最遠的點，當作岸邊距離
    let best = 0;
    isl.pts.forEach(([x, y]) => {
      const pa = Math.atan2(y, x);
      let d = Math.abs(pa - a) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < 0.12) best = Math.max(best, Math.hypot(x, y));
    });
    return best;
  };
  const place = (isl, type, off, clear, extra) => {
    for (let t = 0; t < 24; t++) {
      const a = R() * Math.PI * 2;
      const dist = shoreDist(isl, a) + off;
      const x = isl.cx + Math.cos(a) * dist;
      const y = isl.cy + Math.sin(a) * dist;
      if (!freeAt(x, y, clear)) continue;
      const d = Object.assign({ type, zone: isl.zone.id, x, y, dx: Math.round(x - isl.cx), dy: Math.round(y - isl.cy) }, extra());
      decor.push(d);
      return;
    }
  };
  islands.forEach((isl) => {
    place(isl, 'sandbar', 26 * k, 30 * k, () => {
      const rx = Math.round((26 + R() * 18) * k);
      const ry = Math.round(rx * 0.38);
      return { rx, ry, rot: Math.round((R() - 0.5) * 50), pts: genBlob({ rx, ry, seed: seed + ':sb:' + key + isl.zone.id }) };
    });
    if (R() < 0.75) {
      place(isl, 'reef', 30 * k, 26 * k, () => {
        const rocks = [];
        const n = 3 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) rocks.push([Math.round((R() - 0.5) * 26 * k), Math.round((R() - 0.5) * 14 * k), Math.round((3 + R() * 4) * k)]);
        return { r: Math.round(18 * k), rocks };
      });
    }
    if (R() < 0.6) {
      place(isl, 'islet', 44 * k, 40 * k, () => {
        const rx = Math.round((16 + R() * 10) * k);
        return { r: rx, pts: genBlob({ rx, ry: Math.round(rx * 0.72), seed: seed + ':is:' + key + isl.zone.id }), prop: ['tree', 'pine', 'bush', 'rock'][Math.floor(R() * 4)] };
      });
    }
  });

  // 步道：高低（rise）、彎度（bend）、樣式各不相同；只是裝飾
  const walkways = P.walkways.map(([from, to], i) => {
    const arch = i % 2 === 0;
    return {
      from, to, kind: arch ? 'arch' : 'deck',
      rise: arch ? Math.round((8 + R() * 12) * k) : Math.round(R() * 3 * k),
      bend: Math.round((R() - 0.5) * 36) / 100
    };
  });

  // 檢查最近距離，避免意外重疊
  for (let i = 0; i < abs.length; i++) for (let j = i + 1; j < abs.length; j++) {
    const c = closest(abs[i], abs[j]);
    if (c.d < P.gap - 2) console.warn('太近：', key, islands[i].zone.id, islands[j].zone.id, c.d.toFixed(1));
  }

  return {
    minWidth: P.minWidth, nodes: P.nodes, margin: P.margin, gap: P.gap,
    cellOrder: CELL_ORDER,
    islands: Object.fromEntries(islands.map((i) => [i.zone.id, { cx: i.cx, cy: i.cy, contentW: i.contentW, pts: i.pts }])),
    decor: decor.map(({ x, y, ...rest }) => rest),
    walkways
  };
}

const layouts = {};
Object.entries(PLANS).forEach(([key, P]) => {
  const L = planLayout(key, P);
  // 用網站同一套程式算一次，把位置換成「左上角對齊 margin」後的座標再存檔
  const lay = computeLayout(model, { layouts: { [key]: L } }, key);
  lay.islands.forEach((isl) => {
    L.islands[isl.zone.id].cx = Math.round(isl.cx);
    L.islands[isl.zone.id].cy = Math.round(isl.cy);
  });
  L.width = Math.round(lay.width);
  L.height = Math.round(lay.height);
  layouts[key] = L;
  console.log(key, L.width + '×' + L.height, '裝飾', L.decor.length, '件');
});

const out = {
  '說明': '地圖版面設定（不含任何作品內容）。layouts 有 wide／medium／narrow 三種螢幕寬度；islands 是各分區島嶼的中心（cx、cy）、內容寬度（contentW）與輪廓座標（pts，以島中心為原點），由 tools/gen-islands.mjs 依 seed 固定產生，每次載入形狀相同；decor 是沙洲、礁石、小浮島；walkways 是島與島之間的裝飾步道（kind：arch 拱橋／deck 棧道，rise 拱起高度，bend 彎度），只是步道，不代表作品關聯；cellOrder 是子區排列順序。作品節點位置由程式依 works.json 自動計算，作品變多放不下時島會自動等比例放大。props 是標題列旁的小插畫，subzoneProps 是子區小插畫，scenery 是島上的景物與地標建築（對應 assets/props.svg 的 id）。art 是各分區的選填插圖資產槽：填入圖片路徑（例如 assets/zones/campus.webp）就以圖片取代該區的 SVG 地形，留 null 則使用 SVG。',
  seed,
  layouts,
  props: old.props,
  subzoneProps: old.subzoneProps,
  scenery: old.scenery,
  art: old.art
};

// 輪廓座標一個點一行太長，壓成一行一個陣列，方便閱讀
let text = JSON.stringify(out, null, 2);
text = text.replace(/\[\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1, $2]').replace(/\[\s+(-?\d+),\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1, $2, $3]');
text = text.replace(/"(pts|rocks)": \[\s+([\s\S]*?)\s+\]/g, (m, k, body) => `"${k}": [${body.replace(/\s*\n\s*/g, ' ')}]`);
writeFileSync(layoutPath, text + '\n');
console.log('已寫入', layoutPath);
