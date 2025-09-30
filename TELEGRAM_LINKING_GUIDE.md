# 🔗 OAuth-Telegram Account Linking System

## Overview

This system allows users to link their Google OAuth account with their Telegram account, enabling:
- Single subscription across both platforms
- Unified user management
- Alerts sent to both email and Telegram
- Future subscription payments tied to one account

---

## How It Works

### **For Users:**

1. **User logs in via Google OAuth** on your website
2. **Clicks "Link Telegram Account"** button
3. **Gets a unique deep link**: `https://t.me/MySignalForgeBot?start=link_XXXXXX`
4. **Clicks the link** → Opens Telegram
5. **Bot verifies token** and links the accounts
6. **User receives confirmation** on both platforms

---

## Database Schema

### **users table** (updated):
```sql
ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(100);
ALTER TABLE users ADD COLUMN telegram_username VARCHAR(100);
ALTER TABLE users ADD COLUMN linking_token VARCHAR(100);
ALTER TABLE users ADD COLUMN telegram_linked_at TIMESTAMP;
```

### **telegram_subscribers table**:
```sql
-- Already has user_id column
-- Will be populated with email when linked
```

---

## API Endpoints

### **1. Generate Linking Token**
```
POST /api/user/generate-telegram-link
Headers: Authentication required
Response: {
  success: true,
  token: "abc123...",
  deepLink: "https://t.me/MySignalForgeBot?start=link_abc123"
}
```

### **2. Check Linking Status**
```
GET /api/user/telegram-status
Headers: Authentication required
Response: {
  linked: true,
  chatId: "123456789",
  username: "johndoe",
  linkedAt: "2025-09-30T12:00:00Z"
}
```

### **3. Unlink Telegram**
```
POST /api/user/unlink-telegram
Headers: Authentication required
Response: {
  success: true
}
```

---

## Telegram Bot Commands

### **Deep Link Format:**
```
https://t.me/MySignalForgeBot?start=link_{TOKEN}
```

### **Bot Handler Logic:**
1. User sends `/start link_abc123`
2. Bot extracts token: `abc123`
3. Bot calls `TradeDB.linkTelegramToUser(token, telegramData)`
4. Database updates:
   - `users.telegram_chat_id = chatId`
   - `users.telegram_username = username`
   - `users.telegram_linked_at = NOW()`
   - `users.linking_token = NULL` (token consumed)
   - `telegram_subscribers.user_id = email`
5. Bot sends success message

---

## User Flow Diagram

```
┌─────────────────┐
│ User logs into  │
│ website via     │
│ Google OAuth    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Visits Settings │
│ or Profile Page │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Clicks "Link    │
│ Telegram" btn   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API generates   │
│ unique token    │
│ (abc123...)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Shows deep link │
│ or QR code      │
│ + "Open Telegram"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User clicks link│
│ Opens Telegram  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Bot receives    │
│ /start link_abc │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Bot validates   │
│ token in DB     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Accounts Linked!│
│ ✓ Telegram ID   │
│ ✓ OAuth email   │
│ ✓ Both in sync  │
└─────────────────┘
```

---

## Benefits

### **For You (Admin):**
- See which OAuth users have Telegram linked in admin portal
- Send subscription renewals to email + Telegram
- Track user engagement across platforms
- Prevent duplicate accounts

### **For Users:**
- One subscription, two platforms
- Get alerts on Telegram without separate signup
- Link/unlink anytime
- Seamless experience

---

## Security

- ✅ **Tokens are one-time use** (deleted after linking)
- ✅ **Tokens are random 32-char hex strings**
- ✅ **Links expire if user generates new token**
- ✅ **Requires authentication** to generate token
- ✅ **Bot validates token** before linking

---

## Admin Portal Integration

### **OAuth Users Table** now shows:
- Email
- Name
- Trades
- First/Last Login
- **Telegram Status** (Linked/Not Linked) ← NEW
- **Telegram Username** ← NEW

### **Updated Query:**
```javascript
GET /api/admin/users
// Returns:
{
  users: [
    {
      email: "user@example.com",
      name: "John Doe",
      trade_count: 5,
      telegram_chat_id: "123456789",  // If linked
      telegram_username: "johndoe",   // If linked
      telegram_linked_at: "2025-09-30T12:00:00Z"
    }
  ]
}
```

---

## Implementation Checklist

- [x] Database schema updated
- [x] Database helper functions added
- [x] Telegram bot handles link tokens
- [ ] API endpoints for linking (TODO)
- [ ] UI page for linking (TODO)
- [ ] Admin portal shows linked status (TODO)
- [ ] Documentation complete

---

## Next Steps (For Future Implementation)

### 1. **Create API Endpoints** (in server.js):
```javascript
// Generate linking token
app.post('/api/user/generate-telegram-link', ensureAuthenticatedAPI, async (req, res) => {
  const token = await TradeDB.generateLinkingToken(req.user.email);
  const deepLink = `https://t.me/MySignalForgeBot?start=link_${token}`;
  res.json({ success: true, token, deepLink });
});

// Check status
app.get('/api/user/telegram-status', ensureAuthenticatedAPI, async (req, res) => {
  const status = await TradeDB.getUserTelegramStatus(req.user.email);
  res.json(status);
});

// Unlink
app.post('/api/user/unlink-telegram', ensureAuthenticatedAPI, async (req, res) => {
  await TradeDB.unlinkTelegram(req.user.email);
  res.json({ success: true });
});
```

### 2. **Create Settings Page** (public/settings.html):
- Show current linking status
- "Link Telegram" button → generates token
- Display deep link with "Open Telegram" button
- Show QR code option
- "Unlink" button if already linked

### 3. **Update Admin Portal**:
- Add "Telegram" column to OAuth users table
- Show green checkmark if linked
- Show username if available

---

## Example User Messages

### **When Linking:**
```
🔗 Account Linked Successfully!

Hello John Doe!

Your Telegram account has been linked to your SignalForge account.

✅ You'll now receive:
• 📧 Alerts sent to your linked account
• 📱 Telegram notifications for all trades
• 🎯 Subscription benefits via both platforms

Email: john@example.com
Telegram: @johndoe
```

### **When Unlinked:**
```
Your Telegram account has been unlinked from john@example.com

You can re-link anytime from your account settings.
```

---

## Future: Subscription Integration

Once linked, you can:
1. **Check subscription status** via Telegram
2. **Send renewal reminders** to both email + Telegram
3. **Prevent double payments** (one account, one subscription)
4. **Allow users to manage subscription** from either platform

---

**Status:** Database + Telegram bot ready ✅
**Next:** API endpoints + UI (can be added anytime)
**Priority:** Medium (good foundation for future subscription system)