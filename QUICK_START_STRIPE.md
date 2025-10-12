# Quick Start: Testing Stripe Payments

Your Stripe integration is now set up! Here's how to test it quickly:

## Prerequisites ✅

- ✅ Stripe test keys added to `.env`
- ✅ Stripe package installed
- ✅ Payment routes configured

## Quick Test (5 Minutes)

### Step 1: Install Stripe CLI

**Windows (using Scoop):**
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Or download directly:**
https://github.com/stripe/stripe-cli/releases/latest

### Step 2: Login to Stripe CLI

```bash
stripe login
```

This opens your browser to authorize. Click "Allow access".

### Step 3: Start Webhook Forwarding

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**IMPORTANT:** Copy the webhook signing secret that appears (starts with `whsec_`)

Example output:
```
> Ready! Your webhook signing secret is whsec_1234567890abcdefghijklmnop
```

### Step 4: Add Webhook Secret to .env

Open `.env` and update this line:

```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnop
```

(Replace with your actual secret from Step 3)

### Step 5: Start Your Server

In a **new terminal**:

```bash
npm start
```

Look for these logs:
```
✓ Stripe payment routes loaded successfully
```

### Step 6: Test the Integration

#### Option A: Test Free Trial (Easiest)

1. Make sure you're logged in to your app
2. Go to: http://localhost:3000/pricing.html
3. Click "Start Free Trial" on the FREE plan
4. You should be redirected to success page!

Check your database - you should have a subscription record with status='trial'.

#### Option B: Test Paid Subscription

1. Go to: http://localhost:3000/pricing.html
2. Click "Get Started" on any paid plan
3. On checkout page, use these test card details:

**Test Card Numbers:**
- **Card Number:** 4242 4242 4242 4242
- **Expiry:** Any future date (e.g., 12/34)
- **CVC:** Any 3 digits (e.g., 123)
- **ZIP:** Any 5 digits (e.g., 12345)

4. Click "Complete Subscription"
5. Watch your Stripe CLI terminal - you should see:
   ```
   payment_intent.succeeded
   ```
6. Your server logs should show:
   ```
   Payment succeeded for user: your-email@example.com
   ```

### Step 7: Verify in Database

Check your `user_subscriptions` table:
```sql
SELECT * FROM user_subscriptions ORDER BY created_at DESC LIMIT 5;
```

You should see your new subscription with `status='active'`.

---

## Troubleshooting

### "Stripe client not initialized"

Make sure your `.env` has both keys:
```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

Restart your server after adding them.

### "Webhook signature verification failed"

1. Make sure you copied the **exact** webhook secret from Stripe CLI
2. Restart your server after adding the secret
3. No extra spaces in `.env` file

### Stripe CLI says "command not found"

Make sure Stripe CLI is installed and in your PATH. Try:
```bash
stripe --version
```

### Payment succeeds but subscription not activated

Check your server logs for webhook events. The webhook handler should log:
```
Stripe webhook received: payment_intent.succeeded
Payment succeeded for user: your-email@example.com
```

---

## What's Next?

Once local testing works:

1. **Deploy to Render** (or your production server)
2. **Set up production webhook** in Stripe Dashboard:
   - URL: `https://your-app.onrender.com/api/stripe/webhook`
   - Events: Select all payment and subscription events
3. **Add webhook secret** to Render environment variables
4. **Test with real test cards** in production

---

## Useful Commands

```bash
# Trigger a test payment success
stripe trigger payment_intent.succeeded

# Trigger a test payment failure
stripe trigger payment_intent.payment_failed

# View recent Stripe events
stripe events list --limit 10

# View webhook logs
stripe logs tail
```

---

## Test Card Numbers

```
✅ Success:                4242 4242 4242 4242
❌ Declined:               4000 0000 0000 0002
💰 Insufficient funds:     4000 0000 0000 9995
🔐 Requires auth (3DS):    4000 0025 0000 3155
```

All cards accept:
- Any future expiry date
- Any 3-digit CVC
- Any billing ZIP code

---

## Ready to Test?

1. Run: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
2. Copy webhook secret to `.env`
3. Run: `npm start`
4. Visit: http://localhost:3000/pricing.html
5. Try a free trial or paid subscription!

🎉 Good luck!
