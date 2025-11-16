# Fix: HTTPS Not Working - "Not Secure" with Strikethrough

## Problem

You see:
- ❌ "Not Secure" message
- ❌ HTTPS with strikethrough (showing `http://`)
- ❌ No lock icon

## Cause

The Vite dev server was started **before** we added HTTPS configuration, so it's still running in HTTP mode.

## Solution

### Step 1: Restart the Frontend Dev Server

**Stop the current server:**
1. Go to the terminal where `npm run dev` is running
2. Press `Ctrl+C` to stop it

**Start it again:**
```bash
cd ~/projects/LoH/frontend
npm run dev
```

### Step 2: Check Console Output

When you restart, you should see in the terminal:
```
🔒 Frontend: HTTPS enabled with certificates
Local:   https://localhost:5173/
Network: use --host to expose
```

**If you see:**
```
⚠️  Frontend: Certificate files not found, using HTTP
```
→ The certificates aren't found (but we know they exist, so this shouldn't happen)

### Step 3: Access via HTTPS

**Make sure you're using HTTPS in the URL:**
```
https://localhost:5173
```

**NOT:**
```
http://localhost:5173  ❌
```

### Step 4: Accept Certificate Warning (First Time)

1. Browser will show: "Your connection is not private" or "Not Secure"
2. Click **"Advanced"** button
3. Click **"Proceed to localhost (unsafe)"** or **"Accept the Risk and Continue"**
4. This is safe for localhost with mkcert certificates

### Step 5: Verify It's Working

After accepting the warning, you should see:
- ✅ `https://localhost:5173` (no strikethrough)
- ✅ Lock icon (🔒) or "Not Secure" but working
- ✅ Page loads correctly

**Note:** If the CA isn't installed, you'll still see "Not Secure" but the connection IS encrypted. The lock icon appears only if the CA is trusted.

## If Still Not Working

### Check 1: Is the server actually using HTTPS?

Look at the terminal output when starting:
- ✅ Should say: `Local: https://localhost:5173/`
- ❌ If it says: `Local: http://localhost:5173/` → HTTPS not enabled

### Check 2: Certificate Path

Verify the config can find certificates:
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

### Check 3: Browser Cache

1. Clear browser cache
2. Try incognito/private mode
3. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

### Check 4: Direct HTTPS Access

**Don't let the browser auto-redirect.** Type:
```
https://localhost:5173
```

And press Enter. Don't just click a bookmark that might be `http://`.

## Expected Behavior

### With HTTPS Working:
- URL shows: `https://localhost:5173` (no strikethrough)
- Lock icon or "Not Secure" (both mean HTTPS is active)
- Connection is actually encrypted

### With HTTPS NOT Working:
- URL shows: `http://localhost:5173` (strikethrough on https)
- "Not Secure" warning
- Connection is unencrypted

## Quick Test

After restarting, try:
```bash
curl -k https://localhost:5173
```

Should return HTML (the page). If it fails, HTTPS isn't working.

