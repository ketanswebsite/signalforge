# Stripe Production Webhook Setup (Render)

Your Stripe keys have been added to Render! Now we need to set up the production webhook in Stripe Dashboard.

## Step 1: Create Webhook in Stripe Dashboard

1. **Go to Stripe Dashboard:**
   - Login: https://dashboard.stripe.com/test/webhooks

2. **Click "Add endpoint"**

3. **Enter Webhook URL:**
   ```
   https://stock-proxy.onrender.com/api/stripe/webhook
   ```

4. **Select events to listen to:**
   Click "Select events" and choose these:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

5. **Click "Add endpoint"**

## Step 2: Get Webhook Signing Secret

After creating the webhook:

1. Click on the webhook you just created
2. Look for **"Signing secret"** section
3. Click **"Reveal"** to see the secret
4. It will look like: `whsec_xxxxxxxxxxxxx`
5. **Copy this secret!**

## Step 3: Update Render Environment Variable

I'll update the `STRIPE_WEBHOOK_SECRET` in Render once you provide the production webhook secret.

Just send me the webhook secret and I'll update it automatically!

## Step 4: Test on Production

Once the webhook secret is updated:

1. Go to: https://stock-proxy.onrender.com/pricing.html
2. Try the Free Trial first
3. Then try a paid plan with test card: `4242 4242 4242 4242`

## Verify in Stripe Dashboard

After testing, check:
- **Payments:** https://dashboard.stripe.com/test/payments
- **Webhook events:** https://dashboard.stripe.com/test/webhooks (should show successful deliveries)

---

## Current Status:

✅ Stripe keys added to Render
🔄 Deployment in progress
⏳ Waiting for production webhook secret

Once you create the webhook and send me the secret, we'll be ready to test!
