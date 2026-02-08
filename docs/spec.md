好，以下係一份**「可以直接當成 Project Base Spec（Master Spec）」**嘅完整版本。
呢份嘢嘅定位係：

> **所有之後嘅 DB spec / Frontend spec / Backend spec / UIUX / Brand design
> 都要由呢一份「母本」再拆出嚟。**

我會用 **清楚分章 + 穩定術語 + 廣東話（偏書面）**，
內容只整理你我已經講過嘅**重要核心**，唔加新方向，唔走偏。

---

# 📘 PROJECT MASTER SPEC

## Leader-based Trading Decision Platform

---

## 1. Project Purpose（項目目的）

本平台並非提供「買賣建議」或「自動交易」，
而係一個：

> **以歷史、市場結構、leader 行為、intraday setup 為核心，
> 協助用戶學習並作出交易決策嘅 Trading Decision Platform。**

### 核心理念

* 系統負責 **分析、過濾、提醒**
* 用戶負責 **理解、判斷、承擔 decision**
* 平台設計目標係：

  > **將專業交易員嘅複雜判斷，
  > 壓縮成用戶可以承擔嘅 decision 數量**

---

## 2. Core Philosophy（核心交易哲學）

### 2.1 Follow Leaders

* 平台只關注 **Market Leaders**
* 原因：

  * Leader 升得最多
  * Leader 跌得最快
  * Leader 對市場情緒最敏感

### 2.2 Hot ≠ Famous

* Hot stock 定義為：

  * **符合 Mark Minervini Stage 2 template**
  * 升幅大
  * Moving Average 排列正確
* 不以新聞、人氣、討論度作判斷

### 2.3 Trading is Contextual

* 所有 trade 必須放喺：

  * Market condition
  * Theme / Supply chain
  * Group 行為
  * Intraday 結構
    之下理解

---

## 3. Asset Universe（交易範圍）

平台只處理以下資產類別：

1. **Index**

   * 三大指數（用作對比與背景）
2. **Hot Stocks**

   * Stage 2 leaders
3. **Former Hot Stocks**

   * 曾經係 leader，但已跌出 template
4. **Commodity-related Stocks / Commodities**

❌ 不處理全市場
❌ 不處理非 leader、低波動資產

---

## 4. Market Structure & Breadth Framework

### 4.1 Market Breadth Indicators

用作判斷 leader 行為是否得到市場支持：

* NAAD（Net Advances – Declines）
* NAA50R（% stocks above 50MA）
* NAA200R（% stocks above 200MA）
* NAHL（New Highs – New Lows）
* Average-weight Index

### 4.2 Breadth 使用原則

* Breadth 永遠 **對比 Index**
* 重點唔係「breadth 好唔好」
* 而係：

  > **Breadth 同 Index 有冇 divergence / confirmation**

---

## 5. Theme × Supply Chain Model

### 5.1 Industry vs Theme

* **Industry**：靜態分類（資料用途）
* **Theme**：資金敘事（交易用途）

例：

* AI 不是一個 industry，而是一個 theme

### 5.2 Supply Chain Grouping

每個 theme 必須拆成 supply chain group，例如 AI：

1. Compute / Chips
2. Infrastructure / Hardware
3. Platform / Software
4. Downstream Applications

### 5.3 Trading 用法

* 資金通常由上游 → 下游
* 上游 leader 通常：

  * 最早轉弱
  * 最適合 gap / short

---

## 6. Stock State & Stage System

### 6.1 Hot Stock（Stage 2）

必要條件：

* Price > 20MA > 50MA > 200MA
* MA 向上
* 有顯著升幅
* Relative Strength 強

### 6.2 Former Hot Stock

* 曾經符合 Stage 2
* 現在跌出 template
* 常用於：

  * Gap trade
  * Short
  * Mean reversion

---

## 7. Trade Setups（系統支持）

### 7.1 Breakout Trade

* Pivot breakout（VCB / base / wedge）
* Stop：

  * Intraday pivot → Daily pivot → Day low/high
