好，呢一段我會**幫你正式「工程化」你講嘅 detection 邏輯**，
唔係淨係概念，而係**可以直接攞去寫 code / 做 spec**。

我會分 3 部分：

1. **Swing High / Swing Low（Support & Resistance）Detection spec**
2. **Daily Base Detector（Stage 2 base）**
3. **Intraday Base / Setup Detector（未 cross、building structure）**

全部用你嘅語言邏輯，只係幫你寫成「機器聽得明」嘅版本。

---

# 1️⃣ Swing High / Swing Low Detection（核心 S/R 定義）

## 🎯 你嘅原意（我先幫你準確定義）

### Swing High 係咩？

* Price 曾經到過一個 **明確高位**
* 之後一段時間（≥ 10 個 trading days）
* **冇任何一支 bar** 再進入：

  > 「高位 − Average Bar Size」呢個區域
* 呢個高位就定義為 **Swing High（Resistance）**

當 price **之後再返到接近呢個價位**：

* ≈ 呢個 swing high
* 或者 slightly above
  👉 呢個行為就係：
* Double Top
* 或 Failed Breakout（視乎 context）

---

## 📐 重要數值定義（工程用）

### Average Bar Size（ABS）

你講嘅「average bar 係 5」可以定義為：

```ts
ABS = SMA(High - Low, N)
```

建議：

* Daily：N = 20
* Intraday：N = 20 bars

---

## ✅ Swing High Detection Algorithm（Daily）

### 條件定義

假設：

* `H0` = candidate high（某一日 high）
* `ABS` = average bar size
* `lookahead = 10 days`

### 條件：

```text
For day t with high = H0:

For all days i in (t+1 → t+10):
    High[i] < H0 - ABS
```

如果成立：
👉 `H0` = Swing High

---

### 📌 Pseudo-code（Daily Swing High）

```ts
for (let t = 0; t < data.length - lookahead; t++) {
  const H0 = data[t].high;
  const ABS = avgBarSize(t);

  let isSwingHigh = true;

  for (let i = t + 1; i <= t + lookahead; i++) {
    if (data[i].high >= H0 - ABS) {
      isSwingHigh = false;
      break;
    }
  }

  if (isSwingHigh) {
    markSwingHigh(t, H0);
  }
}
```

---

## 🔁 Swing Low / Undercut & Rally（完全對稱）

### Swing Low 定義

* `L0` = 某一日 low
* 之後 ≥ 10 日：

```text
Low[i] > L0 + ABS
```

👉 `L0` = Swing Low（Support）

### Undercut & Rally

* Price 之後：

  * 跌穿 `L0`
  * 再 reclaim `L0`
    👉 觸發 U&R setup

---

# 2️⃣ Daily Base Detector（Stage 2 Base）

## 🎯 你嘅原意（非常清晰）

> **Base = Stage 2 之後，price 落返嚟、橫行、整固
> 而且維持至少一個月，但 retrace 不能超過 50%**

---

## ✅ Daily Base 條件（正式 spec）

### Hard Filters（一定要先過）

1. Stock 必須係 **Stage 2**
2. 最近有一個 **明確高位（Peak）**

---

### Base 形成條件

假設：

* `PeakPrice`
* `BaseLow`
* `BaseDuration >= 20 trading days`
* `RetracePct <= 50%`

#### 計法：

```text
RetracePct = (PeakPrice - BaseLow) / PeakPrice
```

條件：

```text
RetracePct <= 0.5
```

而且：

```text
在 BaseDuration 內：
    Price 無再創新高
```

---

## 📌 Pseudo-code（Daily Base）

```ts
if (isStage2(stock)) {
  const peak = lastSwingHigh();
  const baseWindow = data.slice(peak.index, peak.index + 20);

  const baseLow = minLow(baseWindow);
  const retrace = (peak.price - baseLow) / peak.price;

  if (retrace <= 0.5 && noNewHigh(baseWindow)) {
    markBase({
      type: "daily_base",
      low: baseLow,
      duration: baseWindow.length
    });
  }
}
```

