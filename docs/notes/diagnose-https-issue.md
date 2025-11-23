# Diagnose HTTPS "Not Secure" Issue

## What's Happening

Your server IS serving HTTPS correctly (curl test confirmed), but the browser shows "Not Secure" with strikethrough on HTTPS. This usually means:

✅ **Connection IS encrypted (HTTPS is working)**
❌ **But certificate isn't trusted by the browser**

## Step 1: Check Server Console

Look at the terminal where `npm run dev` is running. You should see:

**✅ Good (HTTPS enabled):**
```
🔒 Frontend: HTTPS enabled with certificates
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   https://localhost:5173/
  ➜  Network: use --host to expose
```

**❌ Bad (HTTP only):**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**What do you see?** Write down what the console says.

## Step 2: Check Browser Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Refresh the page
4. Click on the first request (usually `localhost:5173` or `index.html`)

**Look at the request details:**

**✅ Good (HTTPS):**
- **Protocol:** `h2` or `http/2.0` or `http/1.1` (but with HTTPS)
- **Scheme:** `https`
- **Security:** "Connection is secure" or certificate info

**❌ Bad (HTTP):**
- **Protocol:** `http/1.1` 
- **Scheme:** `http`
- **Security:** Not secure

**What do you see?** Write down the Protocol and Scheme.

## Step 3: Check Browser Certificate

1. Click the lock icon or "Not Secure" in the address bar
2. Click **"Certificate"** or **"Certificate (Invalid)"**
3. Look at certificate details

**What issuer do you see?**
- Should be: `mkcert garry_home@DESKTOP-GJM`
- If different, that's the problem

## Step 4: Verify CA Installation

The certificate is signed by `mkcert garry_home@DESKTOP-GJM`. For the browser to trust it, the CA must be installed.

**Check if CA is installed in browser:**

### Chrome:
1. Settings → Privacy and Security → Security
2. Scroll to "Manage certificates"
3. Click "Authorities" tab
4. Look for `mkcert garry_home@DESKTOP-GJM`

### Edge:
1. Settings → Privacy, search, and services → Security
2. Manage certificates → Trusted Root Certification Authorities
3. Look for `mkcert garry_home@DESKTOP-GJM`

**Is it there?** If not, you need to install it.

## Step 5: Install CA in Browser (If Not Found)

If the CA isn't in the browser's trust store:

### Chrome/Edge on Linux (WSL):
```bash
# Find the CA file
ls -la ~/.local/share/mkcert/rootCA.pem

# Copy to Windows (if using WSL)
# Then install in Windows:
# - Double-click rootCA.pem
# - Click "Install Certificate"
# - Select "Current User" or "Local Machine"
# - Place in "Trusted Root Certification Authorities"
# - Click OK
```

**OR** reinstall the CA:
```bash
sudo ~/bin/mkcert -install
```

## The Real Issue: Browser Trust

Even if the connection IS encrypted:
- ✅ Data is secure
- ❌ Browser shows "Not Secure" because cert isn't trusted
- ⚠️ This is **cosmetic** - the connection is still encrypted!

**However:** If you see strikethrough on HTTPS, the browser might be trying HTTP instead. Let's verify:

## Quick Test: Force HTTPS

1. Type this in address bar: `https://localhost:5173`
2. Press Enter (don't use bookmarks)
3. Accept certificate warning if it appears
4. Check if URL stays as `https://` (no strikethrough)

## What "Not Secure" Actually Means

**If connection IS encrypted:**
- Data is secure ✅
- Browser just doesn't trust the certificate
- You'll see "Not Secure" but connection works

**If connection is NOT encrypted:**
- Data is NOT secure ❌
- HTTP is being used
- You'll see `http://` in URL

## Expected Behavior with mkcert

**After installing CA in browser:**
- ✅ Green lock icon
- ✅ "Connection is secure"
- ✅ No warnings

**Before installing CA (or if not trusted):**
- ⚠️ Lock icon with warning
- ⚠️ "Not Secure" message
- ⚠️ But connection IS still encrypted!

## Next Steps

1. **Check server console** - Does it say `https://localhost:5173/`?
2. **Check Network tab** - Is Protocol `h2` and Scheme `https`?
3. **Check certificate** - Is issuer `mkcert garry_home@DESKTOP-GJM`?
4. **Install CA in browser** if needed

**Share the results** and I can help fix the specific issue!

