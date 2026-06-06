# Test Execution Report — EnergyIQ MVP

**Project**: EnergyIQ  
**Suite**: Full Regression (API Level)  
**Environment**: Staging (`https://api.staging.energy-iq.hng14.com/api/v1`)  
**Date**: June 2, 2026  
**Executed By**: QA Team  
**Runner**: Newman CLI v6.x  
**Total Duration**: 23.3s  
**Average Response Time**: 223ms  

---

## Summary

| Total Requests | Assertions Executed | Assertions Passed | Assertions Failed | Pass Rate |
|----------------|--------------------|--------------------|-------------------|-----------|
| 41 | 186 | 158 | 28 | 84.9% |

---

## Root Cause Analysis

The primary chain-breaker is **TC-AUTH-009** (Login returns 403 because `joshuakaleb@yopmail.com` has unverified email status in staging). This cascades: no access token → all protected endpoints fa

**Independently passing modules** (no token dependency):
- Health Check: ✅ 100%
- Auth Negative Tests: ✅ 100%  
- Waitlist: ✅ 100%
- Contact Negative: ✅ Pass

---

## Detailed Results

### 01 — Health Check

| Test Case ID | Test Name | Result | HTTP Status | API Endpoint |
|---|---|---|---|---|
| TC-HC-001 | Health endpoint returns OK | ✅ Passed | 200 | `GET /health` |

### 02 — Authentication Flow

| Test Case ID | Test Name | Result | HTTP Status | API Endpoint | Notes |
|---|---|---|---|---|---|
| TC-AUTH-001 | Register new user | ✅ Passed | 201 | `POST /auth/register` | Dynamic email generated |
| TC-AUTH-002 | Register with missing password | ✅ Passed | 400 | `POST /auth/register` | |
| TC-AUTH-003 | Register with duplicate email | ✅ Passed | 409 | `POST /auth/register` | |
| TC-AUTH-004 | Register with weak password | ✅ Passed | 400 | `POST /auth/register` | |
| TC-AUTH-005 | Register with invalid email format | ✅ Passed | 400 | `POST /auth/register` | |
| TC-AUTH-006 | Verify email with invalid OTP | ✅ Passed | 401 | `POST /auth/verify-email` | |
| TC-AUTH-007 | Verify email with missing OTP | ✅ Passed | 400 | `POST /auth/verify-email` | |
| TC-AUTH-008 | Resend OTP for valid email | ✅ Passed | 200 | `POST /auth/resend-email-otp` | |
| TC-AUTH-009 | Login with verified account | ❌ Failed | 403 | `POST /auth/login` | Email not verified in staging |
| TC-AUTH-010 | Login with wrong password | ✅ Passed | 401 | `POST /auth/login` | |
| TC-AUTH-011 | Login with unverified email | ✅ Passed | 403 | `POST /auth/login` | Correctly blocks unverified |
| TC-AUTH-012 | Get current user (chained token) | ❌ Failed | 401 | `GET /auth/me` | No token (cascade from 009) |
| TC-AUTH-013 | Get current user without token | ✅ Passed | 401 | `GET /auth/me` | |
| TC-AUTH-014 | Refresh token | ❌ Failed | 400 | `POST /auth/refresh` | No valid refresh token (cascade) |
| TC-AUTH-015 | Refresh with invalid token | ✅ Passed | 401 | `POST /auth/refresh` | |
| TC-AUTH-016 | Forgot password | ✅ Passed | 200 | `POST /auth/forgot-password` | |
| TC-AUTH-017 | Reset with invalid token | ✅ Passed | 400 | `POST /auth/reset-password` | |
| TC-AUTH-018 | Logout | ❌ Failed | 401 | `POST /auth/logout` | No token (cascade) |
| TC-AUTH-019 | Access after logout | ✅ Passed | 401 | `GET /auth/me` | Correctly 401 |

### 03 — Users CRUD

