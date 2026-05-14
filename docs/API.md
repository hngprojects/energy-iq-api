# Energy IQ API Reference

Base URL: 
- Staging: `https://api.staging.energy-iq.hng14.com/api/v1`
- Production: `https://api.energy-iq.hng14.com/api/v1`

All protected endpoints require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <accessToken>
```

Common onboarding flow:
1. Register an account
2. Verify the email address
3. Connect an inverter

---

## Health

### `GET /health`
Liveness probe. No authentication required.

**Response `200`**
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-05-11T08:00:00.000Z"
}
```

---

## Auth

### `POST /auth/register`
Register a new user. Sends a verification email with a 6-digit OTP.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

**Response `201`**: returns the created user (no tokens; user must verify email before logging in)

---

### `POST /auth/verify-email`
Verify email address using the OTP sent during registration.

**Rate limit:** 3 requests / 60s

**Request body**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response `200`**

---

### `POST /auth/resend-email-otp`
Resend the email verification OTP if the previous one expired.

**Request body**
```json
{
  "email": "user@example.com"
}
```

**Response `200`**

---

### `POST /auth/login`
Log in with email and password. Email must be verified first.

**Rate limit:** 5 requests / 60s

**Request body**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response `200`**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "user",
    "emailVerified": true,
    "createdAt": "2026-05-11T08:00:00.000Z",
    "updatedAt": "2026-05-11T08:00:00.000Z"
  }
}
```

---

### `POST /auth/refresh`
Issue a new access token using a valid refresh token.

**Rate limit:** 20 requests / 60s

**Request body**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response `200`**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

---

### `POST /auth/logout`
🔒 **Protected**. Revoke the current refresh token.

**Response `204`**: no body

---

### `GET /auth/me`
🔒 **Protected**. Return the currently authenticated user's profile.

**Response `200`**: returns the user object

---

### `POST /auth/forgot-password`
Request a password reset link. Sends an email with a reset link.

**Request body**
```json
{
  "email": "user@example.com"
}
```

**Response `200`**

---

### `POST /auth/reset-password`
Set a new password using the token from the reset email.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "newSecurePassword",
  "token": "a3f9c2e1b4d8..."
}
```

**Response `200`**

---

### `GET /auth/google`
Initiate Google OAuth flow (web). Redirects the browser to Google's consent screen.

> Cannot be tested via Swagger. Open directly in a browser.

**Response `302`**: redirects to Google

---

### `GET /auth/google/callback`
Google OAuth callback (web). Called automatically by Google after user approves.  
On success, redirects to `{CLIENT_URL}/onboarding#token=<accessToken>`.

> The access token is in the URL **fragment** (`#token=...`), not a query parameter. The frontend reads it via `window.location.hash`.

**Response `302`**: redirects to frontend

---

## Users

All endpoints require authentication (`Authorization: Bearer <token>`).

### `GET /users`
List all users (paginated).

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Response `200`**

---

### `GET /users/:id`
Get a single user by UUID.

**Response `200`**: returns the user object  
**Response `404`**: user not found

---

### `PATCH /users/:id`
Update a user's details.

**Request body** (all fields optional)
```json
{
  "firstName": "Jane",
  "lastName": "Doe"
}
```

**Response `200`**: returns the updated user

---

### `DELETE /users/:id`
Delete a user.

**Response `204`**: no body

---

### `POST /users/onboard`
Connect the current user's inverter during onboarding.

🔒 **Protected**. Uses the authenticated user's id from the access token.

**Request body**
```json
{
  "brand": "VICTRON",
  "victronAccessToken": "victron-vrm-personal-access-token"
}
```

Supported brands: `VICTRON`, `GROWATT`, `SUNSYNK`

**Response `201`**: returns the created inverter record

---

### `GET /users/onboard/status`
🔒 **Protected**. Get the current user's onboarding step and completion status.

**Response `200`**
```json
{
  "currentStep": 2,
  "onboardingComplete": false,
  "steps": {
    "accountCreated": true,
    "emailVerified": true,
    "inverterConnected": false
  }
}
```

---

## Inverters

All endpoints require authentication.

### `GET /inverters/supported-brands`
Get the list of supported inverter brands.

**Response `200`**
```json
["VICTRON", "GROWATT", "DEYE", "SUNSYNK"]
```

---

### `GET /inverters/user/:userId`
Get all inverters connected to a specific user.

**Response `200`**: array of inverter objects  
**Response `404`**: no inverters found

---

### `GET /inverters/:id`
Get a single inverter by UUID.

**Response `200`**: inverter object  
**Response `404`**: not found

---

## Inverter Metrics

All endpoints require authentication.

### `GET /inverter-metrics/:inverterId/dashboard`
Get the latest dashboard metrics for a specific inverter.

**Path params**
| Param | Type | Description |
|---|---|---|
| `inverterId` | UUID | The inverter's ID |

**Response `200`**
```json
{
  "solarInputKw": 3.2,
  "batteryPercent": 78,
  "runningNowKw": 1.5,
  "nairaSavedToday": 1200.50,
  "nairaSavedThisMonth": 34500.00,
  "lastUpdated": "2026-05-11T08:00:00.000Z"
}
```

---

### `GET /inverter-metrics/:inverterId/power-consumption`
Get power consumption breakdown by zone for a specific inverter.

**Path params**
| Param | Type | Description |
|---|---|---|
| `inverterId` | UUID | The inverter's ID |

**Response `200`**

---

### `GET /inverter-metrics/:inverterId/energy-usage`
Get energy usage chart data for a specific inverter.

**Path params**
| Param | Type | Description |
|---|---|---|
| `inverterId` | UUID | The inverter's ID |

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `period` | string | `daily` | One of: `hourly`, `daily`, `weekly`, `monthly` |

**Response `200`**
```json
[
  {
    "timestamp": "Monday",
    "energy_generated": 12.4,
    "energy_usage": 8.1
  },
  {
    "timestamp": "Tuesday",
    "energy_generated": 10.2,
    "energy_usage": 7.5
  }
]
```

---



### Token lifecycle
- **Access token**: short-lived (15 minutes). Used in `Authorization: Bearer` header.
- **Refresh token**: long-lived (7 days). Used only to get a new access token via `POST /auth/refresh`.

### Google OAuth (mobile)
Mobile apps should **not** use the `GET /auth/google` redirect flow. Instead:
1. Use the platform's Google Sign-In SDK to obtain an `idToken`
2. Send it to `POST /auth/google/token` (coming soon)
3. Receive your app's JWT tokens in the response

### Rate limiting
Some endpoints are rate-limited to prevent abuse. Exceeding the limit returns `429 Too Many Requests`.

---

## Error responses

All errors follow this shape:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "ErrorType",
  "statusCode": 400,
  "meta": {
    "timestamp": "2026-05-11T08:00:00.000Z"
  }
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request / validation failed |
| `401` | Unauthenticated |
| `403` | Forbidden |
| `404` | Resource not found |
| `409` | Conflict (e.g. email already exists) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
