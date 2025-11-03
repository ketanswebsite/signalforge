# Metrics Verification from Database

## Closed Trades from Database (6 trades)

### India Market (2 trades)
| Symbol | Exit Date | Profit/Loss | P/L % | Market |
|--------|-----------|-------------|-------|---------|
| TECILCHEM.NS | Nov 3 | +₹10,175.44 | +10.18% | India |
| JSWINFRA.NS | Oct 31 | -₹2,646.06 | -5.29% | India |

**India Total P&L: ₹7,529.38**

### US Market (4 trades)
| Symbol | Exit Date | Profit/Loss | P/L % | Market |
|--------|-----------|-------------|-------|---------|
| SAIL | Nov 3 | -$75.66 | -5.04% | US |
| PKG | Oct 31 | -$90.40 | -6.03% | US |
| CHRW | Oct 30 | +$298.53 | +19.90% | US |
| AXL | Oct 26 | +$219.96 | +14.66% | US |

**US Total P&L: $352.43**

## Correct Metrics (After Multi-Currency Fix)

### 1. Total P&L (Separated by Market)
**Display: "₹7,529 | $352"**
- India: ₹7,529.38
- US: $352.43

### 2. Average Return (Combined across all trades)
(-5.04 + 10.18 + (-5.29) + (-6.03) + 19.90 + 14.66) / 6 = 28.38 / 6 = **4.73%**

### 3. Win Rate (Combined)
3 wins / 6 total = **50.0%**

### 4. Total Trades
**6 closed trades**

### 5. Best Market
- India Win Rate: 1/2 = 50%
- US Win Rate: 2/4 = 50%
(Tie - both 50%)

### 6. Max Drawdown (Correct Formula)

Using cumulative percentage returns (chronological order by exit_date):
1. AXL (Oct 26): +14.66% → CumReturn: 14.66%, Peak: 14.66%, DD: 0%
2. CHRW (Oct 30): +19.90% → CumReturn: 34.56%, Peak: 34.56%, DD: 0%
3. PKG (Oct 31): -6.03% → CumReturn: 28.53%, Peak: 34.56%, DD: 6.03%
4. JSWINFRA.NS (Oct 31): -5.29% → CumReturn: 23.24%, Peak: 34.56%, DD: 11.32%
5. TECILCHEM.NS (Nov 3): +10.18% → CumReturn: 33.42%, Peak: 34.56%, DD: 1.14%
6. SAIL (Nov 3): -5.04% → CumReturn: 28.38%, Peak: 34.56%, DD: 6.18%

**Max Drawdown: 11.3%** (largest drop from cumulative return peak)

### Notes on Previous Errors

**Multi-Currency Error:**
- Before Fix: Code was adding USD and INR directly (7,529.38 + 352.43 = 7,881.81) treating $352 as ₹352
- After Fix: Displays separate totals to avoid currency mixing

**Max Drawdown Error:**
- Before Fix: Used equity-based calculation with currency amounts, resulting in incorrect 25.7%
- After Fix: Uses cumulative percentage returns matching advanced metrics formula, correct value: 11.3%
