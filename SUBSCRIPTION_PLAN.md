# Subscription Feature Implementation Plan

## Overview
This document outlines the comprehensive plan to add a subscription-based payment system to the existing stock trading application. The system will support regional pricing (India: ₹1000/month, UK: £10/month) with QR code payments and admin approval workflow.

## Current System Analysis

### Existing Infrastructure
- **Authentication**: Google OAuth 2.0 with session management
- **Database**: PostgreSQL on Render
- **User Management**: Basic user roles (admin/regular users)
- **Admin Email**: `ketanjoshisahs@gmail.com` (hardcoded)
- **Session Storage**: SQLite-based sessions with 24-hour duration

### Current Database Schema
```sql
-- Existing users table
users (id, email, name, google_id, picture, first_login, last_login, created_at)
trades (user_id, ...)
alert_preferences (user_id, ...)
```

## Subscription System Architecture

### 1. Database Schema Changes

#### New Tables Required:

```sql
-- Subscription plans table
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    region VARCHAR(10) NOT NULL, -- 'IN' for India, 'UK' for UK
    price_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL, -- 'INR' or 'GBP'
    duration_days INTEGER NOT NULL DEFAULT 30,
    trial_days INTEGER NOT NULL DEFAULT 15,
    qr_code_image_url VARCHAR(500),
    payment_instructions TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions table
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    plan_id INTEGER REFERENCES subscription_plans(id),
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'expired', 'cancelled'
    trial_start_date TIMESTAMP,
    trial_end_date TIMESTAMP,
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(email)
);

-- Payment transactions table
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    subscription_id INTEGER REFERENCES user_subscriptions(id),
    transaction_id VARCHAR(100) UNIQUE, -- UTR/Transaction reference
    payment_method VARCHAR(50), -- 'UPI', 'REVOLUT', etc.
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    payment_proof_url VARCHAR(500), -- Optional: uploaded screenshot
    payment_date TIMESTAMP,
    verification_date TIMESTAMP,
    verified_by VARCHAR(255), -- Admin email who verified
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(email)
);

-- Payment verification queue for admin
CREATE TABLE payment_verification_queue (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES payment_transactions(id),
    user_email VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_notes TEXT
);
```

#### Modify Existing Tables:

```sql
-- Add subscription-related fields to users table
ALTER TABLE users ADD COLUMN region VARCHAR(10) DEFAULT 'IN'; -- Auto-detect or user selects
ALTER TABLE users ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'trial';
ALTER TABLE users ADD COLUMN subscription_end_date TIMESTAMP;
ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT false;
```

### 2. User Registration Flow Enhancement

#### Current Flow:
1. Google OAuth → User created → Dashboard access

#### New Flow:
1. Google OAuth → User created with 15-day trial
2. Region detection/selection (India/UK)
3. Automatic trial subscription activation
4. Dashboard access with trial banner
5. Payment reminder 3 days before trial expiry

### 3. Payment Workflow

#### For India (UPI):
1. User selects "Upgrade to Premium"
2. Shows UPI QR code for ₹1000
3. User scans and pays
4. User submits payment confirmation (UTR number + optional screenshot)
5. Payment added to admin verification queue
6. Admin verifies payment manually
7. Subscription activated for 30 days

#### For UK (Revolut):
1. User selects "Upgrade to Premium"
2. Shows Revolut QR code for £10
3. User scans and pays
4. User submits payment confirmation (Transaction ID + optional screenshot)
5. Payment added to admin verification queue
6. Admin verifies payment manually
7. Subscription activated for 30 days

### 4. Access Control Implementation

#### Middleware Enhancement:
```javascript
// New middleware: ensureSubscriptionActive
function ensureSubscriptionActive(req, res, next) {
    if (!req.user) {
        return res.redirect('/login');
    }
    
    // Check if user has active subscription or trial
    const now = new Date();
    if (req.user.subscription_end_date && now > req.user.subscription_end_date) {
        return res.redirect('/subscription/expired');
    }
    
    next();
}
```

#### Protected Features:
- All trading functionality
- Data export/import
- Advanced charts
- ML insights
- Alert systems

#### Free/Trial Features:
- Basic portfolio view (read-only)
- Payment page
- Profile management

### 5. Admin Panel Enhancements

#### New Admin Features:
1. **Payment Verification Dashboard**
   - Queue of pending payments
   - User details and payment proof
   - Approve/Reject buttons
   - Payment history

2. **Subscription Management**
   - View all user subscriptions
   - Manual subscription extension
   - Subscription analytics
   - Revenue tracking

3. **User Management**
   - Force trial extension
   - Manual premium activation
   - User activity tracking

### 6. Frontend Implementation

#### New Pages Required:

1. **Subscription Status Page** (`/subscription`)
   - Current plan details
   - Renewal date
   - Payment history
   - Upgrade options

2. **Payment Page** (`/payment`)
   - QR code display based on region
   - Payment instructions
   - Payment confirmation form
   - Transaction ID submission

