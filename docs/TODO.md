# TODO - Security & Authentication Features

## High Priority

### 1. Email Sending Service
- [ ] Choose email service (SendGrid, AWS SES, Mailgun, etc.)
- [ ] Configure email service credentials in `.env`
- [ ] Create email templates (verification, recovery)
- [ ] Send verification emails on registration (replace console.log in `AuthRouter.js:378`)
- [ ] Send recovery emails on password recovery request (replace console.log in `AuthRouter.js:604`)
- [ ] Send resend verification emails (replace console.log in `AuthRouter.js:540`)
- [ ] Handle email sending errors gracefully

**Files to modify:**
- `backend/src/routes/AuthRouter.js` (lines 378, 540, 604)

---

### 2. Password Recovery Frontend
- [ ] Replace alert in `SplashScreen.js:handleRecover()` with actual recovery form
- [ ] Create password recovery request form/page
- [ ] Implement "Forgot Password?" link functionality
- [ ] Call `/api/auth/recover` endpoint
- [ ] Create password reset page (handle token from email URL)
- [ ] Call `/api/auth/verify-recovery-token` to validate token
- [ ] Call `/api/auth/reset-password` to reset password
- [ ] Show success/error messages
- [ ] Redirect to login after successful reset

**Files to modify:**
- `frontend/src/SplashScreen.js` (line 508-514)
- Create new component: `frontend/src/PasswordRecovery.js` (optional)

---

### 3. Email Verification Frontend
- [ ] Create email verification page/component
- [ ] Add verification link in registration success message
- [ ] Handle verification token from URL query parameter
- [ ] Call `/api/auth/verify-email` endpoint
- [ ] Show success/error messages
- [ ] Redirect to login after successful verification
- [ ] Add "Resend Verification" functionality/button
- [ ] Create resend verification form/page

**Files to create:**
- `frontend/src/EmailVerification.js` (or add to `SplashScreen.js`)

**Files to modify:**
- `frontend/src/SplashScreen.js` (add verification UI to registration success)

---

## Medium Priority

### 4. JWT Token Refresh (Frontend)
- [ ] Store refresh token securely (consider httpOnly cookie instead of localStorage)
- [ ] Detect when access token expires (check expiry time or catch 401 responses)
- [ ] Call `/api/auth/refresh-token` when access token expires
- [ ] Update access token in storage after refresh
- [ ] Retry failed requests after token refresh
- [ ] Handle refresh token expiration (redirect to login)

**Files to modify:**
- `frontend/src/main.js` (add token refresh logic)
- `frontend/src/SplashScreen.js` (handle token refresh on API calls)

---

### 5. CSRF Protection
- [ ] Apply CSRF middleware to state-changing routes (POST, PUT, DELETE)
- [ ] Generate CSRF tokens on login/registration
- [ ] Store CSRF tokens in secure cookies or session
- [ ] Send CSRF tokens from frontend in headers (`X-CSRF-Token`) or body (`csrfToken`)
- [ ] Implement proper CSRF token validation in middleware (currently just passes through)
- [ ] Update frontend to include CSRF tokens in requests

**Files to modify:**
- `backend/src/middleware/csrf.js` (line 71 - implement validation)
- `backend/src/routes/AuthRouter.js` (apply CSRF middleware to routes)
- `frontend/src/SplashScreen.js` (include CSRF tokens in API calls)

**Note:** JWT in Authorization header provides some CSRF protection, but explicit CSRF tokens add extra security.

---

## Low Priority

### 6. Email Verification Enforcement
- [ ] Check `email_verified` flag on login
- [ ] Block login if email not verified
- [ ] Return specific error for unverified email
- [ ] Show message with "Resend Verification" link in frontend
- [ ] Allow login after verification

**Files to modify:**
- `backend/src/routes/AuthRouter.js` (line 249-251 - currently just logs warning)
- `frontend/src/SplashScreen.js` (handle unverified email error)

---

### 7. Token Storage Security (Optional Enhancement)
- [ ] Move refresh tokens from localStorage to httpOnly cookies
- [ ] Implement CSRF protection (required if using cookies)
- [ ] Update frontend to handle cookie-based tokens
- [ ] Update logout to clear httpOnly cookies

**Note:** This is more secure but requires CSRF protection. localStorage is acceptable if HTTPS is used.

---

## Implementation Notes

### Email Service Integration
- **SendGrid:** Free tier (100 emails/day), easy setup
- **AWS SES:** Very cheap, requires AWS account
- **Mailgun:** Free tier (5,000 emails/month), good for development
- **Nodemailer:** Direct SMTP, requires SMTP server

### Current State
- ✅ Backend endpoints complete for all auth features
- ✅ Email/recovery tokens are generated and stored in database
- ✅ Tokens are logged to console for development
- ❌ Emails are NOT actually sent
- ❌ Frontend recovery flow shows alert instead of form
- ❌ Frontend verification flow doesn't exist

### Quick Wins
1. **Email Service:** Biggest blocker - everything else depends on emails working
2. **Password Recovery UI:** Backend ready, just needs frontend form
3. **Email Verification UI:** Backend ready, just needs frontend component

---

## Files with TODO Comments

### Backend
- `backend/src/routes/AuthRouter.js:378` - `// TODO: Send verification email with token`
- `backend/src/routes/AuthRouter.js:540` - `// TODO: Send verification email`
- `backend/src/routes/AuthRouter.js:604` - `// TODO: Send recovery email`
- `backend/src/middleware/csrf.js:71` - `// TODO: Implement proper CSRF token validation`

### Frontend
- `frontend/src/SplashScreen.js:513` - `// TODO: Implement password recovery flow`

---

## Testing Checklist

Once implemented, test:
- [ ] Email verification link works from email
- [ ] Email verification expires after 24 hours
- [ ] Password recovery link works from email
- [ ] Password recovery token expires after 1 hour
- [ ] Password recovery token can only be used once
- [ ] Token refresh works when access token expires
- [ ] CSRF tokens are validated on state-changing routes
- [ ] Rate limiting still works after implementation

