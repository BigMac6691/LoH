# Install mkcert CA in Windows Browser (from WSL)

## The Problem

Your browser shows "Not Secure" because the `mkcert` certificate isn't trusted. Even though the connection IS encrypted (HTTPS is working), the browser doesn't trust the certificate.

## Solution: Install the CA Certificate

The `mkcert` CA certificate needs to be installed in Windows so your browser (Chrome/Edge) trusts it.

### Step 1: Copy CA Certificate to Windows

From WSL, copy the CA certificate to Windows:

```bash
# Find your Windows username
echo $USER

# Copy CA to Windows Downloads folder
cp ~/.local/share/mkcert/rootCA.pem /mnt/c/Users/YourUsername/Downloads/rootCA.pem
```

**Replace `YourUsername` with your actual Windows username.**

**OR** find your Windows username:
```bash
ls /mnt/c/Users/
```

You'll see folders like:
- `Administrator`
- `YourName`
- etc.

Copy to the correct one:
```bash
cp ~/.local/share/mkcert/rootCA.pem /mnt/c/Users/YourWindowsUsername/Downloads/rootCA.pem
```

### Step 2: Install in Windows

1. **Open File Explorer** in Windows
2. **Navigate to:** `C:\Users\YourUsername\Downloads`
3. **Find:** `rootCA.pem`
4. **Right-click** → **"Install Certificate"**
5. **Choose:**
   - ✅ **"Current User"** (recommended)
   - OR "Local Machine" (requires admin)
6. **Click "Next"**
7. **Select:** ✅ **"Place all certificates in the following store"**
8. **Click "Browse"**
9. **Select:** ✅ **"Trusted Root Certification Authorities"**
10. **Click "OK"**
11. **Click "Next"**
12. **Click "Finish"**
13. **Click "Yes"** to security warning
14. **Click "OK"**

### Step 3: Restart Browser

**Close all browser windows completely**, then reopen and go to:
```
https://localhost:5173
```

### Step 4: Verify

You should now see:
- ✅ **Green lock icon** (🔒)
- ✅ **"Connection is secure"**
- ✅ **No warnings**
- ✅ **HTTPS stays as `https://` (no strikethrough)**

## Alternative: Install via Command Line (Windows)

If you prefer command line:

1. **Open Command Prompt as Administrator** in Windows
2. **Run:**
   ```cmd
   certutil -addstore -f "ROOT" C:\Users\YourUsername\Downloads\rootCA.pem
   ```

## Troubleshooting

### "Certificate already exists"
- That's fine! It means it's already installed.
- Try restarting browser anyway.

### "Access denied"
- Run Command Prompt as Administrator
- Or use "Current User" instead of "Local Machine"

### Still shows "Not Secure" after install
1. **Clear browser cache**
2. **Restart browser completely** (close all windows)
3. **Close all tabs** for `localhost:5173`
4. **Open new tab** and type `https://localhost:5173`
5. **Accept certificate warning once** (if it appears)
6. **Refresh page**

### Can't find rootCA.pem

Check if it exists:
```bash
ls -la ~/.local/share/mkcert/rootCA.pem
```

If not found, check:
```bash
find ~ -name "rootCA.pem" 2>/dev/null
```

Or reinstall CA:
```bash
sudo ~/bin/mkcert -install
```

## Quick Test

After installing, verify in browser:

1. **Go to:** `https://localhost:5173`
2. **Click lock icon** or certificate indicator
3. **Click "Certificate"**
4. **Check "Certificate path":**
   - Should show: `mkcert garry_home@DESKTOP-GJM` in the chain
   - Should be marked as "Trusted"

## Expected Result

**Before:**
- ❌ "Not Secure" message
- ❌ HTTPS with strikethrough
- ❌ Certificate warnings

**After:**
- ✅ Green lock icon
- ✅ "Connection is secure"
- ✅ No warnings
- ✅ All requests use HTTPS