3. **Payment Confirmation** (`/payment/confirm`)
   - Success message
   - Verification timeline
   - Contact admin option

4. **Subscription Expired** (`/subscription/expired`)
   - Expired notice
   - Renew subscription button
   - Limited functionality explanation

#### UI Enhancements:

1. **Trial Banner**
   - Days remaining in trial
   - Upgrade prompt
   - Progress bar

2. **Payment Status Indicator**
   - Subscription status in header
   - Payment verification status
   - Renewal reminders

### 7. API Endpoints

#### Subscription Management:
```
GET /api/subscription/status - Get user subscription details
POST /api/subscription/upgrade - Initiate upgrade process
GET /api/subscription/plans - Get available plans by region

POST /api/payment/submit - Submit payment confirmation
GET /api/payment/history - Get user payment history
GET /api/payment/qr/:region - Get QR code for region
```

#### Admin APIs:
```
GET /api/admin/payments/pending - Get pending verifications
POST /api/admin/payments/verify/:id - Approve/reject payment
GET /api/admin/subscriptions - Get all user subscriptions
POST /api/admin/subscription/extend/:userId - Manual extension
GET /api/admin/revenue/stats - Revenue analytics
```

### 8. Email/Notification System

#### Automated Notifications:
1. **Trial Started** - Welcome email with trial details
2. **Trial Expiring** - 3 days before expiry reminder
3. **Trial Expired** - Payment required notice
4. **Payment Submitted** - Confirmation of payment submission
5. **Payment Approved** - Subscription activated notice
6. **Subscription Expiring** - Renewal reminder (3 days before)
7. **Subscription Expired** - Renewal required notice

#### Implementation:
- Use existing email system or integrate with SendGrid/AWS SES
- Email templates for each notification type
- Automated scheduling for reminder emails

### 9. Security Considerations

#### Payment Security:
- No actual payment processing (QR code based)
- Secure storage of payment proofs
- Admin-only verification access
- Transaction ID validation

#### Data Protection:
- Payment data encryption at rest
- Secure file uploads for payment proofs
- Audit trail for all subscription changes
- GDPR compliance for payment data

### 10. Monitoring and Analytics

#### Metrics to Track:
- Trial conversion rates
- Payment verification times
- Revenue by region
- Subscription churn rates
- User engagement by subscription status

#### Implementation:
- Database views for analytics
- Admin dashboard with charts
- Export capabilities for financial reporting

## Implementation Phases

### Phase 1: Database and Core Backend (Week 1)
- Create new database tables
- Implement subscription middleware
- Basic subscription status tracking
- Admin verification APIs

### Phase 2: Payment Flow (Week 2)
- QR code integration
- Payment submission forms
- Admin verification dashboard
- Email notifications

### Phase 3: Frontend and UX (Week 3)
- Subscription status UI
- Payment pages
- Trial banners
- Admin panel enhancements

### Phase 4: Testing and Polish (Week 4)
- End-to-end testing
- Security audit
- Performance optimization
- Documentation

## Technical Considerations

### Region Detection:
```javascript
// Auto-detect region based on IP or let user choose
function detectUserRegion(req) {
    // Use IP geolocation or manual selection
    // Default to 'IN' for India
    return req.headers['cf-ipcountry'] || 'IN';
}
```

### QR Code Management:
- Store QR code images in `/public/qr/` directory
- Different QR codes for different amounts
- Admin can update QR codes through interface

### Payment Verification:
- Manual process initially
- Potential for API integration later (UPI/bank APIs)
- Screenshot upload for payment proof
- UTR/Transaction ID validation

## Migration Strategy

### Database Migration:
1. Run migration scripts to add new tables
2. Update existing users with trial subscriptions
3. Set trial end dates (15 days from registration)
4. Migrate admin user to new permission system

### Code Deployment:
1. Deploy new authentication middleware
2. Add subscription checks to protected routes
3. Deploy new UI components gradually
4. Monitor for any access issues

## Cost Implications

### Development Time: ~3-4 weeks
### Infrastructure Costs:
- PostgreSQL storage increase (minimal)
- Image storage for QR codes and payment proofs
- Email service costs (if using external provider)

### Revenue Projections:
- India: ₹1000/month per user
- UK: £10/month per user
- Break-even point depends on user acquisition

## Risk Mitigation

### Technical Risks:
- Database migration issues → Test on staging first
- Authentication conflicts → Gradual rollout
- Payment verification bottlenecks → Admin queue management

### Business Risks:
- Low conversion rates → A/B testing pricing
- Manual verification scaling → Future automation
- Regional compliance → Legal review

## Success Metrics

### Technical KPIs:
- Zero downtime during migration
- <2 second page load times
- 99.9% authentication uptime

### Business KPIs:
- >15% trial to paid conversion
- <24 hour payment verification time
- >80% subscription renewal rate

---

This plan provides a comprehensive roadmap for implementing a subscription system that leverages the existing authentication infrastructure while adding robust payment management and admin controls.