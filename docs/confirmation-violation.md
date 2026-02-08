好，呢一段我會**幫你將「confirmation（蠟燭＋volume）」正式工程化**，
而且會**嚴格跟你嘅原則**：

> ❗**冇 volume = 冇意義**
> ❗**唔喺 key level 發生 = 唔重要**
> ❗**呢啲係 confirmation / violation evidence，唔係 entry signal**

我會分 5 部分講，全部都可以直接寫入 spec / code。

---

# 🧠 一、Confirmation 嘅定位（先定清楚）

### Confirmation 係咩？

* ❌ 唔係買賣訊號
* ❌ 唔係一定要 trade
* ✅ 係：

  > **提醒 user：「呢個位，市場有反應」**

佢嘅作用係：

* 幫 user **睇得快**
* 幫 user **唔忽略重要細節**
* 幫 user **增加 / 減少信心**

---

# 二、Key Rule（一定要寫死喺 spec）

## Rule 0（最重要）

> **所有 candlestick / volume confirmation，
> 一定要發生喺「Key Level」先至有意義**

### Key Level 包括：

* Swing High / Swing Low
* Daily Base Low / High
* VCP Pivot
* Intraday Base High / Low
* Moving Average（20 / 50 / 200）
* VWAP（intraday）

❌ 唔喺以上位置發生 → **ignore**

---

# 三、Volume 定義（你講得好清楚）

Volume 唔可以模糊，一定要「異常」。

## Volume 狀態分 3 種：

### 1️⃣ Volume Expansion（有力量）

```text
Volume > k × AvgVolume
```

* 建議：k = 1.5 ～ 2.0
* 用於：

  * Reversal
  * Engulfing
  * Breakdown / Reclaim

---

### 2️⃣ Volume Contraction（冇人想賣 / 買）

```text
Volume < m × AvgVolume
```

* 建議：m = 0.5 ～ 0.7
* 用於：

  * Tight bar
  * Dry-up
  * Base building

---

### 3️⃣ Normal Volume（唔計）

* 唔符合以上兩個
* 唔產生 confirmation

---

# 四、你要 detect 嘅 Confirmation Stick Patterns（正式 spec）

我會分 **Bullish Confirmation** 同 **Bearish Confirmation**。

---

## 🟢 A. Bullish Confirmation（Support 有人撐）

### A1️⃣ Small Range + Small Volume（Dry-up Bar）

### 意義（交易員語言）

> 「跌到呢個位，冇人想再賣」

### 條件：

```text
Range < p × AvgRange
AND
Volume < m × AvgVolume
AND
Bar 發生喺 Support / MA / Base Low
```

建議：

* p = 0.6
* m = 0.6

### 輸出：

```json
{
  "type": "dry_up",
  "bias": "bullish",
  "level": "support"
}
```

---

## 🟢 A2️⃣ Long Lower Wick + Volume Expansion（買盤出現）

### 意義

> 「有大量賣壓，但被即刻吸收」

### 條件：

```text
LowerWick > 2 × Body
UpperWick < Body
Volume > k × AvgVolume
AND
發生喺 Support / MA
```

### 輸出：

```json
{
  "type": "lower_wick_absorption",
  "bias": "bullish",
  "volume": "expansion"
}
```

---

## 🟢 A3️⃣ Bullish Engulfing（一定要有 volume）

你講「bear engulf → 上返嚟」，
我會用正式名：**Bullish Engulfing with Volume**

### 條件：

```text
CurrentBody 完全包住 PreviousBody
Close > PreviousOpen
Volume > k × AvgVolume
AND
發生喺 Support / Base Low
```

### 輸出：

```json
{
  "type": "bullish_engulfing",
  "bias": "bullish"
}
```

---

## 🔴 B. Bearish Confirmation（Resistance 有人沽）

### B1️⃣ Small Range + Small Volume（Up-move Dry-up）

### 意義

> 「升到呢個位，冇人再追」

### 條件：

```text
Range < p × AvgRange
AND
Volume < m × AvgVolume
AND
發生喺 Resistance / Pivot High
```

---

## 🔴 B2️⃣ Long Upper Wick + Volume Expansion（派貨）

### 條件：

```text
UpperWick > 2 × Body
LowerWick < Body
Volume > k × AvgVolume
AND
發生喺 Resistance / MA
```

---

## 🔴 B3️⃣ Bearish Engulfing（一定要有 volume）

### 條件：

```text
CurrentBody 包住 PreviousBody
Close < PreviousOpen
Volume > k × AvgVolume
AND
發生喺 Resistance / Pivot High
```

---

# 五、Violation Signals（重要，唔好同 confirmation 混）

Violation = **否定之前假設**，優先級高過 confirmation。

## 例子：

* Support 下：

  * 出現 Volume Expansion + 大陰燭 → 🔴 violation
* Pivot 上：

  * Close below pivot + volume → 🔴 fail breakout

Violation 一出：

> **所有 bullish confirmation 全部失效**

---

# 六、Evidence / Hint 系統（UI 用）

Confirmation 唔係 signal，
所以 UI 唔應該寫「Buy / Sell」。

### 正確顯示方式：

* 🟢 Dry-up at support
* 🟢 Buyers absorbed selling
* 🔴 Rejection with volume
* 🔴 Violation: support broken

每個 hint 都要附：

* Pattern 名
* Volume 狀態
* Key level 名

---

# 七、簡化 Pseudo-code（工程對齊）

```ts
if (isAtKeyLevel(bar)) {
  if (isSmallRange(bar) && isLowVolume(bar)) {
    addEvidence("dry_up", bias);
  }

  if (hasLongLowerWick(bar) && isHighVolume(bar)) {
    addEvidence("bullish_absorption");
  }

  if (isEngulfing(bar) && isHighVolume(bar)) {
    addEvidence("engulfing", bias);
  }
}
```

---

# 八、最後幫你定錨一句（好重要）

> **蠟燭形態本身冇意義，
> 有意義嘅係：
> 「喺邊度發生」＋「有冇 volume」。**

你而家做緊嘅，唔係教用戶睇圖，
而係幫佢 **自動標記「市場正在講嘢」嘅地方**。

---

## 下一步我可以即刻幫你做：

1️⃣ 把以上寫成 **Confirmation Detector Spec（Daily + Intraday）**
2️⃣ 幫你寫 **TypeScript detection utils**
3️⃣ 幫你設計 **Frontend Evidence Badge & Tooltip 文案**

你而家個系統，已經係「職業交易員級嘅 confirmation engine」。
