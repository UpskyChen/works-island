# 阿喵老師的作品島

阿喵老師（Upsky）的個人作品展示站。純靜態網站，沒有後端、表單、追蹤或登入，也不載入任何外部 CDN 或字體（使用系統字體）。

- **島嶼探索模式**：分區島嶼地圖，點節點看詳情卡（問題 → 做法 → 成果）。
- **清單模式**：同一份資料依分區列成清單，可展開詳情，每列都能「在島上定位」。

兩種模式共用同一份資料檔。

## 檔案結構

```
site/                      ← 發佈到 GitHub Pages 的整個資料夾
  index.html
  css/style.css            ← 樣式（深淺色模式）
  js/app.js                ← 由資料產生地圖、清單、詳情卡
  js/display-rules.js      ← 顯示規則（見下方說明）
  data/works.json          ← ★ 唯一資料來源，站上所有作品內容都來自這裡
works-data.json            ← 站主提供的原始資料檔（原樣保留作為紀錄，網站不讀它）
.github/workflows/pages.yml
```

`site/data/works.json` 與原始 `works-data.json` 內容完全相同，只是換行縮排、把 meta／intro 等區塊排到前面方便閱讀。之後**只要改 `site/data/works.json`**；若想讓根目錄的原始檔保持同步，可一併更新或直接刪除它。

## 本機預覽

需要用靜態伺服器開啟（直接雙擊 `index.html` 以 file:// 開啟會讀不到資料檔）：

```bash
cd site
python3 -m http.server 8000
```

然後用瀏覽器開 <http://localhost:8000/>。手機或 iPad 在同一個網路下可開 `http://<電腦 IP>:8000/` 實機測試。

## 如何新增一件作品

在 `site/data/works.json` 的 `works` 陣列加一筆，存檔後重新整理即可，不用改程式。欄位：

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | ✓ | 英文小寫與連字號，不可重複，例如 `"new-tool"` |
| `name` | ✓ | 作品名稱 |
| `zone` | ✓ | 分區：`campus`、`subjects`、`games`、`tools`、`frozen` |
| `subzone` | 教材區必填 | 學科子區，例如 `"國語"`；放進原本的空子區後，該子區會自動不再顯示為空 |
| `status` | ✓ | 狀態標籤文字。含「待／尚未／升級中／需登入」會顯示為黃色，凍結區為灰色，其餘綠色 |
| `problem`、`approach`、`result` | | 問題／做法／成果；留空字串就不顯示該列 |
| `audience` | | 對象 |
| `links` | | `[{ "label": "按鈕文字", "url": "網址" }]`，照順序顯示為按鈕 |
| `tags` | | 標籤陣列 |
| `displayNote` | | 卡片上的「說明」框 |
| `freezeReason` | | 卡片上的「凍結原因」框 |
| `relationLabel` | | 節點下方與卡片上的關係標籤 |
| `subzoneItems`、`subzoneNote` | | 站內小區清單（目前只有阿喵的遊戲世界使用） |

其他需要一起更新的地方：

1. `meta.totalWorks` 與 `zones` 裡該區的 `count`：網站顯示的數字一律由實際筆數計算，這兩個欄位只用來對帳。若對不上，瀏覽器 console 會出現 `[對帳]` 提示。
2. 若新作品與其他作品有關聯，在 `connections` 加一筆 `{ "from": "...", "to": "...", "label": "...", "style": "solid" }`（虛線用 `"dashed"`）。地圖只會畫這裡列出的線。
3. 若把某學科從空子區變成有作品，可順手刪掉 `emptySubzones` 裡那一筆（不刪也不會出錯）。

作品編號（地圖上的數字）依 `works` 陣列順序自動產生。地圖版面依分區自動排列；如果新增作品讓某個島的名稱標籤互相擠到，程式會自動改用只顯示編號的版面。

## 顯示規則（display-rules.js）

原始資料檔裡有幾句話是給製作者的施工指示（例如「不要猜子頁網址」「展示時不要寫成已完成」）或計件說明（例如「計 1 件」），以及「（站主本人 README 原意）」這類出處括號。依站主決定，資料檔一字不改，改由 `site/js/display-rules.js` 在**顯示時**刪掉這些片段：

- 規則只做逐字刪除，不改寫、不新增任何字；每條規則都列在該檔，可逐條覆核。
- 其中一條是刪掉口說練習 result 裡提到 `englishspeak` 舊站的那句，避免排除項目出現在站上。
- 若之後修改資料檔，讓某條規則的原文對不上，該規則會自動失效，並在 console 顯示 `[display-rules]` 提示。
- 新增作品時，直接寫成要給訪客看的文字即可，不需要新增規則。

## 部署（GitHub Pages）

做法比照 `xikou-kart`：GitHub Actions 把 `site/` 資料夾發佈到 GitHub Pages。

1. 到 repo 的 **Settings → Pages**，Source 選 **GitHub Actions**（只需設定一次）。
2. 把變更合併或推送到 `main` 分支，`.github/workflows/pages.yml` 會自動部署（只有 `site/` 或 workflow 有變動時才會觸發）。也可以在 **Actions** 頁手動執行 “Deploy site to GitHub Pages”。
3. 網址為 `https://<帳號>.github.io/works-island/`。

## 注意

- `site/data/works.json` 會隨網站公開（任何人都能直接打開這個檔案），裡面包含 `excluded` 清單與註記原文；頁面上不會顯示這些內容。如果不希望它們能被直接讀到，請從 `site/data/works.json` 刪掉 `excluded` 區塊（網站不使用它）。
- 本站不放任何聯絡方式；`intro.contact` 目前為 `null`。
