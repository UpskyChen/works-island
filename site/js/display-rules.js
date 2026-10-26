// 顯示規則層：資料檔 data/works.json 一字不改，這裡只決定「畫面上不顯示哪一段文字」。
// 資料檔中有些句子是給製作者的施工指示（例如「不要猜子頁網址」）或計件說明，
// 不適合原樣顯示給訪客，因此在顯示時刪掉；規則只做逐字刪除，不改寫、不新增任何字。
//
// 每條規則：{ id: 作品 id（或 "zone:<zone id>"）, field: 欄位名, remove: 要從顯示中刪掉的原文片段 }
// 若某條規則的原文片段在資料檔中找不到（例如站主已改過資料），該規則自動失效並在 console 提示。
window.DISPLAY_RULES = [
  // 括號類的出處註記不顯示
  { id: "sky-games", field: "problem", remove: "（站主本人 README 原意）" },
  { id: "math-5", field: "problem", remove: "（站主本人 README 原意）" },
  { id: "sky-games", field: "subzoneNote", remove: "（站主本人）" },

  // excluded 項目的名稱不得出現在站上
  { id: "english-speaking-coach", field: "result", remove: "舊的 englishspeak 站是練習版本，已由站主指示不收錄，不要放它的連結。" },

  // 給製作者的施工指示，不顯示給訪客（事實部分保留）
  { id: "english-1000-words", field: "displayNote", remove: "展示必須照實註明，不得寫成他的原創教材內容。" },
  { id: "english-1000-words", field: "result", remove: "，計 1 件" },
  { id: "english-ww7", field: "result", remove: "原始子頁連結曾有 404，展示連結一律用站首頁，不要猜子頁網址。" },
  { id: "xikou-kart", field: "result", remove: "，展示時照實標註，不要寫成全部驗收完成" },
  { id: "social-history", field: "displayNote", remove: "卡片只顯示名稱、學科、連結與本註記，problem 與 result 欄位留空，不要編造內容、單元名稱或使用成效。" },
  { id: "sky-games", field: "result", remove: "母站計 1 件，17 子頁只在卡片內以五小區列出，不逐頁計件。" },
  { id: "sky-games", field: "subzoneNote", remove: "展示必須註明，" },
  { id: "sky-games", field: "subzoneNote", remove: "，不得寫成站主的遊戲作品" },
  { id: "sky-games", field: "subzoneNote", remove: "子頁一律連回母站首頁，不要猜子頁網址。" },
  { id: "angry-cat", field: "result", remove: "，卡片照實標註這個分發狀態" },
  { id: "ai-workbench", field: "approach", remove: "，照實呈現" },
  { id: "ai-workbench", field: "result", remove: "，展示時不要寫成已完成" },
  { id: "penglai-online", field: "status", remove: "，不要給任何遊玩連結" },
  { id: "zone:frozen", field: "note", remove: "，呈現語氣保持中性" }
];
