# 家庭記帳本

全家一起記帳的免費網頁 App：

- 用 Google 帳號登入。
- 傳一個連結邀請家人。
- 每個人有自己的帳，自己決定給家人看多少。
- 家裡一起花的錢記在「全家的帳」。

👉 **https://tim062480-create.github.io/family-ledger/**

## 功能

- **記帳**
  - 說一句話就記帳：「午餐 120、捷運 30」一次記好幾筆，認得日期、備註和中文數字。
  - 每人一本帳：分享程度可選不公開、只看總額、看類別合計，或完整明細。
  - 全家共同帳：成員都能記，看得到是誰記的。
- **預算與錢包**
  - 預算與提醒：各類別預算，用到 25%、50%、100% 或花太快時提醒。
  - 優惠券另外算：禮券、商品券有自己的餘額，不混進每月收支。
  - 家庭存錢目標：大家一起存，看得到每個人的進度。
- **紀錄與提醒**
  - 照片與地點：附照片會自動帶入拍照地點，點照片可開 Google 地圖。
  - 國曆農曆日曆：節氣、節日、生日（可用農曆）提醒。
  - 每日記帳提醒：下載行事曆檔，手機每天提醒。
- **記事本**：分頁放課表、考試等行程，加筆記和圖片；標 ★ 的行程顯示在總日曆，可設定提前幾天通知。
- **資料**：匯出 CSV、備份與匯入。

## 技術

- 純靜態網頁：`index.html`、`style.css`、`app.js`，放在 GitHub Pages。
- 登入和資料：Firebase Authentication（Google）＋ Cloud Firestore。
- 權限都寫在 [`firestore.rules`](firestore.rules)：
  - 個人資料只有本人能讀寫。
  - 家庭資料只有成員能讀寫。
  - 要加入家庭必須持有有效的邀請碼。

## 自己架一份

1. **建立 Firebase 專案**
   - 到 [Firebase 主控台](https://console.firebase.google.com) 建立專案。
   - 啟用 **Authentication → Google** 登入。
   - 建立 **Firestore Database**，選正式版模式。
2. **設定資料庫**
   - 把 `firestore.rules` 的內容貼到 Firestore 的「規則」頁並發布。
   - 在「專案設定 → 你的應用程式」新增網頁應用程式，把設定值填進 `config.js`。
3. **上線**
   - 在 Authentication → 設定 → 授權網域，加上你的網址（例如 `你的帳號.github.io`）。
   - 推到 GitHub，在 Settings → Pages 選 `main` 分支、根目錄。

## 測試

`tests/` 裡有用假的 Firebase 跑的瀏覽器測試（需要 Node 和 Playwright）：

```bash
node tests/run.js
```

## 授權

MIT License
