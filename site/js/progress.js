// 你的探索進度：記錄這個瀏覽器看過哪些作品（只存在訪客自己的 localStorage，不送出任何網路請求）。
// localStorage 無法使用時（隱私模式、被封鎖）改為只在本次瀏覽中計算，不報錯。
const KEY = 'works-island:visited:v1';

export function createProgress(model) {
  let storageOk = true;
  const visited = new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) JSON.parse(raw).forEach((id) => { if (model.byId[id]) visited.add(id); });
  } catch (e) {
    storageOk = false;
  }
  const save = () => {
    try { window.localStorage.setItem(KEY, JSON.stringify([...visited])); } catch (e) { storageOk = false; }
  };
  const zoneDone = (zid) => {
    const ws = model.worksInZone(zid);
    return ws.length > 0 && ws.every((w) => visited.has(w.id));
  };

  return {
    // 回傳這次是否剛好逛完一區、逛完全部
    visit(id) {
      const w = model.byId[id];
      if (!w || visited.has(id)) return { isNew: false, zoneDone: null, allDone: false };
      const before = zoneDone(w.zone);
      visited.add(id);
      save();
      return {
        isNew: true,
        zoneDone: !before && zoneDone(w.zone) ? w.zone : null,
        allDone: visited.size === model.works.length
      };
    },
    reset() {
      visited.clear();
      try { window.localStorage.removeItem(KEY); } catch (e) { storageOk = false; }
    },
    has: (id) => visited.has(id),
    count: () => visited.size,
    total: () => model.works.length,
    zoneDone,
    doneZones: () => model.zones.filter((z) => zoneDone(z.id)).map((z) => z.id),
    get storageOk() { return storageOk; }
  };
}
