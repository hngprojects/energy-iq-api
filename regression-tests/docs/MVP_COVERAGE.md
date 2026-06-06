# MVP Coverage Confirmation — EnergyIQ

**Date**: June 2, 2026  
**Team**: EnergyIQ QA  

---

## ✅ Milestone Coverage

| Milestone | Scope | Status | Test Cases |
|-----------|-------|--------|------------|
| **Milestone 1** | Auth (Register, Verify Email, Login, Refresh, Logout, Forgot/Reset Password, Google OAuth) | ✅ Covered | TC-AUTH-001 to TC-AUTH-019 |
| **Milestone 2** | Core Features (Users CRUD, Waitlist, Contact) | ✅ Covered | TC-USR-001 to TC-USR-005, TC-WL-001/002, TC-CON-001/002 |
| **Milestone 3** | Integrations (Inverters, Metrics, Dashboard) | ✅ Covered | TC-INV-001 to TC-INV-005, TC-MET-001 to TC-MET-005 |

---

## ✅ Major E2E Flows Tested

| Flow | Description | Status |
|------|-------------|--------|
| Registration → Email Verify → Login | Full signup chain | ✅ |
| Login → Token → Access Protected Routes | Session persistence | ✅ |
| Token Refresh → Continue Session | Token lifecycle | ✅ |
| Login → Onboard Inverter → View Metrics | Core product chain | ✅ (partial — 3rd party dependency) |
| Logout → Token Invalidation | Session teardown | ✅ (bug found: BUG-003) |
| Forgot Password → Reset → Login | Recovery flow | ✅ |

---

## ✅ Module Coverage Summary

| Module | Endpoints Tested | Positive | Negative | E2E Chaining |
|--------|-----------------|----------|----------|--------------|
| Health | 1 | 1 | 0 | — |
| Auth | 10 | 9 | 8 | ✅ Full |
| Users | 4 | 4 | 1 | ✅ Token reuse |
| Inverters | 4 | 3 | 2 | ✅ Token + ID |
| Metrics | 4 | 4 | 1 | ✅ Token + ID |
| Waitlist | 1 | 1 | 1 | — |
| Contact | 1 | 1 | 1 | — |
| **Total** | **25 endpoints** | **23** | **14** | **4 chains** |

---

## ✅ Cross-Module Regression Coverage

- Auth tokens used by Users, Inverters, Metrics (cross-module dependency)
- User ID from Auth.Login feeds into Users.GetById, Inverters.GetByUser
- Inverter ID from Onboard feeds into all Metrics endpoints
- Refresh token rotation validated mid-session without breaking downstream calls

---

## ✅ Automation Confirmation

| Criteria | Status |
|----------|--------|
| Executable from single entry point | ✅ `npm test` or `scripts/run-tests.bat` |
| Stored in team repository | ✅ `energyiq-qa-regression` repo |
| Runnable via CLI | ✅ Newman |
| Clear pass/fail output | ✅ CLI reporter + HTML report |
| Structured reporting | ✅ `reports/report.html` |

---

## ⚠️ Known Limitations

1. **Inverter onboarding** requires a real Victron VRM token (3rd-party) — tested with mock, blocked in live staging
2. **Email OTP verification** requires manual OTP retrieval from email inbox (automated for negative cases only)
3. **Google OAuth** is a browser redirect flow — cannot be automated via Newman/API tests
4. **Chatbot WebSocket** — not covered in REST API suite (requires separate WebSocket test tooling)

---

## 📎 Deliverable Links

| Deliverable | Location |
|---|---|
| Regression Suite Repo | `energyiq-qa-regression/` (this repo) |
| Postman Collection | `collections/EnergyIQ.postman_collection.json` |
| Test Execution Report | `docs/TEST_EXECUTION_REPORT.md` |
| Bug Report Log | `docs/BUG_REPORT.md` |
| MVP Coverage Summary | `docs/MVP_COVERAGE.md` (this file) |
