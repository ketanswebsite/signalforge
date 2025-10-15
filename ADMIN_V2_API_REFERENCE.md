# Admin Portal V2 - API Reference

**Document Version:** 1.0
**Created:** 2025-10-15
**Status:** 📚 Complete
**Base URL:** `/api/admin`

---

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Dashboard](#dashboard)
4. [User Management](#user-management)
5. [Subscription Management](#subscription-management)
6. [Payment Management](#payment-management)
7. [Audit Logs](#audit-logs)
8. [Analytics](#analytics)
9. [Database Tools](#database-tools)
10. [Settings](#settings)
11. [System](#system)
12. [Error Codes](#error-codes)
13. [Rate Limits](#rate-limits)

---

## Introduction

### API Overview

The Admin Portal API provides comprehensive access to administrative functions including user management, subscriptions, payments, analytics, and system configuration.

**Total Endpoints:** 71
- GET: 44 endpoints
- POST: 21 endpoints
- PUT: 3 endpoints
- DELETE: 3 endpoints

### Base URL

```
Development: http://localhost:3000/api/admin
Production: https://sutralgo.com/api/admin
```

### Request Format

All requests should include:
- `Content-Type: application/json` for POST/PUT requests
- Authentication token in header or session cookie

### Response Format

All responses follow this standard format:

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  }
}
```

### Implementation Status

- ✅ **Implemented** - Fully functional
- ⚠️ **Partial** - Basic implementation, needs enhancement
- 🔴 **Placeholder** - Returns placeholder data, needs implementation

---

## Authentication

### POST /auth/token
Generate authentication token for API access.

**Status:** ✅ Implemented

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "8h",
    "user": {
      "email": "admin@example.com",
      "role": "admin",
      "permissions": ["users.read", "users.write", ...]
    }
  }
}
```

---

### POST /auth/verify
Verify authentication token.

**Status:** ✅ Implemented

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

---

## Dashboard

### GET /dashboard/metrics
Retrieve dashboard metrics (MRR, users, subscriptions, payments).

**Status:** ✅ Implemented

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "mrr": 25000.00,
    "totalUsers": 1250,
    "activeSubscriptions": 450,
    "totalTrades": 8750,
    "paymentsThisMonth": 125,
    "changes": {
      "mrr": "+12%",
      "users": "+45",
      "subscriptions": "+12",
      "payments": "+8"
    }
  }
}
```

**Notes:**
- Metrics calculated from database in real-time
- Changes calculated vs previous period
- Cached for 5 minutes

---

### GET /events
Server-Sent Events stream for real-time updates.

**Status:** ✅ Implemented

**Response:** SSE stream

**Event Types:**
- `connected` - Initial connection
- `activity` - New activity log entry
- `metrics` - Updated metrics
- `heartbeat` - Keep-alive ping (every 30s)

**Example Events:**
```
event: connected
data: {"message": "Connected to admin events"}

event: metrics
data: {"mrr": 25100, "totalUsers": 1251}

event: activity
data: {"type": "user_created", "user": "new@example.com"}

event: heartbeat
data: {"timestamp": 1697452800}
```

---

## User Management

### GET /users
List all users with pagination and filtering.

**Status:** ✅ Implemented

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50) - Items per page
- `search` (string, optional) - Search by email or name
- `filter` (string, optional) - Filter by status: `all`, `active`, `telegram`, `oauth`
- `sort` (string, default: `first_login`) - Sort field
- `order` (string, default: `desc`) - Sort order: `asc`, `desc`

**Example Request:**
```
GET /api/admin/users?page=1&limit=50&search=john&filter=active
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "email": "john@example.com",
        "name": "John Doe",
        "first_login": "2024-01-15T10:30:00Z",
        "last_login": "2024-10-15T14:22:00Z",
        "telegram_chat_id": "123456789"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1250,
      "pages": 25
    }
  }
}
```

---

### GET /users/:email
Get single user details.

**Status:** ✅ Implemented

**Parameters:**
- `email` (path, required) - User email address

**Example Request:**
```
GET /api/admin/users/john@example.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "john@example.com",
    "name": "John Doe",
    "first_login": "2024-01-15T10:30:00Z",
    "last_login": "2024-10-15T14:22:00Z",
    "telegram_chat_id": "123456789",
    "is_complimentary": false,
    "complimentary_until": null,
    "complimentary_reason": null
  }
}
```

**Error Responses:**
- `404 USER_NOT_FOUND` - User with email not found

---

### POST /users
Create new user.

**Status:** ✅ Implemented

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "New User"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "newuser@example.com",
    "name": "New User",
    "first_login": "2024-10-15T15:00:00Z",
    "last_login": "2024-10-15T15:00:00Z"
  },
  "message": "User created successfully"
}
```

**Validation:**
- `email` (required, valid email format)
- `name` (required, 2-100 characters)

---

### PUT /users/:email
Update user information.

**Status:** ✅ Implemented

**Parameters:**
- `email` (path, required) - User email address

**Request:**
```json
{
  "name": "Updated Name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "john@example.com",
    "name": "Updated Name",
    "first_login": "2024-01-15T10:30:00Z",
    "last_login": "2024-10-15T14:22:00Z"
  },
  "message": "User updated successfully"
}
```

**Validation:**
- `name` (required, 2-100 characters)

---

### DELETE /users/:email
Delete user.

**Status:** ✅ Implemented

**Parameters:**
- `email` (path, required) - User email address

**Example Request:**
```
DELETE /api/admin/users/john@example.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "john@example.com"
  },
  "message": "User deleted successfully"
}
```

**Notes:**
- Cascades to delete related subscriptions, payments, etc.
- Creates audit log entry
- Cannot be undone

---

### POST /users/:email/grant-access
Grant complimentary access to user.

**Status:** ✅ Implemented

**Parameters:**
- `email` (path, required) - User email address

**Request:**
```json
{
  "type": "lifetime",
  "expiresAt": null,
  "reason": "VIP customer, lifetime access granted"
}
```

Or for temporary access:
```json
{
  "type": "temporary",
  "expiresAt": "2024-12-31T23:59:59Z",
  "reason": "Beta tester, 3 months free access"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "john@example.com",
    "is_complimentary": true,
    "complimentary_until": null,
    "complimentary_reason": "VIP customer, lifetime access granted",
    "granted_by": "admin@example.com",
    "granted_at": "2024-10-15T15:30:00Z"
  },
  "message": "Complimentary access granted successfully"
}
```

**Validation:**
- `type` (required) - Either `lifetime` or `temporary`
- `expiresAt` (required if type=temporary) - ISO 8601 date
- `reason` (required) - Reason for granting access

---

### POST /users/:email/revoke-access
Revoke complimentary access.

**Status:** ✅ Implemented

**Parameters:**
- `email` (path, required) - User email address

**Request:**
```json
{
  "reason": "Trial period ended"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "john@example.com",
    "is_complimentary": false,
    "complimentary_until": null
  },
  "message": "Complimentary access revoked successfully"
}
```

---

### GET /users/complimentary
List all users with complimentary access.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "email": "vip@example.com",
        "name": "VIP User",
        "is_complimentary": true,
        "complimentary_until": null,
        "complimentary_reason": "Lifetime VIP",
        "granted_by": "admin@example.com",
        "granted_at": "2024-01-15T10:00:00Z",
        "status": "lifetime"
      },
      {
        "email": "beta@example.com",
        "name": "Beta Tester",
        "is_complimentary": true,
        "complimentary_until": "2024-12-31T23:59:59Z",
        "complimentary_reason": "Beta tester",
        "granted_by": "admin@example.com",
        "granted_at": "2024-09-01T10:00:00Z",
        "status": "active"
      }
    ]
  }
}
```

**Status Values:**
- `lifetime` - No expiration
- `active` - Temporary, not yet expired
- `expired` - Temporary, already expired

---

## Subscription Management

### GET /subscription-plans
List all subscription plans.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": 1,
        "plan_name": "Pro Monthly",
        "plan_code": "pro_monthly_gbp",
        "region": "UK",
        "currency": "GBP",
        "price_monthly": 29.99,
        "trial_days": 7,
        "is_active": true,
        "created_at": "2024-01-01T00:00:00Z",
        "subscriber_count": 450
      }
    ]
  }
}
```

