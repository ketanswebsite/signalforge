# Stripe Batch Files Guide

I've created 4 batch files to make Stripe webhook setup easier on Windows. Here's how to use them:

---

## 📁 Batch Files Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| **setup-stripe-webhook.bat** | Interactive setup with instructions | First time setup |
| **stripe-auto-setup.bat** | Automatic secret capture & .env update | Quick automated setup |
| **run-stripe-webhook.bat** | Keep webhook listener running | During testing |
| **setup-stripe-local.bat** | Basic manual setup | If others fail |

---

## 🚀 Recommended Approach

### Step 1: Install Stripe CLI (One-time)

**Option A - Using Scoop (Easiest):**
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Option B - Manual Download:**
1. Go to: https://github.com/stripe/stripe-cli/releases/latest
2. Download `stripe_X.X.X_windows_x86_64.zip`
3. Extract to `C:\stripe`
4. Add `C:\stripe` to your Windows PATH

### Step 2: Run Automatic Setup (Recommended)

Double-click: **`stripe-auto-setup.bat`**

This will:
1. ✅ Check if Stripe CLI is installed
2. ✅ Login to Stripe (opens browser)
3. ✅ Capture webhook secret automatically
4. ✅ Update your `.env` file
5. ✅ Show you next steps

**If successful**, you'll see:
```
SUCCESS! Webhook secret has been saved to .env

Next steps:
  1. Restart your Node.js server: npm start
  2. In a NEW terminal, run: run-stripe-webhook.bat
  3. Keep that terminal open while testing
  4. Visit: http://localhost:3000/pricing.html
```

### Step 3: Run Webhook Listener During Testing

Double-click: **`run-stripe-webhook.bat`**

Keep this window open while testing payments!

---

## 📋 Detailed File Usage

### 1. stripe-auto-setup.bat ⭐ RECOMMENDED

**What it does:**
- Checks Stripe CLI installation
- Handles Stripe login
- Automatically captures webhook secret
- Updates `.env` file with secret
- Shows next steps

**How to use:**
```bash
# Just double-click the file, or run:
stripe-auto-setup.bat
```

**What you'll need to do:**
1. Wait for browser to open for Stripe login
2. Click "Allow access" in browser
3. Let the script finish (takes ~10 seconds)
4. Restart your Node.js server

---

### 2. run-stripe-webhook.bat 🔄 FOR TESTING

**What it does:**
- Starts Stripe webhook listener
- Forwards webhooks to localhost:3000
- Shows webhook secret (in case you need it again)
- Stays running until you press Ctrl+C

**How to use:**
```bash
# Run this AFTER stripe-auto-setup.bat
# Keep it running while testing payments
run-stripe-webhook.bat
```

**When to use:**
- Every time you want to test payments locally
- Keep it running in a separate terminal
- Stop with Ctrl+C when done testing

**What you'll see:**
```
================================================
    Stripe Webhook Listener
================================================

Ready! Your webhook signing secret is whsec_abc123...
[200] POST /api/stripe/webhook [evt_xxx]
```

---

### 3. setup-stripe-webhook.bat 📖 MANUAL SETUP

**What it does:**
- Checks installation
- Handles login
- Shows instructions for manual secret copying
- Starts listener

**How to use:**
```bash
setup-stripe-webhook.bat
```

**When to use:**
- If automatic setup fails
- If you prefer to manually copy the secret
- For troubleshooting

---

### 4. setup-stripe-local.bat 🔧 BASIC

**What it does:**
- Simple installation check
- Basic login
- Starts listener (no automation)

**How to use:**
```bash
setup-stripe-local.bat
```

**When to use:**
- If all other methods fail
- For debugging
- Minimal approach

---

## 🎯 Quick Start Guide

### First Time Setup (5 minutes)

1. **Install Stripe CLI**
   ```bash
   scoop install stripe
   ```

2. **Run Auto Setup**
   ```bash
   stripe-auto-setup.bat
   ```
   - Login when browser opens
   - Wait for completion
   - Secret is automatically saved!

3. **Restart Your Server**
   ```bash
   npm start
   ```

4. **Start Webhook Listener**
   ```bash
   run-stripe-webhook.bat
   ```
   - Keep this window open!

5. **Test Payment**
   - Go to: http://localhost:3000/pricing.html
   - Click "Get Started" on any plan
   - Use test card: `4242 4242 4242 4242`

### Every Time You Test (1 minute)

1. **Start your Node.js server** (if not running)
   ```bash
   npm start
   ```

2. **Start webhook listener**
   ```bash
   run-stripe-webhook.bat
   ```
   - Keep it running!

3. **Test payments**
   - Visit pricing page
   - Make test purchases

4. **Stop listener when done**
   - Press Ctrl+C in webhook listener window

---

## 🔍 Troubleshooting

### "Stripe CLI not found"

**Problem:** Stripe CLI is not installed or not in PATH

**Solution:**
```bash
# Check if installed
stripe --version

# If not found, install:
scoop install stripe

# Or add to PATH manually if already downloaded
```

### "Login failed"

**Problem:** Browser didn't complete authentication

**Solution:**
1. Close all Stripe CLI windows
2. Run: `stripe login` manually
3. Complete authentication in browser
4. Run the batch file again

### "Could not automatically capture secret"

**Problem:** Auto-setup couldn't extract webhook secret

**Solution:**
Use manual method:
1. Run: `setup-stripe-webhook.bat`
2. Copy the webhook secret manually (starts with `whsec_`)
3. Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_your_secret`
4. Restart server

### ".env file not found"

**Problem:** Running batch file from wrong directory

**Solution:**
1. Open Command Prompt
2. Navigate to project folder: `cd "C:\path\to\stock-proxy"`
3. Run batch file: `stripe-auto-setup.bat`

### "Webhook signature verification failed"

**Problem:** Webhook secret in `.env` doesn't match

**Solution:**
1. Run `run-stripe-webhook.bat`
2. Copy the displayed secret (whsec_...)
3. Update in `.env`: `STRIPE_WEBHOOK_SECRET=whsec_new_secret`
4. Restart server

---

## 📝 What Gets Added to .env

After running `stripe-auto-setup.bat`, your `.env` will have:

```env
# Stripe Payment Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_captured_secret_here  # ← Added by script
```

---

## 🎉 Success Indicators

### When setup is successful, you'll see:

**In auto-setup window:**
```
[OK] Webhook secret captured!
Secret: whsec_abc123...
[OK] Updated existing STRIPE_WEBHOOK_SECRET in .env
SUCCESS! Webhook secret has been saved to .env
```

**In webhook listener window:**
```
Ready! Your webhook signing secret is whsec_abc123...
```

**In server logs (npm start):**
```
✓ Stripe payment routes loaded successfully
```

**When testing payments:**
```
[200] POST /api/stripe/webhook [evt_xxx]
Stripe webhook received: payment_intent.succeeded
Payment succeeded for user: your-email@example.com
```

---

## 📞 Need Help?

If batch files don't work:
1. Check `QUICK_START_STRIPE.md` for manual setup
2. Check `STRIPE_WEBHOOK_SETUP.md` for detailed guide
3. Run commands manually:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

---

## 🔗 Quick Links

- **Test Cards:** https://stripe.com/docs/testing
- **Stripe CLI Docs:** https://stripe.com/docs/stripe-cli
- **Webhook Events:** https://stripe.com/docs/webhooks
- **Dashboard:** https://dashboard.stripe.com/test/webhooks

---

**Happy Testing! 🚀**
