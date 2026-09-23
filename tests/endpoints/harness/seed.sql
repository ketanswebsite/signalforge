-- Endpoint-harness seed. global-setup.js loads it into a scratch sf_harness_* database after the schema copy:
--   psql -v ON_ERROR_STOP=1 -v admin_email=<ADMIN_EMAILS[0] from middleware/admin-auth.js> -d sf_harness_x -f seed.sql
-- Personas use the reserved .invalid TLD and every symbol is fake (HARNESS*): nothing can match a real account or listing.
-- Dates use CURRENT_DATE in UTC: global-setup sets the scratch database timezone to UTC, as on Render.

BEGIN;

-- ---------------------------------------------------------------- identities
INSERT INTO users (email, name, first_login, last_login, created_at) VALUES
  ('default',                    'Default User',   now(), now(), now()),   -- auth-disabled fallback user
  ('harness-user@e2e.invalid',   'Harness User',   now(), now(), now()),   -- live FREE trial -> passes ensureSubscriptionActive
  ('harness-nosub@e2e.invalid',  'Harness NoSub',  now(), now(), now()),   -- no subscription -> 403 "Subscription expired"
  ('harness-delete@e2e.invalid', 'Harness Delete', now(), now(), now()),   -- throwaway for DELETE /api/user/delete-account + DELETE /api/trades
  ('harness-victim@e2e.invalid', 'Harness Victim', now(), now(), now()),   -- throwaway target for admin user-removal routes
  ('harness-trial@e2e.invalid',  'Harness Trial',  now(), now(), now()),   -- no subscription yet: start-trial -> cancel -> reactivate
  (:'admin_email',               'Harness Admin',  now(), now(), now())
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------- paper-capital ledgers (baseline amounts)
INSERT INTO portfolio_capital (user_id, market, currency, initial_capital, available_capital)
SELECT us.u, mk.m, mk.c, mk.i, mk.i
FROM (VALUES ('India', 'INR', 1000000), ('UK', 'GBP', 10000), ('US', 'USD', 15000)) AS mk(m, c, i)
CROSS JOIN (VALUES ('default'), ('harness-user@e2e.invalid'), ('harness-delete@e2e.invalid'), (:'admin_email')) AS us(u)
ON CONFLICT (user_id, market) DO NOTHING;

-- ---------------------------------------------------------------- plans + subscriptions
INSERT INTO subscription_plans (plan_name, plan_code, region, currency, price_monthly, trial_days, is_active)
VALUES ('Explorer', 'FREE', 'Global', 'USD', 0, 90, true)
ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('subscription_plans', 'id'), (SELECT COALESCE(MAX(id), 1) FROM subscription_plans));

INSERT INTO user_subscriptions (user_email, plan_id, plan_name, plan_code, status, billing_cycle,
                                trial_start_date, trial_end_date, start_date, amount_paid, currency, created_at, updated_at)
SELECT 'harness-user@e2e.invalid', id, plan_name, plan_code, 'trial', 'trial',
       now(), now() + interval '60 days', now(), 0, currency, now(), now()
FROM subscription_plans WHERE plan_code = 'FREE';

INSERT INTO user_subscriptions (user_email, plan_id, plan_name, plan_code, status, billing_cycle,
                                trial_start_date, trial_end_date, start_date, amount_paid, currency, created_at, updated_at)
SELECT 'harness-delete@e2e.invalid', id, plan_name, plan_code, 'trial', 'trial',
       now(), now() + interval '60 days', now(), 0, currency, now(), now()
FROM subscription_plans WHERE plan_code = 'FREE';

INSERT INTO user_subscriptions (user_email, plan_id, plan_name, plan_code, status, billing_cycle,
                                trial_start_date, trial_end_date, start_date, amount_paid, currency, created_at, updated_at)
SELECT 'harness-victim@e2e.invalid', id, plan_name, plan_code, 'trial', 'trial',
       now(), now() + interval '60 days', now(), 0, currency, now(), now()
FROM subscription_plans WHERE plan_code = 'FREE';   -- target of the admin cancel/extend routes

INSERT INTO payment_transactions (user_email, transaction_id, payment_provider, amount, currency, status, payment_date)
VALUES ('harness-user@e2e.invalid', 'harness-txn-0001', 'manual', 9.99, 'GBP', 'completed', now() - interval '3 days');

-- ---------------------------------------------------------------- trades (manual, so no capital allocation to reconcile)
INSERT INTO trades (symbol, name, entry_date, entry_price, shares, status, target_price, stop_loss_percent,
                    investment_amount, trade_size, currency_symbol, market, user_id, auto_added)
