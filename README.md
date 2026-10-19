# 櫻花泡沫實驗室

教育用 Three.js / Vite 大象牙膏模擬：透明 100 mL 量筒、RGB 混色、10 種催化系統、w/w% 控制、暫停／繼續與比較表格。

## 執行與驗證

需要 Node.js 22.12 以上。`npm ci` 安裝依賴，`npm run dev` 啟動開發；`npm run build` 產生 dist；`npm run preview` 驗證正式版本。`npm test` 執行模型與狀態驗收測試。

## 統一示意模型

**示意模型，未經實驗校正；非實驗測量結果，不代表真實催化能力排名。**

- `src/chemistry.js` 定義 10 種系統的 id、名稱、化學式、類型、濃度基準、示意係數、證據等級與限制，並提供 `calculateCatalystEffect()` 與 `calculateSimulation()`。
- 選項為 KI、MnO₂、酵母菌（含 catalase）、FeCl₂、FeCl₃、FeSO₄、Fe₂(SO₄)₃、CuSO₄、MgSO₄、NaCl。**沒有 KMnO₄**。
- w/w%＝溶質質量／溶液總質量 × 100%。0–100% 只是介面範圍，不表示各物質都能形成該濃度的均勻溶液。MnO₂ 採固體分散系統的名義質量百分比；酵母採懸浮液菌體質量百分比，不等於 catalase 酵素含量。
- 同 w/w% 不代表相同莫耳濃度、活性位點數或催化能力。模型不由分子量推導活性；金屬鹽共用未校正情境參數，不為不同氧化態設定普遍排名。實際溶解度、pH、溫度、粒徑與活性酵素含量未經校正。
- 濃度使用非線性示意響應；高酵母濃度可降低模型活性，不宣稱真實速率固定比例增加。函式可接受固體表面因素、酵素活性、金屬鹽條件因素，供未來實測資料更新，目前 UI 使用預設情境值。
- 0% 催化劑保留慢速背景分解情境；MgSO₄ / NaCl 是低影響比較組，不宣稱所有情況皆無影響。0% H₂O₂ 的生成速率、高度、體積指標與虛擬質量均為零。
- 統一模型輸出生成速率、初速、重力、口部以上最高高度（場景單位）、持續時間、擴散程度、反應進度曲線、情境轉化份額及液面下降份額。動畫使用開始時的模型快照；過程中編輯控制項只影響下一次實驗。暫停會凍結所有泡沫與液面進度。
- 體積是相對指標；質量採假設 100 g 基準、H₂O₂ 比例與情境轉化份額的**虛擬 g**，不是實際泡沫重量、產氧量或實驗預測。兩者由模型計算，不由粒子數換算；粒子只作視覺呈現。最高高度是模型初速／重力計算的中心軌跡上限，不是實測長度。
- RGB 為光色混合，不是真實染料混合；泡沫是實例粒子與高度格碰撞近似，不是 CFD。
- 不提供真實化學品配製或操作建議。先前用量紀錄保留為比較備註，不參與計算。

## KI 與比較清單

`src/settings.js` 管理濃度與比較狀態。原有 KI 控制保留在可展開面板；選擇 KI 時與新控制共享同一值，其他系統各自保留自己的濃度。

加入比較會保存模型快照，最多 20 筆，依加入順序顯示，不按效果排名。H₂O₂ 濃度須相同；改變時會拒絕加入並提示先清空，可移除個別紀錄。清單僅保存於當前頁面工作階段，重新整理不保留。每列包含濃度、模擬相對速率、高度、體積指標、虛擬質量及模型限制。

## GitHub Pages

`.github/workflows/pages.yml` 在 main 推送後建置部署。到儲存庫 Settings → Pages，Source 選 GitHub Actions；首次啟用後可於 Actions 重新執行 workflow。部署成功後預期網址為 https://abwinnie.github.io/steam/ ，未驗證部署時不代表網址已上線。

## 瀏覽器驗收

先建置並啟動 `npm run preview -- --port 5174`，另開 Chromium 測試程序（需已安裝 Chromium）：

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage --enable-unsafe-swiftshader --remote-debugging-port=9222 --user-data-dir=/tmp/sakura-lab-browser about:blank
```

再於另一個終端執行 `node scripts/browser-check.mjs http://127.0.0.1:5174/`。這會實際操作 10 種選項、同步輸入、KI 狀態、比較清單、RGB、暫停／繼續、重置、零濃度及手機版面。截圖預設放在 `/tmp/sakura-lab-check`，可用 `BROWSER_ARTIFACT_DIR` 指定目錄。只停止自己為測試啟動的瀏覽器／伺服器。
