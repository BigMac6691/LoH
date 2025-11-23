# Install mkcert CA in Windows - Alternative Methods

## Problem
Windows File Explorer doesn't recognize `.pem` files as certificates, so "Install Certificate" doesn't appear.

## Solution Options

### Option 1: Rename to .crt (Easiest)

1. **Copy CA to Windows Downloads as .crt:**
   ```bash
   # In WSL, find your Windows username:
   ls /mnt/c/Users/
   
   # Copy with .crt extension (replace YourWindowsUsername):
   cp ~/.local/share/mkcert/rootCA.pem /mnt/c/Users/YourWindowsUsername/Downloads/rootCA.crt
   ```

2. **In Windows File Explorer:**
   - Go to: `C:\Users\YourUsername\Downloads`
   - Find: `rootCA.crt`
   - **Right-click** → Now you should see **"Install Certificate"** option!
   - Follow the installation steps

### Option 2: Use Windows Certificate Manager (GUI)

1. **Copy CA to Windows:**
   ```bash
   cp ~/.local/share/mkcert/rootCA.pem /mnt/c/Users/YourWindowsUsername/Downloads/rootCA.pem
   ```

2. **In Windows:**
   - Press `Win + R`
   - Type: `certmgr.msc`
   - Press Enter
   - This opens Certificate Manager

3. **Import Certificate:**
   - Expand: **"Trusted Root Certification Authorities"**
   - Right-click on **"Certificates"**
   - Select: **"All Tasks"** → **"Import"**
   - Click **"Next"**
   - Click **"Browse"**
   - **Important:** Change file type dropdown to **"All Files (*.*)"** or **"Certificate Files"**
   - Navigate to: `C:\Users\YourUsername\Downloads`
   - Select: `rootCA.pem` (or `rootCA.crt` if you renamed it)
   - Click **"Open"**
   - Click **"Next"**
   - Select: **"Place all certificates in the following store"**
   - Click **"Browse"**
   - Select: **"Trusted Root Certification Authorities"**
   - Click **"OK"** → **"Next"** → **"Finish"**
   - Click **"Yes"** to security warning
   - Click **"OK"**

### Option 3: Command Line (Fastest)

1. **Copy CA to Windows:**
   ```bash
   cp ~/.local/share/mkcert/rootCA.pem /mnt/c/Users/YourWindowsUsername/Downloads/rootCA.crt
   ```

2. **In Windows:**
   - Press `Win + X`
   - Select: **"Windows PowerShell (Admin)"** or **"Terminal (Admin)"**
   - If prompted, click **"Yes"** to allow changes

3. **Run:**
   ```powershell
   certutil -addstore -f "ROOT" C:\Users\YourUsername\Downloads\rootCA.crt
   ```

   **Replace `YourUsername` with your actual Windows username.**

4. **Should see:**
   ```
   CertUtil: -addstore command completed successfully.
   ```

### Option 4: Double-Click the .crt File

1. **Rename to .crt** (using Option 1 above)

2. **In Windows File Explorer:**
   - Double-click: `rootCA.crt`
   - Certificate dialog opens
   - Click **"Install Certificate"**
   - Choose **"Current User"** → **Next**
   - Select **"Place all certificates in the following store"**
   - Click **"Browse"** → Select **"Trusted Root Certification Authorities"**
   - Click **"OK"** → **Next** → **Finish**
   - Click **"Yes"** → **OK**

## After Installation

1. **Close all browser windows completely**
2. **Reopen browser**
3. **Go to:** `https://localhost:5173`
4. **Should see:** Green lock icon ✅

## Verify Installation

### Check Certificate Manager:
- Press `Win + R`
- Type: `certmgr.msc`
- Navigate to: **Trusted Root Certification Authorities** → **Certificates**
- Look for: **"mkcert garry_home@DESKTOP-GJM"**

### Or Check in Browser:
1. Go to: `https://localhost:5173`
2. Click the lock icon
3. Click **"Certificate"**
4. Check **"Certificate path"** tab
5. Should show the CA in the chain as **"Trusted"**

## Troubleshooting

### "Access Denied" Error
- **Solution:** Run PowerShell/Command Prompt as Administrator
- Right-click → "Run as administrator"

### "File Not Found"
- **Check:** Did you copy to the right location?
- Verify: `C:\Users\YourUsername\Downloads\rootCA.crt` exists

### Still Shows "Not Secure"
1. **Clear browser cache**
2. **Restart browser completely** (close all windows)
3. **Type:** `https://localhost:5173` manually (don't use bookmarks)
4. **Accept certificate warning** if it appears
5. **Refresh page**

### Can't Find Windows Username
Run in WSL:
```bash
ls /mnt/c/Users/
```
You'll see your username folder(s).