VALUES
  ('HARNESS.L',  'Harness plc',   now() - interval '5 days', 100, 4, 'active', 108, 5, 400, 400, '£', 'UK', 'harness-user@e2e.invalid', false),
  ('HARNESS.L',  'Harness plc',   now() - interval '5 days', 100, 4, 'active', 108, 5, 400, 400, '£', 'UK', 'harness-delete@e2e.invalid', false),
  ('HARNESSD.L', 'Harness D plc', now() - interval '5 days', 100, 4, 'active', 108, 5, 400, 400, '£', 'UK', 'default', false);

INSERT INTO trades (symbol, name, entry_date, entry_price, exit_date, exit_price, shares, status, profit_loss,
                    profit_loss_percentage, exit_reason, target_price, stop_loss_percent, investment_amount, trade_size,
                    currency_symbol, market, user_id, auto_added)
VALUES ('HARNESSB.L', 'Harness B plc', now() - interval '20 days', 50, now() - interval '10 days', 54, 8, 'closed', 32,
        8, 'Target reached', 54, 5, 400, 400, '£', 'UK', 'harness-user@e2e.invalid', false);

INSERT INTO trade_exit_checks (trade_id, check_time, current_price, pl_percent, days_held)
SELECT id, now() - interval '2 days', 101, 1, 3 FROM trades WHERE symbol = 'HARNESS.L' AND user_id = 'harness-user@e2e.invalid';

-- ---------------------------------------------------------------- 7 AM scan output for "today" (UTC)
-- 'pending' is safe: the 1 PM executor cron is stubbed and AUTO_EXECUTE=false; the boot cleanup only
-- deletes PENDING rows dated before yesterday.
INSERT INTO pending_signals (symbol, signal_date, entry_price, target_price, stop_loss, square_off_date, market,
                             win_rate, historical_signal_count, entry_dti, entry_7day_dti, status,
                             conviction_score, conviction_verdict, conviction_engine, conviction_summary, conviction_checked_at)
VALUES
  ('HARNESSP.L', CURRENT_DATE, 100, 108, 95, CURRENT_DATE + 30, 'UK', 80, 12, -45, -30, 'pending',
   6.5, 'GO', 'rule-based', 'Harness fixture signal', now()),
  ('HARNESSQ.L', CURRENT_DATE, 200, 216, 190, CURRENT_DATE + 30, 'UK', 78, 9, -40, -28, 'dismissed',
   5.2, 'WATCH', 'rule-based', 'Harness fixture signal (AI-gated out)', now());

-- ---------------------------------------------------------------- AI verdicts: makes /api/ml/conviction/* hermetic for these symbols
INSERT INTO conviction_daily (symbol, score_date, confidence, verdict, engine, payload)
SELECT s, CURRENT_DATE, 6.5, 'GO', 'rule-based',
       jsonb_build_object('success', true, 'symbol', s, 'name', s, 'confidence', 6.5, 'verdict', 'GO', 'engine', 'rule-based',
                          'summary', null,
                          'pillars', jsonb_build_object(
                             'technical',   jsonb_build_object('score', 7, 'weight', 45, 'evidence', jsonb_build_array('fixture')),
                             'fundamental', jsonb_build_object('score', 6, 'weight', 30, 'evidence', jsonb_build_array('fixture')),
                             'information', jsonb_build_object('score', 6, 'weight', 25, 'evidence', jsonb_build_array('fixture'))),
                          'context', jsonb_build_object('winRate', null),
                          'generatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
FROM (VALUES ('HARNESS.L'), ('HARNESSP.L')) AS v(s)
ON CONFLICT (symbol, score_date) DO NOTHING;

-- ---------------------------------------------------------------- high-conviction portfolio (admin /api/portfolio/*)
INSERT INTO high_conviction_portfolio (symbol, name, market, signal_date, entry_date, entry_price, current_price, target_price,
                                       stop_loss_price, square_off_date, investment_gbp, shares, currency_symbol, status, win_rate,
                                       total_backtest_trades, entry_dti)
VALUES ('HARNESSH.L', 'Harness H plc', 'UK', CURRENT_DATE - 3, CURRENT_DATE - 3, 100, 101, 108, 95, CURRENT_DATE + 27,
        1000, 10, '£', 'active', 80, 12, -45);

-- ---------------------------------------------------------------- misc tables read by the routes
INSERT INTO stock_market_caps (symbol, market_cap, market_cap_usd, market_cap_category, currency)
VALUES ('HARNESS.L', 250000000, 320000000, 'small', 'GBP')
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO alert_preferences (user_id, telegram_enabled, alert_on_buy, alert_on_target, alert_on_stoploss, alert_on_time_exit)
VALUES ('harness-user@e2e.invalid', true, true, true, true, true)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO telegram_subscribers (chat_id, username, first_name, subscription_type, is_active)
VALUES ('-1000000000001', 'harness_sub', 'Harness', 'all', true)
ON CONFLICT (chat_id) DO NOTHING;

COMMIT;
