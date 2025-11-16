# Security Implementation & CSRF Explanation

## CSRF (Cross-Site Request Forgery) Protection

### What is CSRF?

**CSRF** is an attack where a malicious website tricks a user's browser into making unauthorized requests to a website where the user is authenticated.

### Example Attack Scenario:

1. **User logs into your app** at `https://yourapp.com`
   - Browser stores authentication cookie/token
   
2. **User visits a malicious site** at `https://evil.com`
   - While still logged into your app
   
3. **Malicious site contains hidden code:**
   ```html
   <img src="https://yourapp.com/api/delete-account">
   <form action="https://yourapp.com/api/transfer-funds" method="POST">
     <input name="amount" value="1000">
     <input name="to" value="evil-account">
   </form>
   <script>document.forms[0].submit();</script>
   ```

4. **Browser automatically sends request** with user's authentication cookies/tokens
   - Because user is logged in, browser includes auth credentials
   
5. **Your server thinks it's the legitimate user** and executes the action!
   - Account deleted, money transferred, etc.

### How CSRF Tokens Prevent This:

1. **Server generates a random CSRF token** and stores it (session/cookie)
2. **Server sends token to client** in a way that `evil.com` can't access
   - As a cookie with `SameSite=Strict` attribute
   - Or in response body that only your site can read
3. **Client includes token** in all state-changing requests (POST, PUT, DELETE)
   - In header: `X-CSRF-Token: abc123...`
   - Or in body: `{ csrfToken: "abc123...", ...otherData }`
4. **Server verifies token matches** before processing request
5. **Attack fails** because `evil.com` can't get the token (same-origin policy)

### Implementation in This App:

**Current Protection:**
- **JWT tokens in Authorization header** provide some CSRF protection
  - Evil site can't read tokens from localStorage/sessionStorage
  - But if tokens are in cookies, CSRF is still possible
  
**Additional Protection (CSRF Middleware):**
- CSRF token middleware created in `backend/src/middleware/csrf.js`
- Can be applied to routes that need extra protection
- Uses **Double-Submit Cookie pattern**: token in cookie AND request

**Best Practices:**
- Use `SameSite=Strict` cookies (prevents cross-site cookie sending)
- Use JWT in Authorization header (not cookies) for API calls
- Validate Origin/Referer headers
- Implement CSRF tokens for forms and state-changing operations

---

## HTTPS in Development

### Can you use HTTPS in development?

**Yes!** Here are options:

### Option 1: Self-Signed Certificate (Easiest)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365

# Update server.js
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(port, () => {
  console.log(`HTTPS server on port ${port}`);
});
```

**Note:** Browser will show security warning - click "Advanced" → "Proceed anyway"

### Option 2: mkcert (Recommended for Local Dev)

```bash
# Install mkcert
brew install mkcert  # Mac
# or choco install mkcert  # Windows
# or apt install mkcert  # Linux

# Create local CA
mkcert -install

# Generate certificate for localhost
mkcert localhost 127.0.0.1 ::1

# Use the generated certs in your server
```

### Option 3: Allow HTTP in Development

**Common practice:** Allow HTTP in development, require HTTPS in production

```javascript
// Only enforce HTTPS in production
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect(`https://${req.headers.host}${req.url}`);
}
```

**Recommendation:** Use HTTPS in development with `mkcert` - it's the closest to production without warnings!

---

## Rate Limiting Recommendations

### Password Recovery Rate Limits

**Recommendation: 3 attempts per hour per IP**

This balances:
- **Security:** Prevents abuse/email spam
- **Usability:** Legitimate users can recover password if needed
- **Account enumeration prevention:** Rate limiting combined with "always return success" prevents attackers from discovering valid emails

### Why This Rate?

1. **Prevents spam:** Stops attackers from flooding your system with recovery requests
2. **Prevents email enumeration:** Combined with "always return success", prevents attackers from discovering which emails are registered
3. **User-friendly:** 3 attempts per hour allows legitimate users to request recovery if they mistype email

### IP Address Considerations

**Yes, multiple users can share the same IP!**

Examples:
- Corporate networks (all employees behind NAT)
- Public Wi-Fi (coffee shops, airports)
- VPN services (many users share IPs)
- Mobile carriers (CGNAT - Carrier-Grade NAT)

**Impact:**
- One user's failed attempts could affect others on same IP
- Our rate limits are per-IP, so legitimate users might get blocked

**Mitigations:**
- Use reasonable rate limits (not too strict)
- Consider per-email rate limits combined with per-IP limits
- Provide clear error messages when rate limited
- Implement progressive delays (not hard blocks)

**For this app:**
- Rate limits are per-IP (reasonable for this use case)
- Consider adding per-email limits in future if abuse occurs

---

## Security Checklist

✅ **Implemented:**
- Rate limiting (5 login/15min, 3 register/1hr, 3 recover/1hr)
- Strong password validation (8+ chars, upper, lower, number, symbol)
- Account lockout (5 failed attempts = 30 min lock)
- JWT tokens (access + refresh with expiration)
- Email verification required
- Input sanitization (XSS prevention)
- Password recovery with time-limited tokens (1 hour)
- Session management (token revocation on logout)

⚠️ **To Consider:**
- HTTPS enforcement in production
- CSRF token validation (middleware created, not yet applied)
- Rate limiting per-email (in addition to per-IP)
- CAPTCHA for registration (prevent bot registrations)
- Email sending service (for verification/recovery emails)
- Password complexity checking against common password lists
- Account lockout bypass for admins
- Token refresh rotation (invalidate old refresh token when getting new one)

---

## Questions & Answers

### Q: What are CSRF tokens?
**A:** Random tokens that prevent cross-site request forgery attacks. See explanation above.

### Q: Can multiple users share the same IP?
**A:** Yes! Corporate networks, VPNs, NAT, proxies all cause this. Rate limits account for it.

### Q: Should we use HTTPS in development?
**A:** Recommended but not required. Options: self-signed cert, mkcert, or allow HTTP in dev.

### Q: What rate limit for password recovery?
**A:** 3 attempts per hour per IP balances security and usability.

