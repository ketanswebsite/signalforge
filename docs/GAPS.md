# SignalForge Gap Register — pre-live-test audit (2026-08-07)

Grounded in the 8-month production post-mortem (202 closed executed trades, 726 paper
trades; report: https://claude.ai/code/artifact/1f153a5a-57d4-4150-affb-e4896dddc9f4)
and a production database audit. Each gap has a **Closed when** definition — the live
re-test should not start until every CRITICAL is closed.

## A. Signal quality — why the last run lost

| # | Sev | Gap | Closed when |
|---|-----|-----|-------------|
| 1 | CRITICAL | Win-rate filter selects noise: no minimum sample size, no uncertainty adjustment. 49% of executed trades rode backtests of ≤5 trades; 42% carried "100%" records; calibration is flat-to-inverted (promised 90–99% → realized 25%). | Selection = Wilson lower bound (95%) ≥ target AND ≥15 completed backtest trades. Calibration (promised vs realized) tracked monthly in the weekly report. |
| 2 | CRITICAL | Backtest engine optimism: close-only fills (intraday −5% touches invisible), TP checked before SL on same bar, gaps fill at exactly −5.00%, zero fees. Live stops averaged −5.49%. | Fills use daily high/low; SL wins both-hit bars; gap-downs fill at open; per-market fee+slippage haircut. Sanity check: honest engine replayed over Oct-25→Aug-26 must reproduce ≈39% live win rate, not 75%. |
| 3 | HIGH | No out-of-sample discipline — the same 5y window both selects stocks and advertises their win rate. | Walk-forward harness: select on data ≤ month T, score on T+1, rolling; a filter ships only if it beats random OOS. |
| 4 | HIGH | Entry threshold 0 (module default is Blau's −40) fires on shallow noise dips; random-walk baseline fully explains results (38.5% vs realized 39.1%). | Threshold study done OOS (0 vs −25 vs −40); chosen value read from settings, not hardcoded. |
| 5 | MEDIUM | No regime gate — monthly win rate tracked the index (25% Jan, 62% Apr). | Index-trend gate (e.g. skip new longs while index < its 100d trend) implemented and honestly backtested. |

## B. Ledger & engineering correctness

| # | Sev | Gap | Closed when |
|---|-----|-----|-------------|
| 6 | CRITICAL | Capital ledger leaks: available should be initial+realized−open, actual is far lower — India ₹686,160 stranded (69% of pot), UK £4,735 (47%), US $13,502 (91%); US shows active_positions=1 with 0 open trades. Sizing uses initial+realized while validation uses available → mass "insufficient capital" dismissals (768 signals). | Ledger derived from trades table on read (or nightly reconciliation job recomputing available/allocated/positions and alerting on drift ≠ 0). No incremental mutation without invariant check. |
| 7 | HIGH | Two backtest engines disagree (backtest-calculator.js has 7-day-DTI exit + day-vs-day comparison; frontend-backtest-calculator.js has neither). Scanner uses the latter; studies using the former reach different conclusions. | One engine module, consumed by scanner, frontend, and research scripts. |
| 8 | MEDIUM | 7-day DTI buckets are row-count-from-series-start (i % 7) — every new bar shifts all historical period boundaries; yesterday's signal can vanish today. | Anchored buckets (ISO-week or fixed epoch anchor); signals reproducible across runs. |
| 9 | MEDIUM | settings-manager (user_settings table) exists but scanner/executor/monitors hardcode TP/SL/threshold/position caps — the settings UI is decorative. | Pipeline reads settings (env fallback) at job start; changing a setting changes behavior without deploy. |
| 10 | MEDIUM | Stock universe is a hardcoded snapshot (2025-10-27, 5,251 symbols); delisted tickers fail silently forever. | Refresh script + per-symbol consecutive-failure counter that prunes/flags dead tickers. |
| 11 | LOW | Hardcoded FX rates (GBP_TO_INR 105 etc.) skew all cross-currency reporting. | Daily FX fetch cached in DB; reports use dated rates. |
| 12 | LOW | Telegram sends swallow errors (empty catch blocks) — delivery failures are invisible. | Failures logged with counts; weekly report includes delivery stats. |
| 13 | LOW | trade_exit_checks grows unbounded (409,385 rows; DB 79 MB). | 30-day retention job. |

## C. Test-readiness & measurement

| # | Sev | Gap | Closed when |
|---|-----|-----|-------------|
| 14 | HIGH | No strategy-version stamp on trades — results can't be attributed to rule versions after changes. | Every trade records strategy_version (git SHA + param hash) at entry. |
| 15 | MEDIUM | No benchmark: a trade that made 3% while the index made 5% reads as a win. | Per-trade index return over the same holding window recorded at close; weekly report shows alpha. |
| 16 | MEDIUM | No kill-switch — trading can only be stopped by redeploying. | AUTO_EXECUTE env flag: false = observation mode (scan + signals + alerts, no bookings). |
| 17 | LOW | Jest tests don't cover strategy math or ledger invariants. | Unit tests: DTI known-values, backtest fill rules, ledger invariant (available = initial + realized − allocated). |

## Reset plan (executed 2026-08-07 pending confirmation)

Archive `trades`, `high_conviction_portfolio`, `pending_signals`, `portfolio_capital`
to `archive_*_20260807` tables in-DB (CSV copies also exported locally pre-reset);
truncate `trade_exit_checks` + `trade_alerts_sent`; wipe live trades/HC/signals;
reset every capital row to available = initial, realized = 0, allocated = 0,
positions = 0. Users, subscribers, settings, market caps, payments, audit logs
untouched. Observation mode ON (AUTO_EXECUTE=false) until CRITICALs closed.
