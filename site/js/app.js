// 阿喵老師的作品島：讀取 data/works.json，產生島嶼地圖、清單與詳情卡。
// 作品內容全部來自資料檔；本檔只負責版面。新增作品只需改資料檔。
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  // 三種地圖版面（依容器寬度切換）。rows 是島嶼的排列與寬度，島的高度依內容自動計算。
  // cellOrder 是教材區子區在地圖上的排列順序（讓與 3D 校園相連的藝文子區靠近校園）；
  // 不在清單內的子區會自動排到最後。
  var LAYOUTS = {
    wide: {
      minWidth: 1000, width: 1200, margin: 30, gap: 40, labels: true,
      rows: [[['campus', 400], ['subjects', 700]], [['tools', 330], ['games', 380], ['frozen', 330]]],
      cellOrder: { subjects: ['藝文', '英文', '數學', '社會', '國語', '自然'] }
    },
    medium: {
      minWidth: 600, width: 800, margin: 24, gap: 30, labels: true,
      rows: [[['subjects', 752]], [['campus', 361], ['tools', 361]], [['games', 361], ['frozen', 361]]],
      cellOrder: { subjects: ['英文', '數學', '藝文', '社會', '國語', '自然'] }
    },
    narrow: {
      minWidth: 0, width: 420, margin: 16, gap: 22, labels: false,
      rows: [[['subjects', 388]], [['campus', 388]], [['tools', 388]], [['games', 388]], [['frozen', 388]]],
      cellOrder: { subjects: ['英文', '數學', '藝文', '社會', '國語', '自然'] }
    }
  };

  // 節點尺寸：labels=true 顯示名稱，false 只顯示編號（手機）。
  var METRICS = {
    labels: { slot: 110, minCell: 150, emptyMin: 170, maxSpacing: 190, labelSpace: 140,
      r: 12, nodeTop: 22, nodeBlock: 96, staggerDy: 56, relDy: 0, noteChars: 12 },
    numbers: { slot: 50, minCell: 86, emptyMin: 160, maxSpacing: 90, labelSpace: 0,
      r: 15, nodeTop: 24, nodeBlock: 50, staggerDy: 0, relDy: 20, noteChars: 11 }
  };
  var ISLAND_PAD = 14, ISLAND_HEAD = 44, CELL_HEAD = 26, CELL_GAP = 10;

  var state = { data: null, works: [], byId: {}, zones: {}, mode: 'map', layoutKey: null, selected: null };

  // ---------- 工具 ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    setAttrs(node, attrs);
    appendAll(node, children);
    return node;
  }
  function svg(tag, attrs, children) {
    var node = document.createElementNS(SVGNS, tag);
    setAttrs(node, attrs);
    appendAll(node, children);
    return node;
  }
  function setAttrs(node, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.setAttribute('class', v);
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
  }
  function appendAll(node, children) {
    if (!children) return;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }

  // ---------- 資料 ----------
  function applyDisplayRules(data) {
    var rules = window.DISPLAY_RULES || [];
    var targets = {};
    data.works.forEach(function (w) { targets[w.id] = w; });
    data.zones.forEach(function (z) { targets['zone:' + z.id] = z; });
    rules.forEach(function (rule) {
      var t = targets[rule.id];
      if (!t || typeof t[rule.field] !== 'string' || t[rule.field].indexOf(rule.remove) === -1) {
        console.warn('[display-rules] 找不到原文，規則未套用：', rule);
        return;
      }
      t[rule.field] = t[rule.field].split(rule.remove).join('');
    });
  }

  function prepare(raw) {
    var data = JSON.parse(JSON.stringify(raw)); // 顯示用副本，原始資料不動
    applyDisplayRules(data);
    state.data = data;
    state.works = data.works.map(function (w, i) {
      w.num = i + 1;
      return w;
    });
    state.works.forEach(function (w) { state.byId[w.id] = w; });
    data.zones.forEach(function (z) { state.zones[z.id] = z; });

    // 自我對帳：資料檔記載的件數與實際筆數不符時提示站主
    var total = state.works.length;
    if (data.meta && data.meta.totalWorks !== total) console.warn('[對帳] meta.totalWorks 與作品筆數不符', data.meta.totalWorks, total);
    data.zones.forEach(function (z) {
      var n = worksInZone(z.id).length;
      if (z.count !== undefined && z.count !== n) console.warn('[對帳] 分區件數不符', z.id, z.count, n);
    });
  }

  function worksInZone(zoneId) {
    return state.works.filter(function (w) { return w.zone === zoneId; });
  }

  // 有子區的分區：該區每件作品都標了 subzone（教材區）。回傳 [{name, works, note}]
  function cellsOf(zone, order) {
    var works = worksInZone(zone.id);
    var usesCells = works.length > 0 && works.every(function (w) { return w.subzone; });
    if (!usesCells) return null;
    var names = (zone.subzones || []).slice();
    works.forEach(function (w) { if (names.indexOf(w.subzone) === -1) names.push(w.subzone); });
    var empties = {};
    (zone.emptySubzones || []).forEach(function (e) { empties[e.name] = e.note; });
    if (order) {
      names.sort(function (a, b) {
        var ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    }
    return names.map(function (name) {
      var list = works.filter(function (w) { return w.subzone === name; });
      return { name: name, works: list, note: list.length ? null : (empties[name] || '目前尚無獨立作品') };
    });
  }

  // 依 connections 把同一格內相連的作品排成一條鏈（例如英文家族），其他照資料順序
  function chainOrder(works) {
    var ids = works.map(function (w) { return w.id; });
    var next = {}, hasPrev = {};
    state.data.connections.forEach(function (c) {
      if (ids.indexOf(c.from) !== -1 && ids.indexOf(c.to) !== -1 && !next[c.from]) {
        next[c.from] = c.to; hasPrev[c.to] = true;
      }
    });
    var out = [];
    ids.forEach(function (id) {
      if (hasPrev[id] || out.indexOf(id) !== -1) return;
      var cur = id;
      while (cur && out.indexOf(cur) === -1) { out.push(cur); cur = next[cur]; }
    });
    ids.forEach(function (id) { if (out.indexOf(id) === -1) out.push(id); });
    return out.map(function (id) { return state.byId[id]; });
  }

  function statusKind(w) {
    if (w.zone === 'frozen') return 'frozen';
    if (/待|尚未|升級中|需登入/.test(w.status)) return 'pending';
    return 'live';
  }

  // 地圖節點用的短名稱：去掉全形括號說明，太長時在空格或「・」處斷成兩行
  function labelLines(name) {
    var short = name.replace(/（[^）]*）/g, '').trim();
    if (short.length <= 8) return [short];
    var m = short.match(/^(.+?)[ ・](.+)$/);
    return m ? [m[1], m[2]] : [short];
  }

  function wrapChars(text, perLine) {
    var lines = [], cur = '', width = 0;
    Array.from(text).forEach(function (ch) {
      var w = /[\u0000-ÿ]/.test(ch) ? 0.55 : 1;
      // 行首避頭：右括號與句讀接在上一行
      if (width + w > perLine && cur && !/[）)。，、」]/.test(ch)) { lines.push(cur); cur = ''; width = 0; }
      cur += ch; width += w;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- 頁首、介紹、頁尾 ----------
  function sentences(text) {
    return (text.match(/[^。]*。|[^。]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function renderHeader() {
    var meta = state.data.meta, intro = state.data.intro;
    document.title = meta.title;
    document.getElementById('site-title').textContent = meta.title;
    var ss = sentences(intro.text);
    document.getElementById('tagline').textContent = ss[0] || '';
    document.getElementById('total-header').textContent = String(state.works.length);

    document.getElementById('about-heading').textContent = intro.heading || '關於我';
    var box = document.getElementById('intro');
    box.textContent = '';
    for (var i = 0; i < ss.length; i += 2) box.appendChild(el('p', { text: ss.slice(i, i + 2).join('') }));

    document.getElementById('footer-text').textContent =
      meta.title + '・' + meta.owner + '・資料版本 ' + meta.dataVersion;
  }

  // ---------- 圖例 ----------
  function renderLegend() {
    var box = document.getElementById('legend');
    box.textContent = '';
    var counts = state.data.zones.map(function (z) { return worksInZone(z.id).length; });
    var list = el('ul', { class: 'legend-zones' });
    state.data.zones.forEach(function (z, i) {
      list.appendChild(el('li', { class: 'zone-' + z.id }, [
        el('span', { class: 'swatch', 'aria-hidden': 'true' }),
        z.name + ' ',
        el('strong', { text: String(counts[i]) }), ' 件'
      ]));
    });
    box.appendChild(el('p', { class: 'legend-total' }, ['全島共 ', el('strong', { id: 'total-legend', text: String(sum(counts)) }), ' 件']));
    box.appendChild(list);
    box.appendChild(el('ul', { class: 'legend-lines' }, [
      el('li', null, [el('span', { class: 'line-sample solid', 'aria-hidden': 'true' }), '實線：作品關聯']),
      el('li', null, [el('span', { class: 'line-sample dashed', 'aria-hidden': 'true' }), '虛線：關聯但尚未串接入口'])
    ]));
  }

  // ---------- 地圖 ----------
  function pickLayout() {
    var w = document.getElementById('map').clientWidth || window.innerWidth;
    if (w >= LAYOUTS.wide.minWidth) return 'wide';
    if (w >= LAYOUTS.medium.minWidth) return 'medium';
    return 'narrow';
  }

  // 一格（子區或整座島）內的節點擺放，回傳高度
  function placeNodes(works, x, y, w, M, labels, pos) {
    var maxPerLine = Math.max(1, Math.floor(w / M.slot));
    var cy = y, i;
    for (var start = 0; start < works.length; start += maxPerLine) {
      var line = works.slice(start, start + maxPerLine);
      var spacing = Math.min(w / line.length, M.maxSpacing);
      var hasRel = line.some(function (wk) { return wk.relationLabel; });
      // 名稱過擠，或有「延伸作品」時錯位排列（延伸作品落在主作品右下方）
      var stagger = labels && line.length > 1 && (spacing < M.labelSpace || hasRel);
      var x0 = x + (w - spacing * line.length) / 2 + spacing / 2;
      for (i = 0; i < line.length; i++) {
        pos[line[i].id] = [x0 + i * spacing, cy + M.nodeTop + (stagger && i % 2 ? M.staggerDy : 0)];
      }
      cy += M.nodeBlock + (stagger ? M.staggerDy : 0) + (hasRel ? M.relDy : 0);
    }
    return cy - y;
  }

  function computeLayout(key) {
    var L = LAYOUTS[key], M = L.labels ? METRICS.labels : METRICS.numbers;
    var islands = [], pos = {}, y = L.margin;

    L.rows.forEach(function (row) {
      var rowW = sum(row.map(function (r) { return r[1]; })) + L.gap * (row.length - 1);
      var x = (L.width - rowW) / 2, rowH = 0, rowIslands = [];
      row.forEach(function (r) {
        var zone = state.zones[r[0]];
        if (!zone) return;
        var w = r[1], inner = w - ISLAND_PAD * 2, top = y + ISLAND_HEAD;
        var cells = cellsOf(zone, L.cellOrder[zone.id]), cellBoxes = [], h;
        if (cells) {
          // 子區格子：依最小寬度換行，再按比例撐滿一列
          var lines = [[]], used = 0;
          cells.forEach(function (c) {
            c.min = c.works.length ? Math.max(M.minCell, c.works.length * M.slot + 20) : M.emptyMin;
            var need = c.min + (lines[lines.length - 1].length ? CELL_GAP : 0);
            if (used + need > inner && lines[lines.length - 1].length) { lines.push([]); used = 0; need = c.min; }
            lines[lines.length - 1].push(c); used += need;
          });
          var cy = top;
          lines.forEach(function (line) {
            var free = inner - CELL_GAP * (line.length - 1);
            var scale = free / sum(line.map(function (c) { return c.min; }));
            var cx = x + ISLAND_PAD, lineH = 0;
            line.forEach(function (c) {
              var cw = c.min * scale, ch;
              if (c.works.length) {
                ch = CELL_HEAD + placeNodes(chainOrder(c.works), cx + 6, cy + CELL_HEAD, cw - 12, M, L.labels, pos);
              } else {
                c.noteLines = wrapChars(c.note, Math.floor((cw - 24) / 12.5));
                ch = CELL_HEAD + c.noteLines.length * 16 + 12;
              }
              cellBoxes.push({ cell: c, x: cx, y: cy, w: cw, h: ch });
              lineH = Math.max(lineH, ch);
              cx += cw + CELL_GAP;
            });
            cellBoxes.forEach(function (b) { if (b.y === cy) b.h = lineH; });
            cy += lineH + CELL_GAP;
          });
          h = cy - CELL_GAP - y + ISLAND_PAD;
        } else {
          h = ISLAND_HEAD + placeNodes(worksInZone(zone.id), x + ISLAND_PAD, top, inner, M, L.labels, pos) + ISLAND_PAD - 8;
        }
        rowIslands.push({ zone: zone, x: x, y: y, w: w, h: h, cells: cellBoxes, contentH: h });
        rowH = Math.max(rowH, h);
        x += w + L.gap;
      });
      rowIslands.forEach(function (isl) {
        // 同一列中較矮的島：節點垂直置中
        var dy = isl.cells.length ? 0 : (rowH - isl.contentH) / 2;
        if (dy) worksInZone(isl.zone.id).forEach(function (w) { if (pos[w.id]) pos[w.id][1] += dy; });
        isl.h = rowH;
      });
      islands = islands.concat(rowIslands);
      y += rowH + L.gap;
    });
    return { key: key, L: L, M: M, islands: islands, pos: pos, width: L.width, height: y - L.gap + L.margin };
  }

  function renderMap(force) {
    var host = document.getElementById('map');
    if (host.offsetParent === null) return; // 清單模式時不畫
    var key = pickLayout();
    if (!force && key === state.layoutKey && host.firstChild) return;
    state.layoutKey = key;
    drawMap(computeLayout(key), host);

    // 防呆：名稱標籤若互相重疊，改用只顯示編號的版面
    if (LAYOUTS[key].labels && labelsOverlap(host)) {
      console.warn('[map] 名稱標籤重疊，改用編號版面');
      state.layoutKey = 'narrow';
      drawMap(computeLayout('narrow'), host);
    }
    renderMapIndex(!LAYOUTS[state.layoutKey].labels);
    if (state.selected) markSelected(state.selected);
  }

  function drawMap(lay, host) {
    var L = lay.L, M = lay.M;
    var root = svg('svg', {
      viewBox: '0 0 ' + lay.width + ' ' + Math.ceil(lay.height),
      class: 'island-map layout-' + lay.key, role: 'group', 'aria-label': state.data.meta.title + '地圖'
    });
    root.appendChild(svg('rect', { class: 'sea', x: 0, y: 0, width: lay.width, height: Math.ceil(lay.height), rx: 18 }));

    var gIslands = svg('g'), gTitles = svg('g', { class: 'titles' }), gLines = svg('g', { class: 'links' }), gNodes = svg('g');
    lay.islands.forEach(function (isl) {
      var z = isl.zone, n = worksInZone(z.id).length;
      var g = svg('g', { class: 'island zone-' + z.id });
      g.appendChild(svg('rect', { class: 'beach', x: isl.x - 5, y: isl.y - 5, width: isl.w + 10, height: isl.h + 10, rx: 40 }));
      g.appendChild(svg('rect', { class: 'land', x: isl.x, y: isl.y, width: isl.w, height: isl.h, rx: 34 }));
      gTitles.appendChild(svg('text', { class: 'island-name', x: isl.x + 22, y: isl.y + 29 }, [
        z.name, svg('tspan', { class: 'island-count', dx: 8, text: n + ' 件' })
      ]));
      isl.cells.forEach(function (b) {
        var c = b.cell;
        g.appendChild(svg('rect', { class: 'cell' + (c.works.length ? '' : ' empty'), x: b.x, y: b.y, width: b.w, height: b.h, rx: 14 }));
        gTitles.appendChild(svg('text', { class: 'cell-name', x: b.x + 12, y: b.y + 18 }, [
          c.name, svg('tspan', { class: 'cell-count', dx: 6, text: String(c.works.length) })
        ]));
        if (!c.works.length) {
          c.noteLines.forEach(function (line, i) {
            gTitles.appendChild(svg('text', { class: 'cell-note', x: b.x + 12, y: b.y + CELL_HEAD + 14 + i * 16, text: line }));
          });
        }
      });
      gIslands.appendChild(g);
    });

    state.data.connections.forEach(function (c) {
      var a = lay.pos[c.from], b = lay.pos[c.to];
      if (!a || !b) return;
      gLines.appendChild(svg('line', {
        class: 'link ' + (c.style === 'dashed' ? 'dashed' : 'solid'),
        x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'data-from': c.from, 'data-to': c.to
      }, svg('title', { text: state.byId[c.from].name + ' → ' + state.byId[c.to].name + '：' + c.label })));
    });

    state.works.forEach(function (w) {
      var p = lay.pos[w.id];
      if (!p) return;
      var g = svg('g', {
        class: 'node zone-' + w.zone + ' status-' + statusKind(w), 'data-id': w.id,
        tabindex: 0, role: 'button', 'aria-label': w.num + '. ' + w.name,
        transform: 'translate(' + p[0] + ' ' + p[1] + ')',
        onclick: function () { select(w.id, { scroll: true }); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(w.id, { scroll: true }); } }
      });
      g.appendChild(svg('circle', { class: 'hit', r: M.r + 10 }));
      g.appendChild(svg('circle', { class: 'ring', r: M.r + 6 }));
      g.appendChild(svg('circle', { class: 'dot', r: M.r }));
      g.appendChild(svg('text', { class: 'num', y: 0.5, 'dominant-baseline': 'middle', text: String(w.num) }));
      var label = svg('g', { class: 'label' }), ly = M.r + 17;
      if (L.labels) {
        labelLines(w.name).forEach(function (line) {
          label.appendChild(svg('text', { class: 'label-text', y: ly, text: line }));
          ly += 17;
        });
      }
      if (w.relationLabel) label.appendChild(svg('text', { class: 'label-rel', y: ly, text: w.relationLabel }));
      if (label.firstChild) g.appendChild(label);
      g.appendChild(svg('title', { text: w.name }));
      gNodes.appendChild(g);
    });

    root.appendChild(gIslands);
    root.appendChild(gLines);
    root.appendChild(gTitles);
    root.appendChild(gNodes);
    host.textContent = '';
    host.appendChild(root);
  }

  function labelsOverlap(host) {
    function rect(n) { return n ? n.getBoundingClientRect() : null; }
    function hit(a, b) { return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; }
    var nodes = Array.prototype.map.call(host.querySelectorAll('.node'), function (g) {
      return { label: rect(g.querySelector('.label')), dot: rect(g.querySelector('.dot')) };
    });
    for (var i = 0; i < nodes.length; i++) {
      for (var j = 0; j < nodes.length; j++) {
        if (i === j || !nodes[i].label || !nodes[i].label.width) continue;
        if (hit(nodes[i].label, nodes[j].dot)) return true;
        if (j > i && nodes[j].label && hit(nodes[i].label, nodes[j].label)) return true;
      }
    }
    return false;
  }

  function renderMapIndex(show) {
    var box = document.getElementById('map-index');
    box.textContent = '';
    box.hidden = !show;
    if (!show) return;
    state.works.forEach(function (w) {
      box.appendChild(el('li', { class: 'zone-' + w.zone }, el('button', {
        type: 'button', 'data-id': w.id, onclick: function () { select(w.id, { scroll: true }); }
      }, [el('span', { class: 'idx-num', text: String(w.num) }), w.name])));
    });
  }

  function markSelected(id) {
    document.querySelectorAll('.node.is-selected, .map-index .is-selected').forEach(function (n) { n.classList.remove('is-selected'); });
    document.querySelectorAll('[data-id="' + id + '"]').forEach(function (n) {
      if (n.classList.contains('node') || n.closest('.map-index')) n.classList.add('is-selected');
    });
    document.querySelectorAll('.link').forEach(function (l) {
      l.classList.toggle('is-active', l.getAttribute('data-from') === id || l.getAttribute('data-to') === id);
    });
  }

  // ---------- 詳情卡 ----------
  function renderCard(w, opts) {
    opts = opts || {};
    var zone = state.zones[w.zone];
    var card = el('article', { class: 'card zone-' + w.zone, 'data-card': w.id });
    var meta = [zone ? zone.name : w.zone];
    if (w.subzone) meta.push(w.subzone);
    if (w.audience) meta.push('對象：' + w.audience);

    if (!opts.inList) {
      card.appendChild(el('header', { class: 'card-head' }, [
        el('span', { class: 'card-num', text: '#' + w.num }),
        el('h3', { text: w.name })
      ]));
    }
    card.appendChild(el('p', { class: 'card-meta', text: meta.join('・') }));
    var badges = el('p', { class: 'badges' }, el('span', { class: 'status status-' + statusKind(w), text: w.status }));
    if (w.relationLabel) badges.appendChild(el('span', { class: 'rel-badge', text: w.relationLabel }));
    card.appendChild(badges);

    var steps = [['問題', w.problem], ['做法', w.approach], ['成果', w.result]].filter(function (s) { return s[1]; });
    if (steps.length) {
      card.appendChild(el('dl', { class: 'pra' }, steps.reduce(function (acc, s) {
        return acc.concat([el('dt', { text: s[0] }), el('dd', { text: s[1] })]);
      }, [])));
    }
    if (w.displayNote) card.appendChild(el('p', { class: 'note' }, [el('strong', { text: '說明　' }), w.displayNote]));
    if (w.freezeReason) card.appendChild(el('p', { class: 'note freeze' }, [el('strong', { text: '凍結原因　' }), w.freezeReason]));

    if (w.subzoneItems) {
      var home = w.links && w.links[0] ? w.links[0].url : null;
      var order = (zone && zone.subzones) || Object.keys(w.subzoneItems);
      var total = 0;
      var groups = el('div', { class: 'subzones' });
      order.forEach(function (name) {
        var items = w.subzoneItems[name];
        if (!items) return;
        total += items.length;
        groups.appendChild(el('div', { class: 'subzone' }, [
          el('h4', { text: name + '（' + items.length + '）' }),
          el('ul', null, items.map(function (it) {
            return el('li', null, home ? el('a', { href: home, target: '_blank', rel: 'noopener' }, it) : it);
          }))
        ]));
      });
      card.appendChild(el('h4', { class: 'subzones-title', text: '站內五小區，共 ' + total + ' 個子頁' }));
      card.appendChild(groups);
      if (w.subzoneNote) card.appendChild(el('p', { class: 'note' }, w.subzoneNote));
    }

    var rel = state.data.connections.filter(function (c) { return c.from === w.id || c.to === w.id; });
    if (rel.length) {
      card.appendChild(el('ul', { class: 'relations' }, rel.map(function (c) {
        var other = state.byId[c.from === w.id ? c.to : c.from];
        return el('li', { class: c.style === 'dashed' ? 'dashed' : 'solid' }, [
          '關聯：',
          el('button', { type: 'button', class: 'link-btn', onclick: function () { locate(other.id); } }, other.name),
          '｜' + c.label
        ]);
      })));
    }

    if (w.tags && w.tags.length) {
      card.appendChild(el('p', { class: 'tags' }, w.tags.map(function (t) { return el('span', { class: 'tag', text: t }); })));
    }
    if (w.links && w.links.length) {
      card.appendChild(el('p', { class: 'links' }, w.links.map(function (l) {
        return el('a', { class: 'btn', href: l.url, target: '_blank', rel: 'noopener' }, l.label);
      })));
    }
    return card;
  }

  function select(id, opts) {
    var w = state.byId[id];
    if (!w) return;
    state.selected = id;
    markSelected(id);
    var panel = document.getElementById('card-panel');
    panel.textContent = '';
    panel.appendChild(renderCard(w));
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    if (opts && opts.scroll && state.layoutKey !== 'wide') panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 從清單或關聯跳回島上定位
  function locate(id) {
    setMode('map');
    select(id);
    var node = document.querySelector('.node[data-id="' + id + '"]');
    if (node) {
      node.classList.remove('pulse');
      void node.getBoundingClientRect();
      node.classList.add('pulse');
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.focus({ preventScroll: true });
    }
  }

  // ---------- 清單 ----------
  function renderList() {
    var box = document.getElementById('list-view');
    box.textContent = '';
    var count = 0;
    var sections = state.data.zones.map(function (z) {
      var works = worksInZone(z.id);
      count += works.length;
      var sec = el('section', { class: 'list-zone zone-' + z.id }, [
        el('h3', null, [el('span', { class: 'swatch', 'aria-hidden': 'true' }), z.name + '（' + works.length + ' 件）'])
      ]);
      if (z.note) sec.appendChild(el('p', { class: 'zone-note', text: z.note }));
      var cells = cellsOf(z);
      if (cells) {
        cells.forEach(function (c) {
          sec.appendChild(el('h4', { class: 'list-sub', text: c.name + '（' + c.works.length + '）' }));
          if (c.works.length) sec.appendChild(listRows(c.works));
          else sec.appendChild(el('p', { class: 'empty-sub', text: c.note }));
        });
      } else {
        sec.appendChild(listRows(works));
      }
      return sec;
    });
    box.appendChild(el('h3', { class: 'list-title' }, ['作品清單・共 ', el('strong', { id: 'total-list', text: String(count) }), ' 件']));
    sections.forEach(function (s) { box.appendChild(s); });
  }

  function listRows(works) {
    return el('ul', { class: 'rows' }, works.map(function (w) {
      var details = el('details', null, [
        el('summary', null, [
          el('span', { class: 'row-num', text: String(w.num) }),
          el('span', { class: 'row-name', text: w.name }),
          el('span', { class: 'status status-' + statusKind(w), text: w.status })
        ]),
        renderCard(w, { inList: true })
      ]);
      return el('li', { class: 'row' }, [
        details,
        el('button', { type: 'button', class: 'locate', onclick: function () { locate(w.id); }, 'aria-label': '在島上定位：' + w.name }, '在島上定位')
      ]);
    }));
  }

  // ---------- 模式切換 ----------
  function setMode(mode) {
    state.mode = mode;
    document.getElementById('map-view').hidden = mode !== 'map';
    document.getElementById('list-view').hidden = mode !== 'list';
    document.getElementById('mode-map').setAttribute('aria-pressed', String(mode === 'map'));
    document.getElementById('mode-list').setAttribute('aria-pressed', String(mode === 'list'));
    if (mode === 'map') renderMap(true);
  }

  // ---------- 啟動 ----------
  function init(raw) {
    prepare(raw);
    renderHeader();
    renderLegend();
    renderList();
    document.getElementById('mode-map').addEventListener('click', function () { setMode('map'); });
    document.getElementById('mode-list').addEventListener('click', function () { setMode('list'); });
    setMode('map');
    var hashId = decodeURIComponent(location.hash.slice(1));
    select(state.byId[hashId] ? hashId : state.works[0].id);
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { renderMap(false); }, 150);
    });
  }

  fetch('data/works.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(init)
    .catch(function (err) {
      document.getElementById('load-error').hidden = false;
      console.error('作品資料載入失敗', err);
    });
})();
