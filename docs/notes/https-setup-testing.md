# HTTPS Setup and Testing Guide

## HTTPS Configuration

The server is now configured to use HTTPS in development when certificates are available.

### How It Works

1. **Development Mode (default):**
   - Server checks for certificates (`localhost+1.pem` and `localhost+1-key.pem`)
   - If found → Uses HTTPS
   - If not found → Falls back to HTTP

2. **Production Mode:**
   - Uses HTTP (or HTTPS if configured by hosting provider)
   - Certificates are typically handled by load balancer/CDN

### Environment Variables

You can control HTTPS behavior:

```bash
# In .env file:

# Force HTTPS in development (default behavior)
USE_HTTPS=true

# Disable HTTPS even in development
USE_HTTPS=false

# Or let it auto-detect based on NODE_ENV
NODE_ENV=development  # Will try HTTPS if certificates exist
```

---

## Testing HTTPS

### Step 1: Start Your Server

```bash
cd backend
npm start
```

**Expected output:**
```
🔒 HTTPS server listening on port 3000
🌐 Access your API at: https://localhost:3000
📝 Health check: https://localhost:3000/api/health
```

### Step 2: Test in Browser

**Open your browser and go to:**
```
https://localhost:3000/api/health
```

**What to expect:**
- ✅ **Green lock icon** (if CA is installed)
- ✅ **No security warnings** (if CA is installed)
- ✅ **Response:** `{"ok":true}`

**If CA is NOT installed:**
- ⚠️ **Security warning** (click "Advanced" → "Proceed anyway")
- ✅ **Still works!** (certificates are valid, just not trusted by browser)

### Step 3: Test API Endpoints

**Login endpoint:**
```
https://localhost:3000/api/auth/login
```

**Health check:**
```
https://localhost:3000/api/health
```

---

## Testing URLs

### ✅ Correct:
- `https://localhost:3000`
- `https://localhost:3000/api/health`
- `https://127.0.0.1:3000`

### ❌ Wrong:
- `HTTPS://localhost:3000` (uppercase doesn't work in URLs)
- `http://localhost:3000` (will fail if server is using HTTPS)
- `https://localhost` (missing port - won't work)

**Note:** URLs are case-sensitive for the protocol. Use lowercase: `https://`

---

## Frontend Configuration

### Update Frontend to Use HTTPS

If your frontend is making API calls, you may need to update the API URL:

**Before (HTTP):**
```javascript
const API_URL = 'http://localhost:3000';
```

**After (HTTPS):**
```javascript
const API_URL = 'https://localhost:3000';
```

**Or make it dynamic:**
```javascript
const API_URL = window.location.protocol === 'https:' 
  ? 'https://localhost:3000' 
  : 'http://localhost:3000';
```

---

## Troubleshooting

### "Certificate files not found"

**Solution:**
```bash
cd ~/projects/LoH
mkcert localhost 127.0.0.1
```

This creates the certificate files in the project root.

### "ERR_SSL_VERSION_OR_CIPHER_MISMATCH"

**Possible causes:**
- Wrong port
- Certificates not found
- Browser cache issue

**Solution:**
1. Check certificates exist: `ls -la localhost+1*.pem`
2. Clear browser cache
3. Try incognito/private mode
4. Restart server

### Browser shows "Not Secure"

**This is normal if:**
- CA is not installed (`mkcert -install`)
- You're using a different certificate

**Solutions:**
1. Install CA: `sudo ~/bin/mkcert -install`
2. Restart browser
3. Or just accept the warning (safe for development)

### "Connection refused"

**Possible causes:**
- Server not running
- Wrong port
- Using HTTP instead of HTTPS

**Solution:**
1. Check server is running: `npm start` in backend/
2. Verify port: Check console output
3. Use correct URL: `https://localhost:3000` (not `http://`)

---

## Quick Test Checklist

- [ ] Server starts with HTTPS message
- [ ] Browser shows `https://localhost:3000/api/health`
- [ ] Green lock icon (or warning you can accept)
- [ ] API responds with `{"ok":true}`

---

## Development vs Production

### Development
- ✅ Uses HTTPS with mkcert certificates
- ✅ Local CA trusted by browser
- ✅ Works on `localhost` and `127.0.0.1`

### Production
- ✅ Typically uses HTTP (HTTPS handled by load balancer/CDN)
- ✅ Or configure with production certificates
- ✅ SSL certificates provided by hosting service (Let's Encrypt, etc.)

---

## Summary

**To test HTTPS:**
1. Start server: `npm start` in `backend/`
2. Open browser: `https://localhost:3000/api/health`
3. Accept warning (if shown) or enjoy green lock! ✅

**Note:** Use lowercase `https://` in URLs, not `HTTPS://`