---

### POST /subscription-plans
Create new subscription plan.

**Status:** ✅ Implemented

**Request:**
```json
{
  "plan_name": "Pro Monthly",
  "plan_code": "pro_monthly_gbp",
  "region": "UK",
  "currency": "GBP",
  "price_monthly": 29.99,
  "trial_days": 7
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "plan_name": "Pro Monthly",
    "plan_code": "pro_monthly_gbp",
    "region": "UK",
    "currency": "GBP",
    "price_monthly": 29.99,
    "trial_days": 7,
    "is_active": true,
    "created_at": "2024-10-15T15:45:00Z"
  },
  "message": "Plan created successfully"
}
```

---

### PUT /subscription-plans/:id
Update subscription plan.

**Status:** ✅ Implemented

**Parameters:**
- `id` (path, required) - Plan ID

**Request:**
```json
{
  "plan_name": "Pro Monthly Updated",
  "price_monthly": 34.99,
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "plan_name": "Pro Monthly Updated",
    "price_monthly": 34.99,
    "is_active": true
  },
  "message": "Plan updated successfully"
}
```

**Notes:**
- Only specified fields are updated
- Price changes don't affect existing subscriptions

---

### DELETE /subscription-plans/:id
Delete subscription plan.

**Status:** ✅ Implemented

