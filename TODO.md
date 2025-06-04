# Subscription System Implementation TODO

## Overview
This file tracks the implementation progress of the subscription system based on SUBSCRIPTION_PLAN.md. Each task is marked with its current status and any relevant notes.

## Task List

### Phase 1: Database and Core Backend (Week 1)

#### High Priority - Database Schema
- [x] **db-schema-1**: Create subscription_plans table with region-based pricing (IN: ₹1000, UK: £10) ✅
- [x] **db-schema-2**: Create user_subscriptions table with trial/active/expired status tracking ✅
- [x] **db-schema-3**: Create payment_transactions table for payment records and verification ✅
- [x] **db-schema-4**: Create payment_verification_queue table for admin approval workflow ✅
- [x] **db-schema-5**: Alter users table to add region, subscription_status, subscription_end_date, is_premium columns ✅

#### High Priority - Middleware
- [ ] **middleware-1**: Create ensureSubscriptionActive middleware to check subscription status
- [ ] **middleware-2**: Update existing routes to use subscription middleware for protected features

#### High Priority - Authentication Flow
- [ ] **auth-flow-1**: Modify user registration to auto-activate 15-day trial on signup
- [ ] **auth-flow-2**: Implement region detection/selection during registration (India/UK)

### Phase 2: Payment Flow (Week 2)

#### High Priority - Subscription APIs
- [ ] **api-subscription-1**: Create GET /api/subscription/status endpoint
- [ ] **api-subscription-2**: Create POST /api/subscription/upgrade endpoint
- [ ] **api-subscription-3**: Create GET /api/subscription/plans endpoint for region-based plans

#### High Priority - Payment APIs
- [ ] **api-payment-1**: Create POST /api/payment/submit endpoint for payment confirmation
- [ ] **api-payment-2**: Create GET /api/payment/history endpoint
- [ ] **api-payment-3**: Create GET /api/payment/qr/:region endpoint for QR codes

#### High Priority - Admin APIs
- [ ] **api-admin-1**: Create GET /api/admin/payments/pending for pending verifications
- [ ] **api-admin-2**: Create POST /api/admin/payments/verify/:id for approve/reject
- [ ] **api-admin-3**: Create admin subscription management endpoints

#### High Priority - QR Code Setup
- [ ] **qr-setup-1**: Create /public/qr/ directory and add UPI QR code for India (₹1000)
- [ ] **qr-setup-2**: Add Revolut QR code for UK (£10) to /public/qr/

### Phase 3: Frontend and UX (Week 3)

#### High Priority - Frontend Pages
- [ ] **frontend-1**: Create subscription status page (/subscription) with plan details
- [ ] **frontend-2**: Create payment page (/payment) with QR code display
- [ ] **frontend-3**: Create payment confirmation page with success message
- [ ] **frontend-4**: Create subscription expired page with renewal options

#### Medium Priority - UI Components
- [ ] **frontend-5**: Add trial banner component showing days remaining
- [ ] **frontend-6**: Update header to show subscription status indicator

#### High Priority - Admin Panel
- [ ] **admin-panel-1**: Create payment verification dashboard for admin
- [ ] **admin-panel-2**: Add subscription management section to admin panel
- [ ] **admin-panel-3**: Add revenue tracking and analytics to admin dashboard

#### Medium Priority - Email System
- [ ] **email-1**: Create email templates for trial started notification
- [ ] **email-2**: Create email templates for trial/subscription expiry reminders
- [ ] **email-3**: Create email templates for payment confirmation and approval
- [ ] **email-4**: Implement automated email scheduling system

### Phase 4: Testing and Polish (Week 4)

#### High Priority - Migration
- [x] **migration-1**: Create database migration scripts for new tables ✅
- [ ] **migration-2**: Create script to migrate existing users to trial subscriptions

#### Medium Priority - Security
- [ ] **security-1**: Implement secure file upload for payment proof screenshots
- [ ] **security-2**: Add audit logging for all subscription status changes

#### Medium Priority - Testing
- [ ] **testing-1**: Create end-to-end tests for subscription flow
- [ ] **testing-2**: Test payment verification workflow

#### Low Priority - Documentation
- [ ] **docs-1**: Document subscription system for users
- [ ] **docs-2**: Create admin guide for payment verification process

## Progress Notes

### Session 1 - [Current Date]
- Created TODO.md file to track implementation progress
- Ready to start with first task: Creating subscription_plans table
- Created migrations directory and 001_add_subscription_tables.js migration file
- Migration includes all 4 new tables and user table alterations
- Migration can be run with: `node migrations/001_add_subscription_tables.js up`
- Note: All database schema tasks (db-schema-1 to db-schema-5) are actually completed in the single migration file
- Updated deploy-to-render.bat to include migration instructions in post-deployment steps
- Created check-subscription-setup.html page for easy verification of subscription tables
- Added /api/check-subscription-setup endpoint to verify database setup
- Access the checker at: /check-subscription-setup.html

## Implementation Order
We'll follow this order for implementation:
1. Database schema changes (create all new tables first)
2. Update existing tables
3. Create middleware and update authentication
4. Build API endpoints
5. Create frontend pages
6. Add admin functionality
7. Implement email notifications
8. Testing and migration
9. Documentation

## Technical Notes
- Database: PostgreSQL on Render
- Authentication: Google OAuth 2.0
- Admin email: ketanjoshisahs@gmail.com
- Session duration: 24 hours
- Trial period: 15 days
- Subscription duration: 30 days