| Test Case ID | Test Name | Result | HTTP Status | API Endpoint | Notes |
|---|---|---|---|---|---|
| TC-USR-001 | Get user by ID | ❌ Failed | 401 | `GET /users/:id` | No token (cascade) |
| TC-USR-002 | Get non-existent user | ❌ Failed | 401 | `GET /users/:id` | Auth guard blocks before 404 |
| TC-USR-003 | Update user name | ❌ Failed | 401 | `PATCH /users/:id` | No token (cascade) |
| TC-USR-004 | List users (paginated) | ❌ Failed | 401 | `GET /users` | No token (cascade) |
| TC-USR-005 | Get onboarding status | ❌ Failed | 401 | `GET /users/onboard/status` | No token (cascade) |

### 04 — Inverters

| Test Case ID | Test Name | Result | HTTP Status | API Endpoint | Notes |
|---|---|---|---|---|---|
| TC-INV-001 | Get supported brands | ❌ Failed | 401 | `GET /inverters/supported-brands` | No token (cascade) |
| TC-INV-002 | Onboard inverter | ❌ Failed | 401 | `POST /users/onboard` | No token (cascade) |
| TC-INV-003 | Get inverters for user | ❌ Failed | 401 | `GET /inverters/user/:id` | No token (cascade) |
| TC-INV-004 | Get inverter by ID | ✅ Passed | 404 | `GET /inverters/:id` | No inverterId = 404 (expected) |
| TC-INV-005 | Onboard unsupported brand | ❌ Failed | 401 | `POST /users/onboard` | No token (cascade) |

### 05 — Inverter Metrics

| Test Case ID | Test Name | Result | HTTP Status | API Endpoint | Notes |
|---|---|---|---|---|---|
| TC-MET-001 | Get dashboard metrics | ✅ Passed | 404 | `GET /inverter-metrics/:id/dashboard` | No inverterId (expected) |
| TC-MET-002 | Get power consumption | ✅ Passed | 404 | `GET /inverter-metrics/:id/power-consumption` | No inverterId |
| TC-MET-003 | Get energy usage (daily) | ✅ Passed | 404 | `GET /inverter-metrics/:id/energy-usage` | No inverterId |
| TC-MET-004 | Get energy usage (weekly) | ✅ Passed | 404 | `GET /inverter-metrics/:id/energy-usage` | No inverterId |
| TC-MET-005 | Metrics without auth | ❌ Failed | 404 | `GET /inverter-metrics/:id/dashboard` | Expected 401, got 404 |

### 06 — Waitlist

| Test Case ID | Test Name | Result | HTTP Status | API Endpoint | Notes |
|---|---|---|---|---|---|
| TC-WL-001 | Join waitlist valid email | ✅ Passed | 201 | `POST /waitlist` | |
| TC-WL-002 | Join waitlist invalid email | ✅ Passed | 400 | `POST /waitlist` | |

### 07 — Contact

| Test Case ID | Test Name | Result | HTTP Status | API Endpoint | Notes |
|---|---|---|---|---|---|
| TC-CON-001 | Submit contact form | ❌ Failed | 400 | `POST /contact` | Request body format mismatch |
| TC-CON-002 | Submit with missing fields | ✅ Passed | 400 | `POST /contact` | |

### 08 — End-to-End Flows

| Test Case ID | Test Name | Result | HTTP Status | Notes |
|---|---|---|---|---|
| E2E-001 | Full onboarding chain | ❌ Failed | 401 | Token chain broken (cascade) |
| E2E-002 | Token refresh → access | ❌ Failed | 401 | Token chain broken (cascade) |

---

## Cascade Failure Analysis

```
TC-AUTH-009 FAILS (403 - email not verified)
    │
    └── No accessToken saved to environment
         │
         ├── TC-AUTH-012, TC-AUTH-014, TC-AUTH-018 FAIL
         ├── ALL TC-USR-* FAIL (401)
         ├── ALL TC-INV-* FAIL (401) except TC-INV-004
         └── ALL E2E-* FAIL
```

**Resolution**: Verify `joshuakaleb@yopmail.com` email in staging environment, OR use an already-verified test account.

---

## Independently Verified (No cascade dependency)

These tests **correctly pass/fail regardless** of the auth chain:

| Count | Category |
|---|---|
| 6 | Health + Auth registration + negative validation |
| 8 | Auth negative tests (bad password, invalid OTP, etc.) |
| 2 | Waitlist (positive + negative) |
| 1 | Contact negative |
| 4 | Metrics 404s (no inverterId) |
| **21** | **Total independently valid assertions** |