**Parameters:**
- `id` (path, required) - Plan ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5
  },
  "message": "Plan deleted successfully"
}
```

**Error Responses:**
- `409 CONFLICT` - Cannot delete plan with active subscriptions

---

### GET /subscriptions
List all subscriptions with filtering.

**Status:** ✅ Implemented

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50) - Items per page
- `status` (string, optional) - Filter by status: `active`, `cancelled`, `trial`, `expired`

**Example Request:**
```
GET /api/admin/subscriptions?page=1&limit=50&status=active
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 123,
        "user_email": "john@example.com",
        "plan_id": 1,
        "plan_name": "Pro Monthly",
        "status": "active",
        "trial_end_date": "2024-01-22T10:30:00Z",
        "start_date": "2024-01-15T10:30:00Z",
        "end_date": null,
        "created_at": "2024-01-15T10:30:00Z",
        "currency": "GBP",
        "price_monthly": 29.99
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 450,
      "pages": 9
    }
  }
}
```

---

### POST /subscriptions/:id/cancel
Cancel subscription.

**Status:** ✅ Implemented

**Parameters:**
- `id` (path, required) - Subscription ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "cancelled",
    "end_date": "2024-10-15T16:00:00Z"
  },
  "message": "Subscription cancelled successfully"
}
```

---

### POST /subscriptions/:id/extend
Extend subscription duration.

**Status:** ✅ Implemented

**Parameters:**
- `id` (path, required) - Subscription ID

**Request:**
```json
{
  "days": 30,
  "reason": "Customer service extension due to issue"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "end_date": "2024-11-14T23:59:59Z",
    "notes": "2024-10-15: Extended by 30 days - Customer service extension due to issue"
  },
  "message": "Subscription extended by 30 days"
}
```

---

### GET /subscription-analytics
Get subscription analytics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "mrr": 13495.50,
    "arr": 161946.00,
    "churn_rate": "3.2",
    "avg_ltv": "421.73",
    "mrr_change": "+12%",
    "arr_change": "+12%",
    "churn_change": "-2%",
    "ltv_change": "+15%",
    "growth": [
      {"month": "Jan", "count": 35},
      {"month": "Feb", "count": 42},
      {"month": "Mar", "count": 48}
    ]
  }
}
```

**Metrics:**
- `mrr` - Monthly Recurring Revenue
- `arr` - Annual Recurring Revenue (MRR × 12)
- `churn_rate` - Percentage of cancelled subscriptions (last 30 days)
- `avg_ltv` - Average Lifetime Value per customer

---

## Payment Management

### GET /payments
List all payment transactions.

**Status:** ✅ Implemented

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50) - Items per page
- `status` (string, optional) - Filter by status: `all`, `completed`, `pending`, `failed`, `refunded`
- `provider` (string, optional) - Filter by provider: `all`, `stripe`, `paypal`, `razorpay`

**Example Request:**
```
GET /api/admin/payments?page=1&limit=50&status=completed&provider=stripe
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "transaction_id": "pi_1234567890",
        "user_email": "john@example.com",
        "amount": 29.99,
        "currency": "GBP",
        "status": "completed",
        "payment_provider": "stripe",
        "payment_method": "card",
        "description": "Pro Monthly subscription",
        "created_at": "2024-10-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2500,
      "pages": 50
    }
  }
}
```

---

### GET /payments/verification-queue
Get payments pending verification.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "queue": [
      {
        "id": 45,
        "transaction_id": "pay_abc123",
        "amount": 29.99,
        "currency": "GBP",
        "payment_provider": "paypal",
        "user_email": "john@example.com",
        "verification_status": "pending",
        "created_at": "2024-10-15T09:00:00Z"
      }
    ]
  }
}
```

---

### GET /payments/refunds
List all refunds.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "refunds": [
      {
        "id": 12,
        "transaction_id": "pi_1234567890",
        "user_email": "john@example.com",
        "refund_amount": 29.99,
        "currency": "GBP",
        "refund_reason": "Customer request",
        "status": "completed",
        "created_at": "2024-10-10T14:30:00Z"
      }
    ]
  }
}
```

---

### GET /payments/:transactionId
Get single payment details.

**Status:** ✅ Implemented

**Parameters:**
- `transactionId` (path, required) - Payment transaction ID

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "pi_1234567890",
    "user_email": "john@example.com",
    "amount": 29.99,
    "currency": "GBP",
    "status": "completed",
    "payment_provider": "stripe",
    "payment_method": "card",
    "description": "Pro Monthly subscription",
    "metadata": {},
    "created_at": "2024-10-15T10:30:00Z"
  }
}
```