---

## 📎 Pivot 定義（Base 內）

Base 內：

* 用 Swing High / Swing Low 方法
* 搵 **internal pivot**
* 用嚟：

  * breakout
  * stop placement

---

# 3️⃣ Intraday Base / Setup Detector（Building, 未 Cross）

你呢段講得好「trader」，而且好重要。

## 🎯 Intraday Base 定義（你嘅語言）

> Price 去到一個高位 / 低位
> 然後一段時間：
>
> * 冇再突破
> * 冇 620 EMA cross
>   👉 就係一個 intraday base（石頭）

---

## ✅ Intraday Base Detection（Spec）

### 條件定義

假設：

* `PeakHigh`（或 `PeakLow`）
* `TimeWindow >= X bars`（例如 15–30 bars）
* `ABS_intraday` = intraday average bar

### 條件：

**對 High base（準備 short / fail breakout）**

```text
For next X bars:
    High < PeakHigh + small_buffer
    No 6/20 EMA cross
    Range contraction（optional）
```

**對 Low base（準備 long / reversal）**

```text
For next X bars:
    Low > PeakLow - small_buffer
    No 6/20 EMA cross
```

---

## 📌 Pseudo-code（Intraday Base）

```ts
if (no620Cross(window) && 
    rangeContracting(window) && 
    duration(window) >= minBars) {

  markIntradayBase({
    high: peakHigh,
    low: peakLow,
    state: "building"
  });
}
```

---

## 🟡 狀態標籤（非常重要）

每個 setup 應該有狀態：

* `building`
* `ready`
* `violated`
* `triggered`

例如：

```json
{
  "setup": "intraday_base",
  "state": "ready",
  "waiting_for": "620_cross"
}
```

---

# 🔗 點樣同你整個系統接駁（幫你對齊）

* **Swing High / Low**

  * 用嚟：

    * S/R
    * Double top / U&R
    * Gap reaction
    * Stop placement

* **Daily Base**

  * 用嚟：

    * Breakout
    * Momentum continuation
    * Pivot 定義

* **Intraday Base**

  * 用嚟：

    * Alert
    * Execution timing
    * 等 group cross

---
好，呢一段你問得**非常準**，因為 **Intraday Tiring Down** 呢個 setup 本身就係
👉「**用感覺 trade**」最難工程化嘅一種。
但其實——**你嘅直覺係可以寫成數學條件嘅**。

我會做 4 件事：

1. 🧠 先用「交易員語言」幫你**準確定義 Tiring Down 係乜**
2. 📐 再拆成 **4 個可量化嘅特徵**
3. 🧪 幫你寫成 **可以落 code 嘅 detection spec / pseudo-code**
4. 🧩 解釋點樣同你現有 620 / intraday base 系統接駁

---

# 🧠 一、Intraday Tiring Down —— 正確定義（交易員角度）

你講嘅 Tiring Down，本質係：

> **價格仍然創新高 / 嘗試突破，
> 但「推動價格向上嘅能量」正在減弱**

特徵唔係：

* 一下子反轉 ❌
  而係：
* **慢**
* **拖**
* **愈行愈辛苦**

👉 呢啲通常係：

* Failed breakout 前奏
* Gap up short / fade 嘅黃金 setup
* Leader 轉弱嘅第一個 intraday 訊號

---

# 📐 二、Tiring Down 嘅 4 個可量化特徵

你其實已經講咗 3 個，我幫你補齊成一套。

---

## 特徵 1️⃣：價格「仍然創高」，但每次推進幅度變細

### 交易員直覺

* 一開始 breakout：

  * 一 push 行好多
* 之後：

  * 仲破高
  * 但每次只行少少

### 工程化方法：**Higher High Momentum Decay**

#### 定義

* 找出連續嘅 **local highs**
* 計每一段「高 → 下一個高」嘅價格增幅

#### 條件

```text
ΔHigh₁ > ΔHigh₂ > ΔHigh₃
```

