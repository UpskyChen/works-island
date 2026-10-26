// 讀取 data/works.json 與 data/layout.json，套用顯示規則（works.json 的 displayRules），並做件數對帳
export async function loadData() {
  const [raw, layout] = await Promise.all([fetchJson('data/works.json'), fetchJson('data/layout.json')]);
  return { model: prepare(raw), layoutConfig: layout };
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  return r.json();
}

function applyDisplayRules(data) {
  const targets = {};
  data.works.forEach((w) => { targets[w.id] = w; });
  data.zones.forEach((z) => { targets['zone:' + z.id] = z; });
  (data.displayRules || []).forEach((rule) => {
    // field 可以是 "verification.note" 這種巢狀欄位
    const path = rule.field.split('.');
    const key = path.pop();
    const t = path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), targets[rule.id]);
    if (!t || typeof t[key] !== 'string' || !t[key].includes(rule.remove)) {
      console.warn('[display-rules] 找不到原文，規則未套用：', rule);
      return;
    }
    t[key] = t[key].split(rule.remove).join('');
  });
}

export function prepare(raw) {
  const data = JSON.parse(JSON.stringify(raw)); // 顯示用副本，原始資料不動
  applyDisplayRules(data);
  const works = data.works.map((w, i) => Object.assign(w, { num: i + 1 }));
  const byId = {};
  works.forEach((w) => { byId[w.id] = w; });
  const zoneById = {};
  data.zones.forEach((z) => { zoneById[z.id] = z; });
  const worksInZone = (zoneId) => works.filter((w) => w.zone === zoneId);

  // 自我對帳：資料檔記載的件數與實際筆數不符時提示站主
  if (data.meta && data.meta.totalWorks !== works.length) {
    console.warn('[對帳] meta.totalWorks 與作品筆數不符', data.meta.totalWorks, works.length);
  }
  data.zones.forEach((z) => {
    const n = worksInZone(z.id).length;
    if (z.count !== undefined && z.count !== n) console.warn('[對帳] 分區件數不符', z.id, z.count, n);
  });

  // 只保留兩端作品都存在的連線
  const connections = data.connections.filter((c) => byId[c.from] && byId[c.to]);

  return {
    meta: data.meta, intro: data.intro, zones: data.zones, zoneById,
    ui: data.ui || {}, statusLegend: data.statusLegend || [], connectionTypes: data.connectionTypes || [],
    works, byId, connections, worksInZone
  };
}