---

### POST /payments/:transactionId/verify
Verify pending payment.

**Status:** ✅ Implemented

**Parameters:**
- `transactionId` (path, required) - Payment transaction ID

**Request:**
```json
{
  "approved": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "pay_abc123",
    "approved": true,
    "status": "completed"
  },
  "message": "Payment approved successfully"
}
```

---

### POST /payments/:transactionId/refund
Process refund for payment.

**Status:** ✅ Implemented

**Parameters:**
- `transactionId` (path, required) - Payment transaction ID

**Request:**
```json
{
  "reason": "Customer requested refund due to service issue"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "pi_1234567890",
    "refundAmount": 29.99
  },
  "message": "Refund processed successfully"
}
```

**Error Responses:**
- `404 NOT_FOUND` - Payment not found
- `400 INVALID_STATE` - Can only refund completed payments

---

### GET /payment-analytics
Get payment analytics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 74985.50,
    "totalTransactions": 2500,
    "successRate": "94.5",
    "refundRate": "2.3",
    "revenueChange": "+15%",
    "transactionChange": "+23",
    "successRateChange": "+2%",
    "refundRateChange": "-1%",
    "byProvider": [
      {"provider": "stripe", "revenue": 52489.85, "count": 1750},
      {"provider": "paypal", "revenue": 14996.50, "count": 500},
      {"provider": "razorpay", "revenue": 7499.15, "count": 250}
    ],
    "successRate": [
      {"date": "Mon", "rate": 93.2},
      {"date": "Tue", "rate": 94.5},
      {"date": "Wed", "rate": 95.1}
    ]
  }
}
```

---

## Audit Logs

### GET /audit/logs
Get audit logs (simplified endpoint, no auth required temporarily).

**Status:** ⚠️ Partial (temporary, needs proper implementation)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": []
  },
  "message": "Operation successful"
}
```

**Notes:**
- Temporary endpoint without authentication
- Returns empty array
- Use `/audit/unified` for full functionality

---

### GET /audit/unified
Get unified audit log with advanced filtering.

**Status:** ✅ Implemented

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50) - Items per page
- `entity` (string, optional) - Filter by entity type: `user`, `subscription`, `payment`, etc.
- `action` (string, optional) - Filter by action: `create`, `update`, `delete`, etc.
- `user` (string, optional) - Filter by user email (partial match)
- `dateFrom` (string, optional) - Start date (ISO 8601)
- `dateTo` (string, optional) - End date (ISO 8601)
- `search` (string, optional) - Full-text search

**Example Request:**
```
GET /api/admin/audit/unified?entity=user&action=delete&dateFrom=2024-10-01T00:00:00Z
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 12345,
        "entity_type": "user",
        "entity_id": "john@example.com",
        "action": "delete",
        "user_email": "admin@example.com",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2024-10-15T14:30:00Z",
        "changes": {"email": "john@example.com", "name": "John Doe"},
        "old_data": {"status": "active"},
        "new_data": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15000,
      "pages": 300
    }
  }
}
```

---

### GET /audit/analytics
Get audit log analytics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "mostActiveUsers": [
      {"user_email": "admin@example.com", "action_count": 245},
      {"user_email": "support@example.com", "action_count": 187}
    ],
    "actionDistribution": {
      "create": 450,
      "update": 780,
      "delete": 125,
      "login": 1250
    },
    "totalActions": 2605,
    "last24Hours": 145
  }
}
```

---

### GET /audit/export
Export audit logs.

**Status:** ✅ Implemented

**Query Parameters:**
- `format` (string, default: `csv`) - Export format: `csv` or `json`
- `entity` (string, optional) - Filter by entity type
- `action` (string, optional) - Filter by action
- `user` (string, optional) - Filter by user email
- `dateFrom` (string, optional) - Start date
- `dateTo` (string, optional) - End date

**Example Request:**
```
GET /api/admin/audit/export?format=csv&entity=user&dateFrom=2024-10-01T00:00:00Z
```

**Response:** CSV file download
```csv
ID,Timestamp,Entity Type,Entity ID,Action,User Email,IP Address
12345,2024-10-15T14:30:00Z,user,john@example.com,delete,admin@example.com,192.168.1.1
```

**Limits:**
- Maximum 10,000 records per export

---

### GET /audit/statistics
Get audit statistics for date range.

**Status:** ✅ Implemented

**Query Parameters:**
- `startDate` (string, optional) - Start date (default: 30 days ago)
- `endDate` (string, optional) - End date (default: now)

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalActions": 2605,
      "uniqueUsers": 15,
      "mostCommonAction": "update",
      "mostActiveDay": "2024-10-15",
      "actionsPerDay": 86.83
    }
  }
}
```