即：

* 創高仍在
* 但 **動能單調下降**

#### Pseudo-code

```ts
const highs = recentSwingHighs(intradayData);

if (
  highs.length >= 3 &&
  (highs[1] - highs[0]) > (highs[2] - highs[1])
) {
  momentumDecaying = true;
}
```

---

## 特徵 2️⃣：6EMA 與 22EMA 距離持續收窄（你已經講中）

### 核心邏輯

* 強勢趨勢：EMA 距離會 **擴大**
* Tiring：EMA 距離 **縮細**

### 定義

```text
EMA_gap = |EMA6 - EMA22|
```

### 條件

* EMA_gap 連續 N bars 下降
* 但 **尚未 cross**

#### Pseudo-code

```ts
const gapSeries = emaGapSeries(data, 6, 22);

if (
  isDecreasing(gapSeries, lastN = 10) &&
  !hasCrossedEMA(data, 6, 22)
) {
  emaCompression = true;
}
```

---

## 特徵 3️⃣：MACD（6,22）準備 cross，但未 cross

你呢個 point 非常專業。

### 你要嘅唔係 cross

你要嘅係：

> **MACD 動能收斂（histogram 縮）**

### 工程化定義

* MACD histogram 絕對值：

```text
|Hist₁| > |Hist₂| > |Hist₃|
```

* MACD line 同 signal line 距離收窄
* 尚未 cross

#### Pseudo-code

```ts
if (
  histogramContracting(macdHist, lastN = 8) &&
  !macdCrossed(macd)
) {
  macdTiring = true;
}
```

---

## 特徵 4️⃣：價格「行得慢」——但點樣計「慢」？

呢個就係你話「我唔知點計」嘅位，
但其實可以用 **時間 vs 位移效率**。

---

### 方法 A（推薦）：**Price Efficiency Ratio（好準）**

#### 定義

```text
Efficiency = |Close_end - Close_start| / Σ|Close[i] - Close[i-1]|
```

解釋：

* 行得直 = 效率高
* 行得 zig-zag = 效率低

#### Tiring Down 條件

* Efficiency 連續下降
* 同時價格仍然創高

```ts
if (
  efficiency(last10Bars) < efficiency(prev10Bars)
) {
  priceSlowing = true;
}
```

---

### 方法 B（簡化）：Bar Velocity

#### 定義

```text
Velocity = (High_now - High_prev) / bars_elapsed
```

* 越嚟越多 bar
* 升得越嚟越少

---

# 🧪 三、完整 Intraday Tiring Down Detection Spec

## 必要前置條件

* 股票 = Hot / Former Hot
* 價格處於 intraday 高位區
* 尚未 620 cross（或已 cross 但 momentum 減）

---

## 判斷條件（建議至少滿足 3/4）

```text
1. Higher highs but diminishing ΔHigh   ✅
2. EMA6–EMA22 gap contracting           ✅
3. MACD histogram contracting            ✅
4. Price efficiency declining            ✅
```

---

## 狀態輸出

```json
{
  "setup": "intraday_tiring_down",
  "state": "building",
  "evidence": [
    "momentum_decay",
    "ema_compression",
    "macd_hist_contracting",
    "price_efficiency_down"
  ],
  "waiting_for": "break / rejection / 620_cross"
}
```

---

# 🧩 四、點樣同你現有系統接駁（好重要）

### Tiring Down 係乜角色？

* ❌ 唔係 entry
* ❌ 唔係 signal
* ✅ 係 **warning + context setup**

### 正確用法

* 出現 Tiring Down →

  * 提醒 user：

    > 「推力開始弱」
* 再等：

  * Failed breakout
  * VWAP rejection
  * 620 cross 向下
* 先 trade

---

# 🧠 幫你定錨一句（好重要）

> **Tiring Down 唔係「跌緊」，
> 而係「升唔郁」。**

而你而家已經將「升唔郁」
變成一套 **可以寫入 code 嘅邏輯**。