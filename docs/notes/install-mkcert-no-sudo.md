# Installing mkcert Without Sudo (No Password Needed)

## Problem
You need to install mkcert but don't remember your sudo password or don't want to use sudo.

## Solution: Install to User Directory

You can install mkcert to your home directory (`~/bin`) - no sudo needed!

### Step 1: Download mkcert

```bash
cd /tmp
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 -O mkcert
chmod +x mkcert
```

### Step 2: Install to Your Home Directory

```bash
# Create ~/bin directory if it doesn't exist
mkdir -p ~/bin

# Move mkcert there
mv mkcert ~/bin/
```

### Step 3: Add to PATH

Add `~/bin` to your PATH so you can use `mkcert` from anywhere:

```bash
# Add to your shell config
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc

# Reload your shell config
source ~/.bashrc

# Or just restart your terminal
```

### Step 4: Verify Installation

```bash
mkcert --version
```

You should see the version number! ✅

### Step 5: Install Local CA (Optional - Still Works Without Root!)

For the local CA installation (`mkcert -install`), you typically need sudo. However, you can still use mkcert without installing the CA:

**Without CA installation:**
- Generate certificates normally
- Your browser will show security warnings (you can click "Advanced" → "Proceed anyway")
- Works fine for development

**To install CA (requires password):**
```bash
mkcert -install  # This still needs sudo, but you can skip it
```

**Alternative: Skip CA installation**
- Just generate certificates: `mkcert localhost 127.0.0.1`
- Accept browser warnings for development (they're harmless)

---

## Using mkcert Without CA Installation

Even without installing the CA, you can still use mkcert:

```bash
# Generate certificates
mkcert localhost 127.0.0.1 ::1

# This creates:
# - localhost+2.pem (certificate)
# - localhost+2-key.pem (private key)
```

Your browser will show a security warning, but for development this is fine! Just click "Advanced" → "Proceed anyway".

---

## Complete Installation Script (No Sudo)

Here's a complete script you can run:

```bash
#!/bin/bash
# Install mkcert without sudo

# Download
cd /tmp
wget -q https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 -O mkcert
chmod +x mkcert

# Install to home directory
mkdir -p ~/bin
mv mkcert ~/bin/

# Add to PATH
if ! grep -q 'export PATH="$HOME/bin:$PATH"' ~/.bashrc; then
    echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
fi

# Verify
~/bin/mkcert --version

echo "✅ mkcert installed to ~/bin"
echo "📝 You may need to run: source ~/.bashrc"
echo "📝 Or restart your terminal"
```

---

## Alternative: Reset Your Password (If You Want Sudo)

If you want to be able to use sudo in the future, you can reset your WSL password:

### From Windows PowerShell (Run as Administrator):

```powershell
# List WSL distributions
wsl --list

# Reset password for your Ubuntu distribution
wsl -d Ubuntu -u root passwd your_username

# Replace:
# - "Ubuntu" with your WSL distribution name
# - "your_username" with your WSL username (run `whoami` in WSL to find out)
```

Then set a new password you'll remember.

---

## Recommended Approach

**For development purposes:** Install to `~/bin` (no sudo needed) ✅

- ✅ No password needed
- ✅ Works immediately
- ✅ Good enough for development
- ⚠️ Browser will show warnings (but you can proceed anyway)

**For production-like setup:** Reset password and install system-wide

- ✅ No browser warnings
- ✅ System-wide installation
- ❌ Requires password

---

## Quick Reference

```bash
# Install without sudo
cd /tmp
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 -O mkcert
chmod +x mkcert
mkdir -p ~/bin && mv mkcert ~/bin/
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Use it (even without CA installation)
cd ~/projects/LoH
mkcert localhost 127.0.0.1 ::1

# This creates certificates you can use!
```

---

## Note: You Don't Actually Need mkcert!

If all this seems complicated, **you don't need HTTPS in development!** 

The app will work perfectly fine on HTTP (`http://localhost:3000`). Just make sure to use HTTPS in production (which your hosting provider will handle).

You can skip mkcert entirely and just use HTTP for development! 🎉