---

### GET /audit/:id
Get specific audit log entry.

**Status:** ✅ Implemented

**Parameters:**
- `id` (path, required) - Audit log entry ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "entity_type": "user",
    "entity_id": "john@example.com",
    "action": "update",
    "user_email": "admin@example.com",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2024-10-15T14:30:00Z",
    "changes": {
      "name": {"old": "John", "new": "John Doe"}
    },
    "old_data": {"name": "John", "email": "john@example.com"},
    "new_data": {"name": "John Doe", "email": "john@example.com"}
  }
}
```

---

### GET /audit/:id/export
Export single audit log entry.

**Status:** ✅ Implemented

**Parameters:**
- `id` (path, required) - Audit log entry ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "entity_type": "user",
    "entity_id": "john@example.com",
    "action": "update",
    "user_email": "admin@example.com",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2024-10-15T14:30:00Z",
    "changes": {...},
    "old_data": {...},
    "new_data": {...}
  }
}
```

---

## Analytics

### GET /analytics/revenue
Get revenue analytics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "mrr": 13495.50,
    "arr": 161946.00,
    "arpu": 29.99,
    "ltv": 421.73,
    "mrrGrowth": 12,
    "byRegion": {
      "UK": 8097.30,
      "US": 4048.65,
      "India": 1349.55
    },
    "byPlan": {
      "Pro Monthly": 8097.30,
      "Basic Monthly": 5398.20
    },
    "trend": [
      {"month": "Jan 2024", "revenue": 11250.00},
      {"month": "Feb 2024", "revenue": 11875.50},
      {"month": "Mar 2024", "revenue": 12456.75}
    ]
  }
}
```

---

### GET /analytics/engagement
Get user engagement analytics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "dau": 145,
    "wau": 487,
    "mau": 1085,
    "inactive": 165,
    "wauGrowth": 7.6,
    "mauGrowth": 12.2,
    "featureUsage": {
      "Trade Management": 89,
      "Analytics": 67,
      "Export": 45,
      "ML Insights": 23
    },
    "activityTrend": [
      {"date": "2024-10-01", "active_users": 132},
      {"date": "2024-10-02", "active_users": 145},
      {"date": "2024-10-03", "active_users": 138}
    ]
  }
}
```

**Metrics:**
- `dau` - Daily Active Users (logged in today)
- `wau` - Weekly Active Users (logged in last 7 days)
- `mau` - Monthly Active Users (logged in last 30 days)
- `inactive` - Users inactive for 30+ days

---

### GET /analytics/subscriptions
Get subscription health analytics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "trialConversion": 68.5,
    "churnRate": 3.2,
    "upgrades": 12,
    "downgrades": 3,
    "funnel": {
      "signups": 1250,
      "trialStarted": 450,
      "profileCompleted": 396,
      "converted": 308
    },
    "ageDistribution": {
      "0-30 days": 85,
      "31-90 days": 123,
      "91-180 days": 97,
      "180+ days": 145
    }
  }
}
```

---

### GET /analytics/trades
Get trading activity analytics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTrades": 8750,
    "winRate": 64.5,
    "winningTrades": 5644,
    "avgPL": 2.35,
    "avgTradesPerUser": 7.0,
    "topSymbols": [
      {
        "symbol": "RELIANCE",
        "count": 450,
        "win_rate": 67.8,
        "avg_pl": 3.25
      },
      {
        "symbol": "TCS",
        "count": 385,
        "win_rate": 62.3,
        "avg_pl": 2.15
      }
    ]
  }
}
```

---

### POST /analytics/reports
Generate custom report.

**Status:** 🔴 Placeholder

**Request:**
```json
{
  "type": "revenue",
  "period": "last_30_days",
  "format": "pdf",
  "email": "admin@example.com",
  "sections": ["summary", "charts", "breakdown"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Report generation started",
    "type": "revenue",
    "period": "last_30_days",
    "format": "pdf",
    "email": "admin@example.com",
    "sections": ["summary", "charts", "breakdown"],
    "status": "processing"
  }
}
```

**Notes:**
- Currently returns placeholder
- Needs actual report generation implementation

---

### GET /analytics/overview
Get analytics overview.

**Status:** 🔴 Placeholder

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Analytics coming soon"
  }
}
```

---

## Database Tools

### GET /database/health
Get database health metrics.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "latency": 45,
    "databaseSize": 52428800,
    "activeConnections": 8,
    "maxConnections": 100,
    "uptime": 86400.5,
    "tables": [
      {
        "schemaname": "public",
        "tablename": "users",
        "size": "1024 kB",
        "row_count": 1250,
        "indexes": 3
      }
    ]
  }
}
```

---

