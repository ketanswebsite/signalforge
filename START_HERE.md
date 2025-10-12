# 🚀 START HERE - Stripe Payment Setup

Welcome! Your Stripe payment system is ready. Follow this guide to get started.

---

## ⚡ Quick Start (Recommended)

### 1. Install Stripe CLI (One-time, 1 minute)

Open Command Prompt:
```bash
scoop install stripe
```

Don't have Scoop? Get it: https://scoop.sh or download Stripe CLI: https://github.com/stripe/stripe-cli/releases/latest

### 2. Run Automatic Setup (2 minutes)

**Just double-click this file:**
```
stripe-auto-setup.bat
```

It will:
- Login to Stripe (opens browser)
- Capture webhook secret automatically
- Update your .env file
- Show you what to do next

### 3. Start Testing (1 minute)

**Start your server:**
```bash
npm start
```

**Start webhook listener (double-click):**
```
run-stripe-webhook.bat
```

**Test payments:**
Go to: http://localhost:3000/pricing.html

Use test card: `4242 4242 4242 4242`

---

## 📚 Documentation Index

### 🎯 Guides

| File | Purpose | Read This When... |
|------|---------|-------------------|
| **STRIPE_SETUP_SUMMARY.md** | Complete overview | You want to understand everything |
| **QUICK_START_STRIPE.md** | 5-minute guide | You want to test quickly |
| **STRIPE_BATCH_FILES_GUIDE.md** | Batch files explained | You want to know what each .bat file does |
| **STRIPE_WEBHOOK_SETUP.md** | Detailed webhook guide | Auto-setup didn't work |

### 🔧 Batch Files (Windows)

| File | Purpose | When to Use |
|------|---------|-------------|
| **stripe-auto-setup.bat** ⭐ | Automatic setup | First time setup |
| **run-stripe-webhook.bat** 🔄 | Run webhook listener | Every time you test |
| **setup-stripe-webhook.bat** | Manual setup | If auto-setup fails |
| **setup-stripe-local.bat** | Basic setup | Troubleshooting |

---

## 🎬 Step-by-Step First Time Setup

### Step 1: Install Stripe CLI

Choose one method:

**Method A - Scoop (Easiest):**
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Method B - Direct Download:**
1. Go to: https://github.com/stripe/stripe-cli/releases/latest
2. Download: `stripe_X.X.X_windows_x86_64.zip`
3. Extract to `C:\stripe`
4. Add `C:\stripe` to PATH

Verify installation:
```bash
stripe --version
```

### Step 2: Run Auto-Setup

**Option A - Double-click:**
Find and double-click: `stripe-auto-setup.bat`

**Option B - Command line:**
```bash
cd "C:\path\to\your\project"
stripe-auto-setup.bat
```

**What will happen:**
1. Browser opens → Login to Stripe
2. Click "Allow access"
3. Script captures webhook secret
4. Updates .env automatically
5. Shows success message

### Step 3: Start Your Server

```bash
npm start
```

Look for:
```
✓ Stripe payment routes loaded successfully
```

### Step 4: Start Webhook Listener

**Double-click:** `run-stripe-webhook.bat`

Or run:
```bash
run-stripe-webhook.bat
```

**Keep this window open while testing!**

### Step 5: Test It!

1. Go to: http://localhost:3000/pricing.html
2. Click "Get Started" on any plan
3. Use test card details:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`
4. Click "Complete Subscription"
5. You should see success page!

### Step 6: Verify

Check your webhook listener window:
```
[200] POST /api/stripe/webhook [evt_xxx]
```

Check your server logs:
```
Stripe webhook received: payment_intent.succeeded
Payment succeeded for user: your-email@example.com
```

Check your database:
```sql
SELECT * FROM user_subscriptions ORDER BY created_at DESC LIMIT 1;
```

---

## 🎯 Daily Testing Workflow

Every time you want to test payments:

1. **Start server:**
   ```bash
   npm start
   ```

2. **Start webhook listener:**
   ```bash
   run-stripe-webhook.bat
   ```
   (Keep it running!)

3. **Test payments:**
   http://localhost:3000/pricing.html

4. **Stop when done:**
   Press Ctrl+C in webhook window

---

## 🆘 Troubleshooting

### "Stripe CLI not found"
```bash
# Install it
scoop install stripe

# Verify
stripe --version
```

### "Could not automatically capture secret"
Use manual method:
```bash
setup-stripe-webhook.bat
```
Then copy the secret manually to .env

### "Webhook signature verification failed"
1. Run: `run-stripe-webhook.bat`
2. Copy the secret shown (whsec_...)
3. Update .env: `STRIPE_WEBHOOK_SECRET=whsec_new_secret`
4. Restart server

### "Payment system not configured"
Check .env has these lines:
```env
STRIPE_SECRET_KEY=sk_test_51SHWX9P1ve4eSIfefPExh8st4drVUm1Xfb0wAwSMCGjRtmDXZXA8xdpxR6WJdWaT7xeb1zXtAIMMywdJ4w8YTk6j00vU5KmhIS
STRIPE_PUBLISHABLE_KEY=pk_test_51SHWX9P1ve4eSIfepRejVn1wVRBqxx2P455PhCyPnLU51MJTMcTOtiF8rNzf435hDrxIQG4FvOZFnAd4uKaoAXCp00kPBBPIZI
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

Restart server after adding/updating.

---

## 📖 Documentation Quick Links

### For Quick Testing
→ **QUICK_START_STRIPE.md**

### For Understanding Batch Files
→ **STRIPE_BATCH_FILES_GUIDE.md**

### For Complete Overview
→ **STRIPE_SETUP_SUMMARY.md**

### For Detailed Webhook Setup
→ **STRIPE_WEBHOOK_SETUP.md**

---

## 🎓 Test Card Numbers

```
✅ Success:                4242 4242 4242 4242
❌ Declined:               4000 0000 0000 0002
💰 Insufficient funds:     4000 0000 0000 9995
🔐 Requires 3D Secure:     4000 0025 0000 3155
```

All cards accept:
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC (e.g., 123)
- Any billing ZIP (e.g., 12345)

---

## ✅ Success Checklist

Use this to verify everything works:

- [ ] Stripe CLI installed and working
- [ ] Ran `stripe-auto-setup.bat` successfully
- [ ] Webhook secret added to .env
- [ ] Server starts without errors
- [ ] Webhook listener runs without errors
- [ ] Pricing page loads correctly
- [ ] Can complete free trial signup
- [ ] Can complete paid subscription with test card
- [ ] Webhook events appear in listener
- [ ] Subscription appears in database

---

## 🎉 You're Ready!

Everything is set up! Just follow these 3 steps:

1. **Run:** `stripe-auto-setup.bat`
2. **Start:** `npm start` and `run-stripe-webhook.bat`
3. **Test:** http://localhost:3000/pricing.html

---

## 🔗 Useful Links

- **Stripe Dashboard:** https://dashboard.stripe.com/test
- **Test Cards:** https://stripe.com/docs/testing
- **Stripe CLI Docs:** https://stripe.com/docs/stripe-cli
- **Webhooks Guide:** https://stripe.com/docs/webhooks

---

**Questions? Check the guides above or create an issue!**

**Happy Testing! 🚀**