* Position sizing：

  * Risk-based（0.25% / 0.5% / 1%）

---

### 7.2 620 Cross Trade（Gil Morales）

* 必須先有 intraday setup
* 620 EMA cross 只係 execution trigger
* Setup 類型：

  * U&R
  * Wedge
  * Double top/bottom
  * VCB micro-base

---

### 7.3 Gap Up / Gap Down Trade

* 只 trade hot / former hot stocks
* Gap 只係位置，唔係 signal
* 必須有 intraday / premarket setup

---

### 7.4 Momentum Continuation Trade

* 2 個月內升 ≥ 100%
* 回調 ≤ 20%
* Tight / orderly base
* Long trigger：

  * Volume contraction → expansion
  * Pivot reclaim
  * 20MA support

---

## 8. Risk Engine（全平台共用）

### 8.1 Stop Loss

* Pivot-based / intraday-based
* 小 buffer（% 或 ATR）

### 8.2 Position Sizing

* Risk per trade：

  * Conservative：0.25%
  * Normal：0.5%
  * Aggressive：1%
* 倉位 = risk % ÷ stop 距離 %

---

## 9. User Journey（決策流程）

### STEP 0：Market Context

* Index + Breadth
* 用戶判斷 market condition

### STEP 1：Theme Overview

* 每個 theme 顯示：

  * Hot / Former hot 數量
  * Setup 數量
  * Bullish / Bearish %
  * Stage 分佈 %
* Sorting 將單邊比例高者排前

### STEP 2：Theme Detail

* 歷史類似 period 對比
* 上一次 in-play：

  * Technical
  * Market environment
  * Catalyst

### STEP 3：User Decision #1

* 選擇 bias：

  * Bullish / Bearish / Both

### STEP 4：Stock Selection

* 只顯示：

  * In-play
  * 有 setup
  * Hot / Former hot

### STEP 5：User Decision #2

* 揀 trade 或 skip

### STEP 6：Alert Setup

* Entry key level
* Profit-taking levels
* Stop 由 intraday 決定

### STEP 7：Intraday Monitoring

* 系統偵測 setup / cross
* 通知 user
* User 決定：

  * 等 group 一齊 cross？
  * EMA cross / bar cross？

---

## 10. UI / UX Principles

* Never show raw data without context
* Highlight confirmation & violation evidence
* Chart = evidence board, not analysis playground
* Historical：

  * Daily：3–6 個月
  * Intraday：只顯示當日

---

## 11. Data Strategy

### 儲存範圍

* Index daily
* Hot / Former hot daily
* Commodity daily
* Intraday（只限當日）

❌ 不儲存歷史 intraday replay

---

## 12. Architecture & Tech Stack

### Frontend

* React
* Tailwind
* Zustand
* Lightweight Charts

### Backend

* NestJS (Node)
* Go（未來高頻 scan）

### DB

* PostgreSQL
* Prisma ORM

---

## 13. Trading Integration（Future-proof）

### Trade Lifecycle

1. TradeIdea
2. TradeIntent
3. Order
4. Execution
5. Position

### Broker Strategy

* Broker-agnostic
* Adapter pattern
* Phase 1：Paper trade
* Phase 2：Futu
* Phase 3：IBKR

---

## 14. Learning Objective（最重要）

平台最終要教用戶兩樣嘢：

1. **點樣用歷史，判斷而家有冇嘢值得 trade**
2. **點樣做 intraday decision**

---

## 15. Final Anchor（整個 Project 核心句）

> **系統幫你搵機會、準備機會、提醒機會
> 用戶負責理解市場、選擇偏向、作出 decision**

---

如果你下一步要做，我會建議依順序拆 spec：

1️⃣ DB Schema Spec
2️⃣ Frontend Screen-by-Screen Spec
3️⃣ Backend API Spec
4️⃣ UIUX / Brand Tone Spec

你隨時可以同我講：
👉「由邊一份開始幫我拆。」