### GET /database/status
Get database status (legacy endpoint).

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "database": {
      "size": 52428800,
      "activeConnections": 8
    },
    "tables": [
      {
        "schemaname": "public",
        "tablename": "users",
        "size": "1024 kB",
        "row_count": 1250
      }
    ]
  }
}
```

---

### GET /database/migrations
List database migrations.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "applied": [
      {
        "filename": "001_initial_schema.sql",
        "applied_at": "2024-01-01T00:00:00Z"
      },
      {
        "filename": "002_add_subscriptions.sql",
        "applied_at": "2024-02-01T00:00:00Z"
      }
    ],
    "pending": [
      "003_add_audit_log.sql",
      "004_add_payments.sql"
    ],
    "lastMigration": "002_add_subscriptions.sql"
  }
}
```

---

### POST /database/migrations/run
Run pending migrations.

**Status:** 🔴 Placeholder

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Migrations feature coming soon",
    "status": "pending"
  }
}
```

---

### POST /database/migrations/run-single
Run single migration.

**Status:** 🔴 Placeholder

**Request:**
```json
{
  "filename": "003_add_audit_log.sql"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Migration 003_add_audit_log.sql feature coming soon",
    "status": "pending"
  }
}
```

---

### GET /database/backups
List database backups.

**Status:** 🔴 Placeholder

**Response:**
```json
{
  "success": true,
  "data": {
    "backups": []
  }
}
```

---

### POST /database/backups/create
Create database backup.

**Status:** 🔴 Placeholder

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Backup created",
    "filename": "backup_2024-10-15.sql"
  }
}
```

---

### GET /database/backups/download/:filename
Download database backup.

**Status:** 🔴 Placeholder

**Parameters:**
- `filename` (path, required) - Backup filename

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Backup download for backup_2024-10-15.sql coming soon"
  }
}
```

---

### POST /database/backups/restore
Restore from backup.

**Status:** 🔴 Placeholder

**Request:**
```json
{
  "filename": "backup_2024-10-15.sql"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Restore from backup_2024-10-15.sql feature coming soon"
  }
}
```

---

### POST /database/query
Execute SQL query.

**Status:** ✅ Implemented

**Request:**
```json
{
  "query": "SELECT * FROM users LIMIT 10",
  "mode": "read"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rows": [
      {"email": "john@example.com", "name": "John Doe"},
      {"email": "jane@example.com", "name": "Jane Smith"}
    ],
    "rowCount": 2,
    "executionTime": 15
  }
}
```

**Safety Features:**
- `mode: read` - Only SELECT queries allowed
- `mode: write` - Allows INSERT, UPDATE, DELETE (dangerous!)
- Auto-adds LIMIT 1000 if not specified
- 10-minute timeout

**Validation:**
- Write operations require `mode: write`
- Dangerous queries (DROP, ALTER) require write mode

---

### GET /database/maintenance-status
Get maintenance status.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "lastVacuum": "2024-10-14T02:00:00Z",
    "lastAnalyze": "2024-10-14T02:05:00Z",
    "lastReindex": "N/A",
    "indexes": [
      {
        "schemaname": "public",
        "tablename": "users",
        "indexname": "users_pkey",
        "idx_scan": 15000,
        "idx_tup_read": 15000,
        "idx_tup_fetch": 15000
      }
    ]
  }
}
```

---

### POST /database/maintenance/vacuum
Run VACUUM on database.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "VACUUM completed successfully"
  }
}
```

**Notes:**
- Reclaims storage from deleted rows
- Can take several minutes on large databases
- Runs on all tables

---

### POST /database/maintenance/analyze
Run ANALYZE on database.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "ANALYZE completed successfully"
  }
}
```

**Notes:**
- Updates query planner statistics
- Should run after bulk data changes
- Fast operation

---

### POST /database/maintenance/reindex
Run REINDEX on database.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "REINDEX completed successfully"
  }
}
```

**Notes:**
- Rebuilds all indexes
- Can take a long time on large databases
- Locks tables during reindex

---

### POST /database/maintenance/analyze-table
Analyze specific table.

**Status:** ✅ Implemented

**Request:**
```json
{
  "tableName": "users"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Table users analyzed successfully"
  }
}
```

---

## Settings

### GET /settings/general
Get general settings.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "appName": "SutrAlgo",
    "appUrl": "https://sutralgo.com",
    "supportEmail": "support@sutralgo.com",
    "environment": "production",
    "debugMode": false,
    "registrationEnabled": true,
    "sessionTimeout": 60,
    "rememberMeEnabled": true,
    "scannerSchedule": "0 */4 * * *",
    "scannerEnabled": true
  }
}
```

---

