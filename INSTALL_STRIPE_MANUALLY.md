# How to Install Stripe CLI (Manual Method)

Since the automatic download had issues, here's a simple manual method:

## Method 1: Direct Download (Easiest - 2 minutes)

### Step 1: Download Stripe CLI

Click this link to download:
👉 **https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_windows_x86_64.zip**

Or go to: https://github.com/stripe/stripe-cli/releases/latest
And download the file named: `stripe_*_windows_x86_64.zip`

### Step 2: Extract the ZIP file

1. Find the downloaded `stripe_1.19.5_windows_x86_64.zip` in your Downloads folder
2. Right-click on it
3. Select "Extract All..."
4. Extract to: `C:\stripe`

### Step 3: Add to PATH

**Option A - Quick Copy-Paste Method:**

1. Press `Windows + R`
2. Type: `sysdm.cpl` and press Enter
3. Click "Advanced" tab
4. Click "Environment Variables"
5. Under "User variables", find "Path" and click "Edit"
6. Click "New"
7. Add: `C:\stripe`
8. Click OK on all windows

**Option B - PowerShell Method (Run as Administrator):**

Open PowerShell as Administrator and run:
```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\stripe", "User")
```

### Step 4: Verify Installation

Close and reopen Command Prompt or PowerShell, then run:
```bash
stripe --version
```

You should see: `stripe version 1.19.5`

---

## Method 2: Using Winget (If you have Windows 10/11)

Open Command Prompt and run:
```bash
winget install stripe.stripe-cli
```

---

## After Installation

Once Stripe CLI is installed, run this command in your project folder:

```bash
cd "C:\Users\Ketan Joshi\Downloads\stock-proxy (2)\stock-proxy"
stripe-auto-setup.bat
```

Or just double-click: **stripe-auto-setup.bat**

---

## Can't Install? Use Alternative Method

If you can't install Stripe CLI, you can still test Stripe payments using the Stripe Dashboard:

### Testing Without CLI (For Now)

1. **Start your server:**
   ```bash
   npm start
   ```

2. **Test Free Trial:**
   - Go to: http://localhost:3000/pricing.html
   - Click "Start Free Trial"
   - This works without webhooks!

3. **Test Paid Plans (Webhook testing later):**
   - For now, you can test the checkout flow
   - Payment will create a payment intent in Stripe
   - We'll set up webhooks in production on Render

---

## Quick Test (No Stripe CLI Required)

You can test the basic flow without Stripe CLI:

1. Start your server:
   ```bash
   npm start
   ```

2. Visit: http://localhost:3000/pricing.html

3. Try the **FREE TRIAL**:
   - Click "Start Free Trial"
   - Should work immediately!
   - Check your database for the subscription

4. Try **Paid Plan** checkout flow:
   - Click "Get Started" on a paid plan
   - See the checkout page
   - Enter test card: 4242 4242 4242 4242
   - Payment will be created in Stripe

For full webhook testing, you'll need Stripe CLI, but the above will let you test most of the functionality!

---

## Need Help?

If you're stuck, let me know and I can:
1. Help with the manual installation
2. Set up testing without Stripe CLI
3. Configure webhooks directly in production (Render)
