# Mixed Content Issue: HTTP Requests on HTTPS Page

## Problem

Your request headers show:
```
GET / HTTP/1.1
Referer: https://localhost:5173/
```

This means:
- ✅ Page loads over HTTPS (`Referer: https://localhost:5173/`)
- ❌ But requests are going over HTTP (`GET / HTTP/1.1`)

## Root Cause

When Vite is configured with HTTPS, it **should only** serve HTTPS. However, something is causing HTTP requests to work, which means either:

1. **Vite is serving both HTTP and HTTPS** (unlikely but possible)
2. **Browser is making HTTP requests** even though page is HTTPS (mixed content)
3. **Server console shows wrong protocol** (need to verify)

## Diagnosis Steps

### Step 1: Check Server Console Output

When you start `npm run dev`, what does it say?

**✅ Should say:**
```
🔒 Frontend: HTTPS enabled with certificates
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   https://localhost:5173/
```

**❌ If it says:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```
→ HTTPS is NOT enabled!

### Step 2: Test HTTP Access

Try accessing `http://localhost:5173` directly:

**If HTTP fails:**
- ✅ This is correct! HTTPS-only means HTTP should fail
- The issue is that your browser is making HTTP requests somehow

**If HTTP works:**
- ❌ Vite is serving both HTTP and HTTPS
- This shouldn't happen with our config
- Need to verify certificates are being loaded

### Step 3: Clear Browser Cache and Test

1. **Clear browser cache completely**
2. **Close all tabs** for `localhost:5173`
3. **Open new tab**
4. **Type:** `https://localhost:5173` (type it, don't use bookmarks)
5. **Press Enter**
6. **Accept certificate warning**
7. **Check Network tab** - what protocol are requests using?

## Solution

### If HTTP Access Works (Vite serving both):

The certificates might not be loading correctly. Check:

```bash
cd ~/projects/LoH/frontend
node -e "
const fs = require('fs');
const path = require('path');
const __dirname = path.resolve('.');
const certPath = path.resolve(__dirname, '..');
const keyFile = path.join(certPath, 'localhost+1-key.pem');
const certFile = path.join(certPath, 'localhost+1.pem');
console.log('Key exists:', fs.existsSync(keyFile));
console.log('Cert exists:', fs.existsSync(certFile));
"
```

Should output:
```
Key exists: true
Cert exists: true
```

### If HTTP Access Fails (HTTPS-only, but browser uses HTTP):

This is a browser issue. The browser is somehow making HTTP requests even though the page is HTTPS.

**Solution:**
1. **Force HTTPS in browser:**
   - Type `https://localhost:5173` explicitly
   - Don't let browser auto-complete to `http://`
   
2. **Check for bookmarks:**
   - Delete any bookmarks for `http://localhost:5173`
   - Create new bookmark for `https://localhost:5173`

3. **Check browser settings:**
   - Some browsers auto-downgrade if certificate isn't trusted
   - Accept the certificate warning first
   - Then refresh

## Expected Behavior

**With HTTPS properly configured:**
- ✅ `https://localhost:5173` → Works
- ❌ `http://localhost:5173` → Should fail (connection refused or timeout)
- ✅ All requests in Network tab show `https://`
- ✅ Protocol column shows `h2` or `http/2.0`

## Quick Fix Test

1. **Stop the dev server** (Ctrl+C)
2. **Restart it:**
   ```bash
   cd ~/projects/LoH/frontend
   npm run dev
   ```
3. **Look at console** - does it say `https://localhost:5173/`?
4. **If yes:** Open browser, type `https://localhost:5173` manually
5. **Check Network tab** - all requests should show HTTPS

**Share what you see in the server console when it starts!**