### GET /settings/telegram
Get Telegram settings.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "botToken": "••••••••",
    "chatId": "123456789",
    "notifyTrades": true,
    "notifySubscriptions": true,
    "notifyPayments": true,
    "notifyErrors": true,
    "webhookUrl": "https://sutralgo.com/api/telegram/webhook",
    "webhookEnabled": true
  }
}
```

**Notes:**
- Sensitive values masked with bullets
- Only shows if bot token is configured

---

### POST /settings/telegram/test
Test Telegram bot.

**Status:** 🔴 Placeholder

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Test message sent successfully"
  }
}
```

---

### GET /settings/payment
Get payment provider settings.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "stripe": {
      "enabled": true,
      "publishableKey": "••••••••",
      "secretKey": "••••••••",
      "webhookSecret": "••••••••"
    },
    "paypal": {
      "enabled": true,
      "clientId": "••••••••",
      "clientSecret": "••••••••",
      "mode": "live"
    },
    "razorpay": {
      "enabled": false,
      "keyId": "",
      "keySecret": "",
      "webhookSecret": ""
    }
  }
}
```

---

### GET /settings/email-templates
List email templates.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "welcome",
        "name": "Welcome Email",
        "subject": "Welcome to SutrAlgo!"
      },
      {
        "id": "trial-start",
        "name": "Trial Started",
        "subject": "Your trial has started"
      }
    ],
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "username": "noreply@sutralgo.com",
      "password": "••••••••",
      "fromEmail": "noreply@sutralgo.com",
      "fromName": "SutrAlgo"
    }
  }
}
```

---

### GET /settings/email-templates/:templateId
Get specific email template.

**Status:** 🔴 Placeholder

**Parameters:**
- `templateId` (path, required) - Template ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "welcome",
    "subject": "Sample Subject",
    "body": "<h1>Hello {{name}}</h1><p>Welcome to SutrAlgo!</p>"
  }
}
```

---

### PUT /settings/email-templates/:templateId
Update email template.

**Status:** 🔴 Placeholder

**Parameters:**
- `templateId` (path, required) - Template ID

**Request:**
```json
{
  "subject": "Welcome aboard!",
  "body": "<h1>Hello {{name}}</h1><p>Welcome to SutrAlgo!</p>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "welcome",
    "subject": "Welcome aboard!",
    "body": "<h1>Hello {{name}}</h1><p>Welcome to SutrAlgo!</p>"
  },
  "message": "Template updated successfully"
}
```

---

### GET /settings/feature-flags
Get feature flags.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "flags": {
      "newDashboard": {
        "enabled": false,
        "description": "New dashboard UI"
      },
      "mlPredictions": {
        "enabled": false,
        "description": "Machine learning predictions"
      },
      "advancedCharts": {
        "enabled": true,
        "description": "Advanced charting features"
      }
    }
  }
}
```

---

### POST /settings/feature-flags
Update feature flags.

**Status:** 🔴 Placeholder

**Request:**
```json
{
  "flags": {
    "newDashboard": {
      "enabled": true,
      "description": "New dashboard UI"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "flags": {
      "newDashboard": {
        "enabled": true,
        "description": "New dashboard UI"
      }
    }
  },
  "message": "Feature flags updated successfully"
}
```

---

### POST /settings/broadcast
Send broadcast message.

**Status:** 🔴 Placeholder

**Request:**
```json
{
  "title": "System Maintenance",
  "message": "The system will be down for maintenance on Saturday.",
  "audience": "all",
  "viaEmail": true,
  "viaTelegram": true,
  "viaInApp": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sentCount": 1250,
    "viaEmail": true,
    "viaTelegram": true,
    "viaInApp": true
  },
  "message": "Broadcast sent to 1250 users"
}
```

**Audience Options:**
- `all` - All users
- `active` - Active subscribers
- `trial` - Trial users
- `inactive` - Inactive users
- `admins` - Admin users only

---

### GET /settings/maintenance
Get maintenance mode settings.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "maintenanceMode": false,
    "maintenanceMessage": "",
    "maintenanceETA": ""
  }
}
```

---

### POST /settings/maintenance-mode
Toggle maintenance mode.

**Status:** 🔴 Placeholder

**Request:**
```json
{
  "enabled": true,
  "message": "System maintenance in progress",
  "eta": "2 hours"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "maintenanceMode": true,
    "maintenanceMessage": "System maintenance in progress",
    "maintenanceETA": "2 hours"
  },
  "message": "Maintenance mode enabled"
}
```

---

### POST /settings/clear-cache
Clear cache.

**Status:** 🔴 Placeholder

**Request:**
```json
{
  "type": "all"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "all",
    "cleared": true
  },
  "message": "all cache cleared successfully"
}
```

**Cache Types:**
- `all` - Clear all caches
- `api` - Clear API response cache
- `database` - Clear database query cache
- `static` - Clear static asset cache

---

### GET /settings
Get legacy settings.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "environment": "production",
    "telegram": {
      "enabled": true,
      "chatId": "123456789"
    },
    "database": {
      "connected": true
    }
  }
}
```

