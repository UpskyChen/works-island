// 右側面板（搜尋、狀態篩選、分區／連線分頁）與清單模式
import { el, statusKind, STATUS, statusIcon } from './util.js';
import { renderCard } from './detail.js';

const FILTERS = [['all', '全部'], ['live', STATUS.live.label], ['pending', STATUS.pending.label], ['frozen', STATUS.frozen.label]];

export function createPanel(root, model, { onSelect, onFilter, onLinkSelect, progress, onReset }) {
  let query = '';
  let filter = 'all';
  let tab = 'zones';
  let selected = null;

  const countOf = (k) => (k === 'all' ? model.works.length : model.works.filter((w) => statusKind(w) === k).length);

  // 你的探索進度（只存在這個瀏覽器）
  const bar = el('div', { class: 'pg-bar', role: 'progressbar', 'aria-label': '你的探索進度', 'aria-valuemin': '0', 'aria-valuemax': String(model.works.length) }, el('span', { class: 'pg-fill' }));
  const pgText = el('span', { class: 'pg-text' });
  const pgNote = el('p', { class: 'pg-note', hidden: true, text: '這個瀏覽器無法保存進度，關掉頁面後會重新計算。' });
  const progressBox = el('div', { class: 'progress' }, [
    el('div', { class: 'pg-head' }, [
      el('strong', { text: '你的探索進度' }), pgText,
      el('button', { type: 'button', class: 'pg-reset', onclick: () => onReset() }, '重新開始')
    ]),
    bar, pgNote
  ]);

  const search = el('input', {
    type: 'search', class: 'search', placeholder: '搜尋作品、標籤、分區…', 'aria-label': '搜尋作品',
    autocomplete: 'off', oninput: (e) => { query = e.target.value.trim().toLowerCase(); refresh(); }
  });
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': '依狀態篩選' }, FILTERS.map(([k, label]) => el('button', {
    type: 'button', class: 'chip', 'data-filter': k, 'aria-pressed': String(k === filter),
    onclick: () => { filter = k; refresh(); }
  }, [k === 'all' ? null : statusIcon(k), label, el('span', { class: 'chip-count', text: String(countOf(k)) })])));

  const tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': '面板分頁' }, [['zones', '分區'], ['links', '連線']].map(([k, label]) => el('button', {
    type: 'button', role: 'tab', class: 'tab', id: 'tab-' + k, 'aria-controls': 'tabpanel-' + k, 'aria-selected': String(k === tab),
    onclick: () => { tab = k; refresh(); }
  }, label)));

  const zoneList = el('div', { class: 'tabpanel', id: 'tabpanel-zones', role: 'tabpanel', 'aria-labelledby': 'tab-zones' });
  const linkList = el('div', { class: 'tabpanel', id: 'tabpanel-links', role: 'tabpanel', 'aria-labelledby': 'tab-links', hidden: true });
  const empty = el('div', { class: 'empty-result', hidden: true }, [
    el('p', { text: '找不到符合的作品，換個關鍵字或篩選條件試試看。' }),
    el('button', { type: 'button', class: 'btn-ghost', onclick: () => { query = ''; search.value = ''; filter = 'all'; refresh(); search.focus(); } }, '清除搜尋與篩選')
  ]);

  // 分區分頁
  const rows = {};
  model.zones.forEach((z) => {
    const works = model.worksInZone(z.id);
    const group = el('section', { class: 'pz zone-' + z.id, 'data-zone': z.id }, [
      el('h3', { class: 'pz-title' }, [el('span', { class: 'hex-dot', 'aria-hidden': 'true' }), z.name, el('span', { class: 'done-chip', hidden: true, text: '已逛完' }), el('span', { class: 'pz-count', text: works.length + ' 件' })])
    ]);
    const ul = el('ul', { class: 'pz-rows' });
    works.forEach((w) => {
      const kind = statusKind(w);
      const btn = el('button', { type: 'button', class: 'prow', 'data-id': w.id, onclick: () => onSelect(w.id, { source: 'panel' }) }, [
        el('span', { class: 'num-badge zone-' + w.zone, text: String(w.num) }),
        el('span', { class: 'prow-text' }, [
          el('span', { class: 'prow-name', text: w.name }),
          el('span', { class: 'prow-status st-' + kind }, [statusIcon(kind), w.status])
        ]),
        el('span', { class: 'seen', hidden: true, text: '看過' })
      ]);
      rows[w.id] = el('li', { 'data-id': w.id }, btn);
      ul.appendChild(rows[w.id]);
    });
    group.appendChild(ul);
    zoneList.appendChild(group);
  });

  // 連線分頁：只列資料檔 connections
  model.connections.forEach((c) => {
    const a = model.byId[c.from];
    const b = model.byId[c.to];
    linkList.appendChild(el('button', { type: 'button', class: 'plink ' + c.style, 'data-from': c.from, 'data-to': c.to, onclick: () => onLinkSelect(c) }, [
      el('span', { class: 'plink-ends' }, [
        el('span', { class: 'num-badge zone-' + a.zone, text: String(a.num) }), a.name,
        el('span', { class: 'line-sample ' + c.style, 'aria-hidden': 'true' }),
        el('span', { class: 'num-badge zone-' + b.zone, text: String(b.num) }), b.name
      ]),
      el('span', { class: 'plink-label', text: (c.style === 'dashed' ? '虛線｜' : '實線｜') + c.label })
    ]));
  });

  const body = el('div', { class: 'panel-body' }, [zoneList, linkList, empty]);
  root.querySelector('.panel-tools').append(progressBox, search, chips, tabs);
  root.querySelector('.panel-scroll').appendChild(body);

  function matches(w) {
    if (filter !== 'all' && statusKind(w) !== filter) return false;
    if (!query) return true;
    const zone = model.zoneById[w.zone];
    const hay = [w.name, w.status, w.subzone, zone && zone.name, ...(w.tags || [])].join(' ').toLowerCase();
    return hay.includes(query);
  }

  function refresh() {
    chips.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    tabs.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.id === 'tab-' + tab)));
    zoneList.hidden = tab !== 'zones';
    linkList.hidden = tab !== 'links';
    const visible = new Set(model.works.filter(matches).map((w) => w.id));
    Object.entries(rows).forEach(([id, li]) => { li.hidden = !visible.has(id); });
    zoneList.querySelectorAll('.pz').forEach((g) => { g.hidden = !g.querySelector('li:not([hidden])'); });
    linkList.querySelectorAll('.plink').forEach((b) => { b.hidden = !(visible.has(b.dataset.from) || visible.has(b.dataset.to)); });
    const shown = tab === 'zones' ? visible.size : linkList.querySelectorAll('.plink:not([hidden])').length;
    empty.hidden = shown > 0;
    const active = query || filter !== 'all';
    onFilter(active ? visible : null);
  }

  function setSelected(id, { scroll = true } = {}) {
    selected = id;
    root.querySelectorAll('.prow').forEach((b) => b.classList.toggle('is-selected', b.dataset.id === id));
    root.querySelectorAll('.prow').forEach((b) => b.setAttribute('aria-current', b.dataset.id === id ? 'true' : 'false'));
    root.querySelectorAll('.plink').forEach((b) => b.classList.toggle('is-related', !!id && (b.dataset.from === id || b.dataset.to === id)));
    if (id && scroll && tab === 'zones' && rows[id] && !rows[id].hidden) {
      const sc = root.querySelector('.panel-scroll');
      const r = rows[id].getBoundingClientRect();
      const s = sc.getBoundingClientRect();
      if (r.top < s.top || r.bottom > s.bottom) sc.scrollTo({ top: sc.scrollTop + (r.top - s.top) - s.height / 2 + r.height / 2, behavior: 'smooth' });
    }
  }

  function setProgress() {
    const n = progress.count();
    const total = progress.total();
    pgText.textContent = `已看過 ${n}／${total} 件`;
    bar.setAttribute('aria-valuenow', String(n));
    bar.querySelector('.pg-fill').style.width = (total ? (n / total) * 100 : 0) + '%';
    pgNote.hidden = progress.storageOk;
    Object.keys(rows).forEach((id) => {
      const seen = progress.has(id);
      rows[id].querySelector('.prow').classList.toggle('is-visited', seen);
      rows[id].querySelector('.seen').hidden = !seen;
    });
    zoneList.querySelectorAll('.pz').forEach((g) => { g.querySelector('.done-chip').hidden = !progress.zoneDone(g.dataset.zone); });
  }

  refresh();
  setProgress();
  return { setSelected, refresh, setProgress, get selected() { return selected; } };
}

