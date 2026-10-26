# 作品島 v4（連線規格化＋驗證狀態）施工計畫

> 依據：Sky 2026-10-26 上傳的《作品島升級任務書（增補版 v2）》。
> 狀態：Sky 已於 2026-10-26 回覆「yes」核准；等 Sky 補上 `works-data-v2.json` 後施工。本檔取代 v3 的 `PLAN.md`（v3 計畫可在 git 歷史中查到）。

## 0. 卡住的地方（先處理）

**`works-data-v2.json` 不在任何地方。** 這次只上傳了任務書本身；repo（`main` 與所有分支）、專案檔案夾都沒有這個檔。

任務書要的新欄位全部只能來自這個檔，我不會自己寫：`connections[].id / type / typeLabel / status / statusLabel`、`connectionTypes`（5 種）、`statusLegend`（3 種符號、名稱、meaning）、每件作品的 `statusKey`、`verification`（level、levelLabel、date、note）。

還有一個具體證據說明不能用推的：用網站現在的判斷規則（`statusRules` 關鍵字）算，15 件的分布是 **✓ 9／◐ 4／❄ 2**；任務書驗收要的是 **✓ 8／◐ 5／❄ 2**。也就是說 v2 會把現在某一件「已上線」改判成 ◐，是哪一件只有 v2 檔案知道。

## 1. 現況掃描結果

| 項目 | 現況 |
|---|---|
| 基底分支 | PR #4（拿掉分區名稱前的數字）**已合併**，`main` 最新是 `a335194`。新分支直接從這裡開，不會疊到未合併的東西上 |
| 網站實際讀的資料檔 | `site/data/works.json`。它除了作品資料，還有 `ui`（全部畫面文字）、`statusRules`、`displayRules`（18 條顯示時刪字的規則） |
| 根目錄 `works-data.json` | v1 原始資料存檔，網站**沒有讀它**。任務書說「v2 取代 works-data.json」，但實際要接上網站，要改的是 `site/data/works.json` |
| 連結數 | 23 個，和任務書一致 |
| 連線 | 7 條，現有欄位只有 from／to／label／style（solid／dashed）。地圖、右側面板「連線」分頁、詳情卡「關聯」三處都在用 |
| 狀態符號 | 目前由程式從 status 文字比對關鍵字判斷（`util.js` 的 `statusKind`），符號是 SVG 畫的 ✓／半滿圓／雪花 |
| 圖例 | 島嶼模式左下 `#legend`，由 `main.js` 的 `renderLegend` 畫：總件數、分區、實線／虛線／步道 |
| 清單模式 | `panel.js` 的 `renderListView`；每列有「在島上定位」按鈕，會切回島嶼模式並開該作品詳情 |
| 部署檢查 | `tools/validate-data.py` 在部署前檢查資料檔（必要欄位、件數對帳、excluded 不得出現、程式用到的 ui 文字都要存在）；沒過就不部署 |

## 2. 會改哪些檔（拿到 v2、Sky 回 yes 之後）

```
works-data.json            以 v2 原檔整份取代（存檔用，內容不動一字）
site/data/works.json       把 v2 的資料段（meta／intro／zones／works／connections／excluded
                           ＋新增的 connectionTypes、statusLegend）換進來；
                           保留原有 ui／displayRules；ui 只「新增」第 3 節列的幾個介面字，舊字不改
site/js/data-loader.js     讀入 connectionTypes、statusLegend，交給畫面使用
site/js/util.js            符號改由作品的 statusKey 對照 statusLegend 產生，不再靠關鍵字猜
site/js/main.js            renderLegend：在實線／虛線／步道下方加狀態圖例（符號＋名稱＋meaning）
site/js/panel.js           清單模式：頂部加同一份狀態圖例；作品清單之後加「作品關係」專區（7 條）
site/js/detail.js          狀態標籤下方加「驗證：{levelLabel}（{date}）— {note}」；
                           關聯列的類型文字改讀 typeLabel
site/js/connections.js     線條實線／虛線與提示文字改由連線資料欄位決定（不在程式另寫對照表）
site/css/panel.css         作品關係專區、狀態圖例、驗證列的樣式；not-linked 用灰字＋虛線邊框；390px 不溢出
site/css/island.css        島嶼圖例多一區的排版
tools/validate-data.py     新增檢查：statusKey 必須在 statusLegend 裡、connection 的 type 必須在
                           connectionTypes 裡、status 只能是 linked／not-linked、每件都要有 verification
README.md                  補一段「新欄位在哪裡改」
PLAN.md                    換成本計畫（v3 計畫留在 git 歷史）
```

