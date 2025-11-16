# Installing mkcert on WSL Ubuntu

## Question 2: Installing mkcert on WSL Ubuntu

### About apt, brew, and choco

- **apt** = Advanced Package Tool (Ubuntu/Debian package manager) ✅ **You already have this!**
- **brew** = Homebrew (macOS package manager) ❌ Not on Linux/WSL
- **choco** = Chocolatey (Windows package manager) ❌ Not on Linux/WSL

### Check if apt is available

**You definitely have apt on Ubuntu!** To verify:

```bash
# Check if apt is installed
which apt

# Check apt version
apt --version

# Or try
apt list --installed
```

**Expected output:**
```
apt 2.4.x (or similar version)
```

If you see version info, you have apt! ✅

---

## Installing mkcert on WSL Ubuntu

### Method 1: Using Snap (Easiest - Recommended)

**Step 1: Check if snap is installed**

```bash
which snap
snap --version
```

**If snap is NOT installed**, install it first:

```bash
sudo apt update
sudo apt install snapd -y
```

**Step 2: Install mkcert via snap**

```bash
sudo snap install mkcert
```

**Step 3: Create symlink (if needed)**

```bash
# Check if mkcert is in PATH
which mkcert

# If not found, create symlink
sudo ln -s /snap/bin/mkcert /usr/local/bin/mkcert
```

**Step 4: Verify installation**

```bash
mkcert --version
```

---

### Method 2: Download Binary Directly (Alternative)

If snap doesn't work for you:

**Step 1: Download the latest release**

```bash
# Download the latest Linux binary
cd /tmp
wget https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64

# Rename it
mv mkcert-v1.4.4-linux-amd64 mkcert

# Make it executable
chmod +x mkcert

# Move to a directory in your PATH
sudo mv mkcert /usr/local/bin/

# Verify
mkcert --version
```

**Note:** Replace `v1.4.4` with the latest version number from: https://github.com/FiloSottile/mkcert/releases

---

### Method 3: Build from Source (Advanced)

```bash
# Install Go if not installed
sudo apt install golang-go -y

# Clone mkcert
git clone https://github.com/FiloSottile/mkcert.git
cd mkcert

# Build
go build -ldflags "-X main.Version=$(git describe --tags)"

# Install
sudo mv mkcert /usr/local/bin/
```

---

## Using mkcert for Local HTTPS

**Step 1: Install local CA (Certificate Authority)**

```bash
mkcert -install
```

This installs a local root certificate that your browser will trust.

**Step 2: Generate certificates for localhost**

```bash
# Generate certificate for localhost and 127.0.0.1
mkcert localhost 127.0.0.1 ::1

# This creates:
# - localhost+2.pem (certificate)
# - localhost+2-key.pem (private key)
```

**Step 3: Update your server to use HTTPS**

Update `backend/server.js`:

```javascript
import https from 'https';
import fs from 'fs';
import path from 'path';

// Load certificates
const options = {
  key: fs.readFileSync(path.join(process.cwd(), '../localhost+2-key.pem')),
  cert: fs.readFileSync(path.join(process.cwd(), '../localhost+2.pem'))
};

// Create HTTPS server
https.createServer(options, app).listen(port, () => {
  console.log(`HTTPS server listening on port ${port}`);
});
```

**Step 4: Access via HTTPS**

```
https://localhost:3000
https://127.0.0.1:3000
```

**No security warnings!** ✅

---

## Troubleshooting

### Snap not working in WSL

If snap doesn't work in WSL, use Method 2 (binary download) instead.

### Permission denied

Make sure you use `sudo` where needed:
```bash
sudo snap install mkcert
sudo mkcert -install
```

### Certificate not trusted

After running `mkcert -install`, restart your browser or WSL:
```bash
# Restart WSL
exit  # Exit WSL
# Then open WSL again from Windows Terminal/Command Prompt
```

### Port already in use

If port 443 is already in use:
```bash
# Use a different port
https.createServer(options, app).listen(8443, () => {
  console.log(`HTTPS server listening on port 8443`);
});
```

Access via: `https://localhost:8443`

---

## Quick Reference Commands

```bash
# Check if apt is available
apt --version

# Install snap (if needed)
sudo apt update && sudo apt install snapd -y

# Install mkcert
sudo snap install mkcert

# Install local CA
sudo mkcert -install

# Generate certificate
mkcert localhost 127.0.0.1 ::1

# Verify installation
mkcert --version
```

---

## Alternative: Use HTTP in Development

If you don't want to set up HTTPS for development, that's fine! The app will work on HTTP (`http://localhost:3000`). Just make sure to use HTTPS in production.

In `backend/server.js`, you can add:

```javascript
// Only enforce HTTPS in production
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect(`https://${req.headers.host}${req.url}`);
}
```

This allows HTTP in development but requires HTTPS in production.

