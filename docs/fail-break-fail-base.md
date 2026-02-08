好，你而家講嘅其實係 3 個 detector，全部都可以好乾淨咁工程化：

1. **VCP（Volatility Contraction Pattern）**：用「收縮度」去判斷
2. **Fail Base**：VCP 後跌穿 50MA（trend template 失效）
3. **Fail Breakout**：VCP breakout 後反轉、再跌穿突破位（pivot reclaim 失敗）

我會用你描述嘅方法，幫你寫成 **可落 code / 可寫 spec** 嘅版本（定義、條件、輸出）。

---

# 1️⃣ VCP Detector（基於你嘅「收縮度」定義）

## 1.1 Input（你已經有）

* 已 detect 到一個 **base**（daily）
* base 有一個 **底部 BaseLow**（你會用佢做標準）
* base 之後，price 做一段上升、回落、再上升…（形成「收縮」）

---

## 1.2 你嘅核心方法（正式化）

你嘅做法係用「波幅區間收縮」去定義 VCP：

### 定義兩段 swing range

假設 base 之後有兩個收縮 cycle（最少要 2 個先叫 VCP）：

* Cycle A：

  * `A_high` = 第一個明顯高位
  * `A_low` = A_high 之後嘅最低位
  * `A_range = A_high - A_low`

* Cycle B：

  * `B_high` = 下一個高位（可能比 A_high 低啲或近啲）
  * `B_low` = B_high 之後嘅最低位
  * `B_range = B_high - B_low`

---

## 1.3 VCP 收縮條件（你講嘅 1/3 ~ 2/3）

你嘅判斷係：

> 如果 `B_range` 係 `A_range` 嘅 1/3 到 2/3 之間，
> 即代表波幅收縮（contraction）成立。

### 條件：

```text
B_range <= (2/3) * A_range
AND
B_range >= (1/3) * A_range
```

（你可以將呢個做成可調參數）

---

## 1.4 你嘅 swing high/low 來源

你前面已經定義咗 swing high/low detector（用 ABS + 10日隔離），
VCP detector 就可以直接重用：

* `A_high` / `B_high` = swing highs
* `A_low` / `B_low` = swing lows（或 local lows）

---

## 1.5 VCP Detector 輸出（建議 JSON）

```json
{
  "pattern": "VCP",
  "base_id": "base_123",
  "cycles": [
    { "high": 120, "low": 108, "range": 12 },
    { "high": 118, "low": 112, "range": 6 }
  ],
  "contraction_ratio": 0.50,
  "state": "built"
}
```

---

# 2️⃣ Fail Base Detector（VCP 後跌穿 50MA）

## 2.1 定義（你講得好清楚）

> **建造咗 VCP 之後，如果 price 跌低過 50MA → Fail Base**

### 最簡定義：

```text
if Close < MA50  (for X days or with confirmation)
=> fail_base = true
```

### 建議加「避免假穿」

你可以用其中一種確認方式（可調）：

* 收市價跌穿（close-based）
* 連續 2 日收市跌穿
* 跌穿幅度 > 0.5 * ABS（避免一個 tick 假穿）

---

## 2.2 Fail Base 輸出

```json
{
  "signal": "fail_base",
  "pattern_ref": "VCP",
  "ma_broken": "MA50",
  "break_day": "2026-02-08",
  "severity": "high"
}
```

---

# 3️⃣ Fail Breakout Detector（VCP breakout 後反轉 + 跌穿突破位）

你描述嘅流程其實係「breakout failure」的標準定義，但你加咗一個好清晰條件：

> **突破新高 → reverse → 跌回突破位之下（甚至跌深過）**

---

## 3.1 關鍵價位：Breakout Level（Pivot）

你要先定義 VCP breakout pivot（通常係最後一次 contraction 嘅 high，或者 base pivot high）。

* `pivot = breakout_level`

---

## 3.2 Fail Breakout 條件（完整流程）

1. 先發生 breakout：

```text
High >= pivot (or Close > pivot)
```

2. breakout 後 reverse：

* 例如：

  * 出現 reversal candle
  * 或者 close 返落 pivot 附近

3. 最終確認 fail：

```text
Close < pivot
AND close_distance_below_pivot >= threshold
```

threshold 可用：

* 固定 %（例如 0.2%–0.5%）
* 或 ABS fraction

> 你講「落回多過之前新高位置」我理解為：
> **唔係貼住 pivot，而係明顯跌穿 pivot**

---

## 3.3 Fail Breakout 輸出

```json
{
  "signal": "fail_breakout",
  "pattern_ref": "VCP",
  "pivot": 118.0,
  "breakout_day": "2026-01-15",
  "failure_day": "2026-01-17",
  "failure_strength": "strong"
}
```

---

# 4️⃣ 三個 detector 點樣接駁你個平台（最重要）

## 在你個系統入面，呢三樣嘢其實係：

* **VCP**：Bullish setup（base within base, contraction）
* **Fail Breakout**：Bullish setup 變成 bearish（short opportunity / warning）
* **Fail Base**：結構性失效（直接降級 → former hot / bearish stage）

---

# 5️⃣ 建議你加多 2 個實用細節（唔改你概念，只係更穩）

## 5.1 VCP 次數（2-cycle vs 3-cycle）

你而家係用 A、B 兩段。
你可以加個 optional：

* 如果有第 3 段 `C_range`，再驗：

```text
C_range < B_range < A_range
```

咁就係「更高分」VCP（score 更高）

## 5.2 Volume contraction（optional evidence）

VCP 原著通常配合 volume 收縮，你可以唔硬性加，但做成「evidence」：

* base 期間 volume moving average 下移
* 或 volume z-score 轉低

---

# 6️⃣ 你可以直接放入「Evidence hints」UI

當 VCP built：

* ✅ Contraction ratio: 0.50 (within 1/3–2/3)
* ✅ Range contracting
* （optional）✅ Volume drying up

當 Fail breakout：

* 🔴 Breakout failed: close back below pivot
* 🔴 Violation confirmed: below pivot by X

當 Fail base：

* 🔴 Template broken: close below MA50

---

如果你想，我下一步可以幫你做其中一樣（唔問多餘問題，直接落地）：

1. 將以上寫成 **Detector Spec 文件（可直接放 Master Spec 附錄）**
2. 幫你寫 **TypeScript detector functions（daily）**
3. 幫你設計 **Chart annotation schema（VCP cycles / pivot / fail markers）**

你而家呢套 VCP → fail breakout / fail base，已經可以做到一個好有 edge 嘅「leader 轉弱提示器」。
