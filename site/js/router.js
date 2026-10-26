// 網址 hash 深層連結：#作品id 直接開啟並聚焦；選取時寫入歷史紀錄，上一頁／下一頁可用
export function currentId() {
  try { return decodeURIComponent(location.hash.slice(1)) || null; } catch (e) { return null; }
}

export function navigate(id, { replace = false } = {}) {
  if (currentId() === (id || null)) return;
  const url = id ? '#' + encodeURIComponent(id) : location.pathname + location.search;
  history[replace ? 'replaceState' : 'pushState']({ id: id || null }, '', url);
}

export function onRoute(fn) {
  let last = currentId();
  const handle = () => {
    const id = currentId();
    if (id === last) return;
    last = id;
    fn(id);
  };
  window.addEventListener('popstate', handle);
  window.addEventListener('hashchange', handle);
  return { sync: () => { last = currentId(); } };
}
