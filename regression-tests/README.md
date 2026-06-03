# EnergyIQ QA Regression Suite

Full API-level regression automation for the EnergyIQ MVP, covering Milestones 1–3.

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd energyiq-qa-regression

# 2. Install dependencies
npm install

# 3. Run the full regression suite
npm test
```

That's it. Results will print to the console and an HTML report will be generated at `reports/report.html`.

### Windows One-Click
```cmd
scripts\run-tests.bat
```

### Available Commands
| Command | Description |
|---------|-------------|
| `npm test` | Full run with CLI + HTML report |
| `npm run test:cli` | CLI output only (no HTML) |
| `npm run test:report` | HTML report only (no CLI) |

## 🏗️ Architecture

```
energyiq-qa-regression/
├── collections/
│   └── EnergyIQ.postman_collection.json   # Full regression collection (40+ tests)
├── environments/
│   └── staging.postman_environment.json   # Staging env variables
├── reports/
│   └── report.html                        # Generated HTML report
├── scripts/
│   ├── run-tests.bat                      # Windows runner (entry point)
│   └── run-tests.sh                       # Linux/Mac runner
├── docs/
│   ├── TEST_EXECUTION_REPORT.md           # Test case results
│   ├── BUG_REPORT.md                      # Bug log
│   └── MVP_COVERAGE.md                    # Coverage confirmation
├── package.json
└── README.md
```

## 🚀 How to Run (Single Entry Point)

### Prerequisites
- Node.js 18+ installed
- npm installed

### Windows (recommended)
```cmd
cd energyiq-qa-regression
scripts\run-tests.bat
```

### CLI (any OS)
```bash
npm install
npm test
```

### CLI-only output (no HTML report)
```bash
npm run test:cli
```

## 📊 Test Coverage

| Module | Tests | Chaining |
|--------|-------|----------|
| Health Check | 1 | — |
| Auth (Register/Verify/Login/Refresh/Logout) | 19 | Signup → Login → Token → Refresh → Logout |
| Users CRUD | 5 | Token reuse from Auth |
| Inverters | 5 | Token reuse + inverter ID forwarding |
| Inverter Metrics | 5 | Token + inverterId chaining |
| Waitlist | 2 | — |
| Contact | 2 | — |
| End-to-End Flows | 2 | Full chain validation |
| **Total** | **41** | |

## 🔗 API Chaining Flow

```
Register → (email) → Verify → Login → [accessToken saved]
                                            │
        ┌───────────────────────────────────┘
        ▼
   GET /auth/me ──── GET /users/:id ──── GET /users/onboard/status
        │
        ▼
   POST /users/onboard → [inverterId saved]
        │
        ▼
   GET /inverter-metrics/:id/dashboard
   GET /inverter-metrics/:id/energy-usage
        │
        ▼
   POST /auth/refresh → [new tokens saved]
        │
        ▼
   POST /auth/logout → GET /auth/me (expects 401)
```

## ✅ What Is Validated

- **Pre-request validations**: Dynamic email generation, dependency checks, token existence
- **Post-request validations**: Status codes, response schema, field presence, data types
- **Cross-module regression**: Auth tokens reused across Users, Inverters, Metrics
- **Negative testing**: Invalid inputs, missing auth, expired tokens, wrong passwords
- **E2E flows**: Full signup-to-dashboard chain, token lifecycle

## 🐛 Failure Handling

Every failed test is:
1. Logged in the Newman CLI output with pass/fail status
2. Documented in `docs/BUG_REPORT.md` with severity, steps, and linked test case
3. Visible in the HTML report (`reports/report.html`)

## 📋 Reports

After running, open `reports/report.html` in a browser for:
- Total pass/fail counts
- Per-request timing
- Response body details
- Assertion results
