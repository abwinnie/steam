# 櫻花泡沫實驗室 Sakura Lab

繁體中文大象牙膏 3D 教學模擬遊戲。使用 Three.js 與 Vite，可調整 H₂O₂ / KI 濃度及 RGB 色彩，旋轉觀察附底座與刻度的透明 100 mL 量筒、噴發、液面下降與持續堆積的泡沫。

## 開發

需要 Node.js 22.12 以上。

```sh
npm ci
npm run dev
```

`npm run build` 產生 `dist/`；`npm run preview` 在本機驗證正式版本。依賴由 npm 安裝，不依賴執行階段 Three.js CDN。

## GitHub Pages

將檔案提交並推送至 `abwinnie/steam` 的 `main` 分支。在 GitHub 儲存庫 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。內附 `.github/workflows/pages.yml` 會建置與部署，之後每次推送 main 自動更新。若第一次推送前尚未啟用 Pages，啟用後到 Actions 重新執行 workflow。

只有部署成功後，預期網址 `https://abwinnie.github.io/steam/` 才可使用；網址本身不代表已上線。需確認儲存庫與 Pages 的存取設定允許公開讀取。

## 模型與限制

- 固定假設 100 mL 過氧化氫溶液，密度 1.11 g/mL，另加 10 g 催化劑／皂液。H₂O₂ 百分比視為質量分率。
- 化學計量：`2 H₂O₂ → 2 H₂O + O₂`；以 24 L/mol、55% 氧氣捕捉率估算泡沫體積。重量以反應前溶液總質量減去釋放氧氣估算，不表示全部重量都會離開燒瓶。
- KI 濃度只改變示意反應速率／噴發形態，不增加氧氣的理論產量；任一反應物濃度為 0 時不噴發。
- RGB 為光色混合，並非真實染料混色。泡沫使用具孔隙貼圖的重疊實例粒子、重力、徑向擾動、碰撞與高度格堆積，是即時視覺近似，不是數值流體力學。
- 體積與重量是教學估算；不是實驗預測。尤其高濃度數值僅供虛擬遊玩，請勿依此進行實際操作。