---

## System

### POST /system/trigger-scan
Manually trigger stock scanner.

**Status:** 🔴 Placeholder

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Stock scanner triggered",
    "scheduled": true
  }
}
```

---

### GET /system/health
Get system health status.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-10-15T16:30:00Z",
    "uptime": 86400.5,
    "memory": {
      "rss": 52428800,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576
    },
    "database": {
      "connected": true
    },
    "sse": {
      "activeConnections": 5
    }
  }
}
```

---

### GET /sse/connections
Get active SSE connections.

**Status:** ✅ Implemented

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5,
    "connections": [
      {
        "id": "conn_abc123",
        "connectedAt": "2024-10-15T14:00:00Z",
        "lastActivity": "2024-10-15T16:30:00Z"
      }
    ]
  }
}
```

---

## Error Codes

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `USER_NOT_FOUND` | 404 | User not found |
| `CONFLICT` | 409 | Resource conflict |
| `INVALID_STATE` | 400 | Invalid state for operation |
| `QUERY_ERROR` | 500 | Database query error |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with email john@example.com not found"
  }
}
```

---

## Rate Limits

### Current Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Read Operations | 100 requests | 1 minute |
| Write Operations | 30 requests | 1 minute |
| Export Operations | 10 requests | 10 minutes |
| Database Queries | 20 requests | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1697452920
```

### Rate Limit Error Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 30 seconds.",
    "details": {
      "limit": 100,
      "window": "1 minute",
      "retryAfter": 30
    }
  }
}
```

**HTTP Status:** 429 Too Many Requests

---

## Implementation Summary

### Endpoint Status Breakdown

```
Total Endpoints: 71

✅ Fully Implemented: 58 (82%)
⚠️ Partially Implemented: 2 (3%)
🔴 Placeholder: 11 (15%)
```

### Placeholder Endpoints (Need Implementation)

1. `POST /analytics/reports` - Custom report generation
2. `GET /analytics/overview` - Analytics overview
3. `POST /database/migrations/run` - Run migrations
4. `POST /database/migrations/run-single` - Run single migration
5. `GET /database/backups` - List backups
6. `POST /database/backups/create` - Create backup
7. `GET /database/backups/download/:filename` - Download backup
8. `POST /database/backups/restore` - Restore backup
9. `POST /settings/telegram/test` - Test Telegram
10. `GET /settings/email-templates/:templateId` - Get email template
11. `PUT /settings/email-templates/:templateId` - Update email template
12. `POST /settings/feature-flags` - Update feature flags
13. `POST /settings/broadcast` - Send broadcast
14. `POST /settings/maintenance-mode` - Toggle maintenance
15. `POST /settings/clear-cache` - Clear cache
16. `POST /system/trigger-scan` - Trigger scanner

### Priority for Implementation

**High Priority:**
1. `POST /analytics/reports` - Custom reporting
2. `POST /database/backups/create` - Backup system
3. `POST /settings/telegram/test` - Telegram testing
4. `POST /settings/broadcast` - User communications

**Medium Priority:**
5. `POST /database/migrations/run` - Migration runner
6. `POST /settings/maintenance-mode` - Maintenance control
7. `POST /settings/clear-cache` - Cache management

**Low Priority:**
8. Remaining placeholder endpoints

---

## Best Practices

### Making API Requests

```javascript
// Using fetch with error handling
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`/api/admin${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Example usage
const users = await apiRequest('/users?page=1&limit=50');
```

### Handling Pagination

```javascript
async function getAllUsers() {
  const allUsers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await apiRequest(`/users?page=${page}&limit=100`);
    allUsers.push(...response.items);

    hasMore = response.pagination.page < response.pagination.pages;
    page++;
  }

  return allUsers;
}
```

### Error Handling

```javascript
try {
  const user = await apiRequest('/users/john@example.com');
} catch (error) {
  if (error.message.includes('not found')) {
    // Handle not found
  } else {
    // Handle other errors
  }
}
```

---

## Changelog

### Version 1.0 (2024-10-15)
- Initial API documentation
- 71 endpoints documented
- 58 fully implemented
- 11 placeholders identified

---

**Document Control:**
- **Version:** 1.0
- **Created:** 2024-10-15
- **Status:** Complete
- **Next Review:** After implementing placeholders

**Related Documents:**
- `ADMIN_V2_ENHANCEMENT_PLAN.md`
- `ADMIN_V2_CURRENT_STATE_AUDIT.md`
- `ADMIN_V2_DESIGN_SYSTEM.md`