// 清單模式：給校長、主任快速掃描；每列可展開詳情，或「在島上定位」
export function renderListView(box, model, { onLocate }) {
  box.textContent = '';
  let count = 0;
  const sections = model.zones.map((z) => {
    const works = model.worksInZone(z.id);
    count += works.length;
    const sec = el('section', { class: 'list-zone zone-' + z.id }, [
      el('h3', null, [el('span', { class: 'hex-dot', 'aria-hidden': 'true' }), `${z.name}（${works.length} 件）`])
    ]);
    if (z.note) sec.appendChild(el('p', { class: 'zone-note', text: z.note }));
    const usesCells = works.length && works.every((w) => w.subzone);
    if (usesCells) {
      const names = (z.subzones || []).slice();
      works.forEach((w) => { if (!names.includes(w.subzone)) names.push(w.subzone); });
      const empties = Object.fromEntries((z.emptySubzones || []).map((e) => [e.name, e.note]));
      names.forEach((name) => {
        const list = works.filter((w) => w.subzone === name);
        sec.appendChild(el('h4', { class: 'list-sub', text: `${name}（${list.length}）` }));
        if (list.length) sec.appendChild(listRows(list));
        else sec.appendChild(el('p', { class: 'empty-sub', text: empties[name] || '' }));
      });
    } else {
      sec.appendChild(listRows(works));
    }
    return sec;
  });
  box.appendChild(el('h2', { class: 'list-title' }, ['作品清單・共 ', el('strong', { id: 'total-list', text: String(count) }), ' 件']));
  sections.forEach((s) => box.appendChild(s));

  function listRows(works) {
    return el('ul', { class: 'rows' }, works.map((w) => {
      const kind = statusKind(w);
      return el('li', { class: 'row' }, [
        el('details', null, [
          el('summary', null, [
            el('span', { class: 'num-badge zone-' + w.zone, text: String(w.num) }),
            el('span', { class: 'row-name', text: w.name }),
            el('span', { class: 'status st-' + kind }, [statusIcon(kind), w.status])
          ]),
          renderCard(w, model, { inList: true })
        ]),
        el('button', { type: 'button', class: 'locate', onclick: () => onLocate(w.id), 'aria-label': '在島上定位：' + w.name }, '在島上定位')
      ]);
    }));
  }
}
