# 🚀 Production Stripe Testing Guide

## ✅ Setup Complete!

Your Stripe payment system is now LIVE on Render!

- **Production URL:** https://stock-proxy.onrender.com
- **Webhook Endpoint:** https://stock-proxy.onrender.com/api/stripe/webhook
- **Webhook Status:** ✅ Configured in Stripe Dashboard
- **Deployment Status:** ✅ Live

---

## 🧪 Test 1: Free Trial (No Payment Required)

1. **Go to:** https://stock-proxy.onrender.com/pricing.html

2. **Login with Google** (if not already logged in)

3. **Click "Start Free Trial"** on the Free tier

4. **Expected Result:**
   - Success message appears
   - 7-day trial subscription created in database
   - Status: `trial`
   - No payment required

5. **Verify in Database:**
   ```sql
   SELECT * FROM user_subscriptions
   WHERE user_email = 'ketanjoshisahs@gmail.com'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Should show trial subscription

---

## 💳 Test 2: Paid Subscription (Basic Plan)

1. **Go to:** https://stock-proxy.onrender.com/pricing.html

2. **Click "Get Started"** on the Basic Plan ($29/month)

3. **Enter Test Card Details:**
   - **Card Number:** `4242 4242 4242 4242`
   - **Expiry:** `12/34` (any future date)
   - **CVC:** `123` (any 3 digits)
   - **ZIP:** `12345` (any ZIP)
   - **Name:** `Test User`

4. **Click "Complete Subscription"**

5. **Expected Result:**
   - Payment processes successfully
   - Webhook fires: `payment_intent.succeeded`
   - Subscription created in database with status: `active`
   - Success page shows

6. **Verify in Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/test/payments
   - Should see $29.00 payment
   - Status: Succeeded

7. **Verify Webhook:**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Click on your webhook
   - Should see recent events with status: `Succeeded`

8. **Verify in Database:**
   ```sql
   SELECT * FROM user_subscriptions
   WHERE user_email = 'ketanjoshisahs@gmail.com'
   AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Should show active subscription with Basic plan

---

## 💳 Test 3: Different Plans

Try the other plans:

### Pro Plan ($79/month)
- Same test card: `4242 4242 4242 4242`
- Should charge $79.00

### Enterprise Plan ($199/month)
- Same test card: `4242 4242 4242 4242`
- Should charge $199.00

---

## 🧪 Test 4: Failed Payment

1. **Use declined card:** `4000 0000 0000 0002`
2. **Expected Result:**
   - Payment fails
   - Error message shows
   - Webhook fires: `payment_intent.payment_failed`
   - No subscription created

---

## 🧪 Test 5: Insufficient Funds

1. **Use card:** `4000 0000 0000 9995`
2. **Expected Result:**
   - Payment fails with "insufficient funds"
   - Error message shows
   - No subscription created

---

## 📊 What to Check After Each Test

### ✅ In Stripe Dashboard:
1. **Payments:** https://dashboard.stripe.com/test/payments
   - See all payment attempts
   - Check status (succeeded/failed)

2. **Webhooks:** https://dashboard.stripe.com/test/webhooks
   - Click your webhook endpoint
   - See all events
   - All should show "Succeeded" status
   - If you see "Failed", check the error details

### ✅ In Your Database:
```sql
-- View all subscriptions
SELECT
    user_email,
    plan_code,
    status,
    billing_period,
    amount,
    currency,
    created_at,
    trial_end_date
FROM user_subscriptions
ORDER BY created_at DESC;

-- Count subscriptions by status
SELECT status, COUNT(*) as count
FROM user_subscriptions
GROUP BY status;

-- View payment intents
SELECT
    user_email,
    plan_code,
    stripe_payment_intent_id,
    amount,
    status,
    created_at
FROM user_subscriptions
WHERE stripe_payment_intent_id IS NOT NULL
ORDER BY created_at DESC;
```

### ✅ In Render Logs:
Go to: https://dashboard.render.com/web/srv-d0rjgm6uk2gs73aarnm0/logs

Look for:
```
✓ Stripe payment routes loaded successfully
Stripe webhook received: payment_intent.succeeded
Payment succeeded for user: ketanjoshisahs@gmail.com
```

---

## 🎓 Test Card Reference

```
✅ Success:                4242 4242 4242 4242
❌ Declined:               4000 0000 0000 0002
💰 Insufficient funds:     4000 0000 0000 9995
🔐 Requires 3D Secure:     4000 0025 0000 3155
```

All test cards accept:
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC (e.g., 123)
- Any billing ZIP (e.g., 12345)

---

## 🐛 Troubleshooting

### Problem: "Payment system not configured"
**Solution:** Check Render logs - Stripe keys might not be loaded

### Problem: "Webhook signature verification failed"
**Solution:**
- Check webhook secret in Render matches Stripe Dashboard
- Restart the service if needed

### Problem: Webhook shows "Failed" in Stripe Dashboard
**Solution:**
- Click on the failed webhook in Stripe Dashboard
- Check the error message
- Common issues:
  - Wrong endpoint URL
  - Server error (check Render logs)
  - Database connection issue

### Problem: Payment succeeds but subscription not created
**Solution:**
- Check Render logs for errors
- Verify database connection
- Check webhook is firing (Stripe Dashboard → Webhooks)

---

## ✅ Success Checklist

After testing, verify:

- [ ] Free trial signup works
- [ ] Basic plan payment succeeds ($29)
- [ ] Pro plan payment succeeds ($79)
- [ ] Enterprise plan payment succeeds ($199)
- [ ] Failed card shows error (doesn't create subscription)
- [ ] Stripe Dashboard shows all payments
- [ ] Webhooks show "Succeeded" status
- [ ] Database has correct subscription records
- [ ] Render logs show webhook events

---

## 🎉 Next Steps

Once all tests pass:

1. **Switch to Live Mode** (when ready for real payments):
   - Get live API keys from Stripe
   - Update environment variables in Render
   - Create production webhook with live keys

2. **Continue Development:**
   - Phase 4: Telegram Integration
   - Phase 5: Admin Panel
   - Phase 6: Email Notifications
   - Phase 7: Testing & Documentation

---

## 🔗 Quick Links

- **Your App:** https://stock-proxy.onrender.com/pricing.html
- **Stripe Dashboard:** https://dashboard.stripe.com/test
- **Stripe Payments:** https://dashboard.stripe.com/test/payments
- **Stripe Webhooks:** https://dashboard.stripe.com/test/webhooks
- **Render Dashboard:** https://dashboard.render.com/web/srv-d0rjgm6uk2gs73aarnm0
- **Render Logs:** https://dashboard.render.com/web/srv-d0rjgm6uk2gs73aarnm0/logs

---

**Ready to test! Start with the free trial, then try a paid plan! 🚀**