**作品關係專區的位置**：放在作品清單**之後**，只放這一處。狀態圖例放在清單**頂部**，兩模式共用同一個渲染函式。

## 3. 需要新增的介面文字（放進 `ui`，請 Sky 一起看過）

這些是畫面上的標題與標籤，不是作品內容；內容（類型名、狀態名、meaning、驗證說明）一律照 v2 原文。

| key | 文字 |
|---|---|
| `list.relationsTitle` | 作品關係 |
| `list.legendTitle` | 狀態圖例 |
| `legend.statusTitle` | 狀態圖例 |
| `detail.verification` | 驗證： |

「尚未串接入口」這幾個字用 v2 的 `statusLabel`，不另寫。如果 v2 裡已有這些標題文字，就用 v2 的，上表作廢。

## 4. 不會動的東西

- 15 件作品的所有既有文字、23 個網址、excluded 四項、intro 全文（v2 若與 v1 有差，我會先逐欄比對回報，**不會默默套用**）。
- 地圖、地形、步道、鏡頭、視差、帶我逛逛、印章、錨點、縮放、連線開關等功能程式不改邏輯。
- 視覺風格、版面結構、既有 18 條 displayRules。
- 不新增作品、連線、類型或狀態種類。

## 5. 風險與我會怎麼處理

1. **v2 與 v1 不一致**：換檔前先跑逐欄比對（15 件、23 網址逐字、註記文字、excluded），有任何差異先列給 Sky，不自己決定。
2. **status 文字被顯示規則刪字**：現有 displayRules 會把蓬萊的 status 尾巴「，不要給任何遊玩連結」在畫面上刪掉。任務書說 status「照舊顯示」，我理解為維持 v1 的畫面樣子，這條規則保留。
3. **狀態篩選結果會變**：右側面板的狀態篩選會改用 statusKey，所以會有一件從「上線中」移到「有註記」。這是 v2 資料造成的預期結果，驗收時會指出是哪一件。
4. **驗證說明裡的字被 excluded 檢查擋下**：例如說明若提到 englishspeak，部署檢查會失敗。真的發生就回報 Sky，不改寫原文。
5. **v2 若沒有 `style` 欄位**：實線／虛線要改從 status（linked→實線、not-linked→虛線）決定，這個對應會寫在資料檔裡而不是程式裡；等看到 v2 再定。
6. **符號**：島上節點目前用 SVG 畫符號（跨裝置不依賴字型）。我會讓 statusLegend 決定「哪件用哪個符號、叫什麼名字」，畫法沿用現有 SVG；若 v2 的 key 對不上現有三種，就改成直接顯示 v2 的符號字元。

## 6. 回退

- 全部在新分支、一個 PR；不直接改 `main`。
- 合併後有問題：在 GitHub 上對該 PR 按 Revert，或把 `site/data/works.json` 與 `site/js/` 回到 `a335194`。
- 部署前有資料檢查，資料檔壞掉不會上線，線上維持上一版。

## 7. 驗收（完成時照任務書 7 項逐項回報）

本地用 Playwright 開站跑：15 件／各區件數、23 連結逐字對照 v1、作品關係 7 條與類型分布（3／1／1／1／1）、符號分布（8／5／2）、15 張詳情卡驗證列逐字比對（卡丁車、史地讚抽查句）、excluded 全頁搜尋、凍結原因全文、舊功能點按、390px 截圖、console 錯誤。合併上線後再對 GitHub Pages 驗一次。
