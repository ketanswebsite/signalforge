# Stripe Webhook Setup Guide

This guide will help you set up Stripe webhooks for both local development and production.

## Prerequisites

- Stripe account with test keys configured (✅ Already done!)
- Node.js server running locally on port 3000

---

## Option 1: Local Development with Stripe CLI (Recommended for Testing)

The **Stripe CLI** is the easiest way to test webhooks locally.

### Step 1: Install Stripe CLI

**On Windows:**
```bash
# Using Scoop (if you have it)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Or download directly from:
# https://github.com/stripe/stripe-cli/releases/latest
```

**On macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**On Linux:**
```bash
# Download the latest release from GitHub
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar -xvf stripe_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

### Step 2: Login to Stripe

```bash
stripe login
```

This will open your browser and ask you to authorize the CLI. Click "Allow access".

### Step 3: Forward Webhooks to Your Local Server

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Important:** Keep this command running! You'll see output like:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Copy the Webhook Secret

Copy the webhook signing secret (starts with `whsec_`) and add it to your `.env` file:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### Step 5: Restart Your Server

```bash
npm start
```

### Step 6: Test the Webhook

Open a new terminal and trigger a test event:

```bash
# Test a successful payment
stripe trigger payment_intent.succeeded

# Test a failed payment
stripe trigger payment_intent.payment_failed
```

You should see the webhook events being received in your server logs!

---

## Option 2: Production Setup (Render/Live Server)

For production, you'll configure webhooks directly in the Stripe Dashboard.

### Step 1: Get Your Production Webhook URL

Your webhook URL will be:
```
https://your-app-name.onrender.com/api/stripe/webhook
```

Replace `your-app-name` with your actual Render app URL.

### Step 2: Create Webhook in Stripe Dashboard

1. Go to **Stripe Dashboard**: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter your webhook URL: `https://your-app-name.onrender.com/api/stripe/webhook`
4. Under "Select events to listen to", choose:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

   Or simply select **"Select all events"** for testing.

5. Click **"Add endpoint"**

### Step 3: Get Your Webhook Signing Secret

1. After creating the endpoint, click on it
2. You'll see **"Signing secret"** at the top
3. Click **"Reveal"** to see your signing secret (starts with `whsec_`)
4. Copy this secret

### Step 4: Add to Render Environment Variables

1. Go to your Render Dashboard
2. Select your web service
3. Go to **Environment** tab
4. Add a new environment variable:
   - **Key:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_xxxxxxxxxxxxxxxxxxxxx` (paste your signing secret)
5. Click **"Save Changes"**

Your app will automatically restart with the new environment variable.

---

## Testing Your Webhook Setup

### Test Free Trial (No Payment Required)

```bash
curl -X POST http://localhost:3000/api/subscription/start-free-trial \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"planCode": "FREE"}'
```

### Test Payment Intent Creation

1. Go to your checkout page: `http://localhost:3000/checkout.html?plan=BASIC_US`
2. Use Stripe test card numbers:
   - **Success:** `4242 4242 4242 4242`
   - **Declined:** `4000 0000 0000 0002`
   - **Requires authentication:** `4000 0025 0000 3155`
3. Any future expiry date (e.g., 12/34)
4. Any 3-digit CVC (e.g., 123)
5. Any billing ZIP code

### Verify Webhook is Working

Check your server logs for:
```
Stripe webhook received: payment_intent.succeeded
✅ Payment succeeded for user: your-email@example.com
```

---

## Webhook Events We Handle

Your server is configured to handle these events:

| Event | Description | What We Do |
|-------|-------------|------------|
| `payment_intent.succeeded` | Payment completed successfully | Activate user's subscription |
| `payment_intent.payment_failed` | Payment failed | Mark subscription as failed, notify user |
| `customer.subscription.created` | New subscription created | Log subscription creation |
| `customer.subscription.updated` | Subscription changed (plan/status) | Update subscription details |
| `customer.subscription.deleted` | Subscription cancelled | Mark as cancelled in database |
| `invoice.payment_succeeded` | Recurring payment succeeded | Record payment, extend subscription |
| `invoice.payment_failed` | Recurring payment failed | Notify user, mark payment failed |

---

## Troubleshooting

### Webhook Not Receiving Events

1. **Check Stripe CLI is running:**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

2. **Check webhook secret is set:**
   ```bash
   echo $STRIPE_WEBHOOK_SECRET
   ```

3. **Check server logs for errors:**
   Look for messages like:
   - `✓ Stripe payment routes loaded successfully`
   - `Webhook signature verification failed`

### Signature Verification Failed

This means your `STRIPE_WEBHOOK_SECRET` doesn't match. Make sure:
1. You copied the correct secret from Stripe CLI or Dashboard
2. You restarted your server after adding the secret
3. There are no extra spaces in your `.env` file

### Testing in Production

Use Stripe Dashboard's **"Send test webhook"** feature:
1. Go to your webhook endpoint in Stripe Dashboard
2. Click **"Send test webhook"**
3. Select an event type (e.g., `payment_intent.succeeded`)
4. Click **"Send test webhook"**
5. Check your Render logs to see if it was received

---

## Quick Reference

### Stripe Test Card Numbers

```
Success:                4242 4242 4242 4242
Declined:               4000 0000 0000 0002
Insufficient funds:     4000 0000 0000 9995
Requires auth (3DS):    4000 0025 0000 3155
```

### Useful Stripe CLI Commands

```bash
# Login
stripe login

# Listen for webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger customer.subscription.created

# View webhook logs
stripe logs tail

# List all webhooks
stripe webhooks list
```

---

## Next Steps

1. ✅ Install Stripe CLI
2. ✅ Run `stripe listen` to get webhook secret
3. ✅ Add secret to `.env` file
4. ✅ Restart your server
5. ✅ Test with `stripe trigger payment_intent.succeeded`
6. ✅ Try a real checkout flow with test cards

Once everything works locally, repeat the **Production Setup** steps when you're ready to deploy!

---

## Support

- Stripe Documentation: https://stripe.com/docs/webhooks
- Stripe CLI: https://stripe.com/docs/stripe-cli
- Test Cards: https://stripe.com/docs/testing

If you encounter issues, check the server logs and Stripe Dashboard webhook logs for detailed error messages.
