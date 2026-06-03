# Bug Report Log — EnergyIQ QA Regression

**Project**: EnergyIQ  
**Sprint**: Final Regression  
**Reported By**: QA Team  
**Date**: June 2, 2026  

---

## Summary

| Total Bugs | Critical | High | Medium | Low |
|------------|----------|------|--------|-----|
| 4 | 1 | 1 | 1 | 1 |

---

## Bug Details

### BUG-001: Login returns 403 for pre-existing test account (email not verified in staging)

| Field | Value |
|---|---|
| **Bug ID** | BUG-001 |
| **Severity** | Critical |
| **Status** | Open |
| **Linked Test Case** | TC-AUTH-009 |
| **Linked Requirement** | REQ-AUTH-006: User login with verified email |
| **Milestone** | Milestone 1 — Authentication |
| **API Endpoint** | `POST /auth/login` |

**Description**: The pre-existing test account `joshuakaleb@yopmail.com` returns `403 Forbidden` when attempting login. The response indicates email is not verified. This cascades to all 20+ downstrea

**Steps to Reproduce**:
1. POST `/auth/login` with body: `{"email": "joshuakaleb@yopmail.com", "password": "@Joshuakaleb90"}`
2. Observe `403 Forbidden` response with `success: false`

**Expected**: `200 OK` with `accessToken` and `refreshToken` (account was previously used and should be verified)  
**Actual**: `403 Forbidden` — email not verified

**Impact**: Cascading failure across 28 assertions in Users, Inverters, Metrics, E2E modules

**Root Cause Hypothesis**: Either (a) staging database was reset without re-verifying accounts, or (b) email verification expired

---

### BUG-002: Contact form rejects valid submission with 400

| Field | Value |
|---|---|
| **Bug ID** | BUG-002 |
| **Severity** | High |
| **Status** | Open |
| **Linked Test Case** | TC-CON-001 |
| **Linked Requirement** | REQ-CON-001: Contact form submission |
| **Milestone** | Milestone 2 — Contact |
| **API Endpoint** | `POST /contact` |

**Description**: Submitting a valid contact form with name, email, and message returns `400 Bad Request`. The API may expect different field names or additional required fields not documented.

**Steps to Reproduce**:
1. POST `/contact` with body:
```json
{
  "name": "QA Tester",
  "email": "qa_contact@yopmail.com",
  "message": "This is a QA regression test contact submission."
}
```
2. Observe `400 Bad Request`

**Expected**: `200 OK` or `201 Created`  
**Actual**: `400 Bad Request`

**Investigation Needed**: Check if the contact endpoint expects different field names (e.g., `subject`, `phone`) or if there's a CAPTCHA requirement.

---

### BUG-003: Metrics endpoint returns 404 instead of 401 for unauthenticated requests

| Field | Value |
|---|---|
| **Bug ID** | BUG-003 |
| **Severity** | Medium |
| **Status** | Open |
| **Linked Test Case** | TC-MET-005 |
| **Linked Requirement** | REQ-MET-004: Auth guard on metrics |
| **Milestone** | Milestone 3 — Integrations |
| **API Endpoint** | `GET /inverter-metrics/:id/dashboard` |

**Description**: When accessing the metrics dashboard endpoint without an Authorization header and with an empty inverterId path param, the API returns `404 Not Found` instead of `401 Unauthorized`. T

**Steps to Reproduce**:
1. GET `/inverter-metrics//dashboard` (no inverterId, no auth header)
2. Observe `404 Not Found`

**Expected**: `401 Unauthorized` (auth should be checked before route params)  
**Actual**: `404 Not Found` (route not matched due to empty path segment)

**Note**: This is partially a test design issue (empty inverterId creates `//dashboard` URL). However, the security concern is that route 404 reveals whether paths exist before auth check.

---

### BUG-004: Inverter supported-brands endpoint requires authentication

| Field | Value |
|---|---|
| **Bug ID** | BUG-004 |
| **Severity** | Low |
| **Status** | Open |
| **Linked Test Case** | TC-INV-001 |
| **Linked Requirement** | REQ-INV-001: Brand list visibility |
| **Milestone** | Milestone 3 — Integrations |
| **API Endpoint** | `GET /inverters/supported-brands` |

**Description**: The supported brands endpoint requires authentication. For onboarding UX, this endpoint could be public so users know which brands are supported before they sign up.

**Steps to Reproduce**:
1. GET `/inverters/supported-brands` without Authorization header
2. Observe `401 Unauthorized`

**Expected**: Consider making this public (no auth required) for pre-signup discovery  
**Actual**: Returns `401` — requires login first

**Note**: This is more of a UX/design suggestion than a bug. Current behavior matches auth guard spec.

---

## Resolution Tracking

| Bug ID | Fix PR | Verified | Date |
|---|---|---|---|
| BUG-001 | — | ❌ Pending staging data fix | — |
| BUG-002 | — | ❌ Need API contract clarification | — |
| BUG-003 | — | ❌ | — |
| BUG-004 | — | ❌ Design discussion needed | — |
