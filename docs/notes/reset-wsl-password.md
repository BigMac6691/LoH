# How to Reset Your WSL Ubuntu Password

## Problem
You forgot your WSL Ubuntu password and can't use `sudo` commands.

## Solution: Reset Password from Windows

Since WSL runs on Windows, you can reset your password using Windows PowerShell (as Administrator).

---

## Method 1: Reset Password Using PowerShell (Easiest)

### Step 1: Open Windows PowerShell as Administrator

**From Windows:**
1. Press `Windows Key + X`
2. Select "Windows PowerShell (Admin)" or "Terminal (Admin)"
3. Click "Yes" when asked for permission

### Step 2: List Your WSL Distributions

```powershell
wsl --list --verbose
```

**Expected output:**
```
  NAME      STATE           VERSION
* Ubuntu    Running         2
```

Note the distribution name (usually "Ubuntu" or "Ubuntu-20.04" or "Ubuntu-22.04").

### Step 3: Reset Password as Root

```powershell
# Replace "Ubuntu" with your distribution name
# Replace "your_username" with your WSL username (run 'whoami' in WSL to find out)

wsl -d Ubuntu -u root passwd your_username
```

**Example:**
If your username is `garry_home`:
```powershell
wsl -d Ubuntu -u root passwd garry_home
```

This will:
1. Open WSL as root user (no password needed!)
2. Ask you to enter a new password
3. Confirm the new password

### Step 4: Verify New Password

Close and reopen your WSL terminal, then try:
```bash
sudo whoami
```

Enter your new password. If it works, you should see `root`! ✅

---

## Method 2: Change Default User (Alternative)

If Method 1 doesn't work, you can change the default user to root:

### Step 1: Open PowerShell as Administrator

### Step 2: Change Default User to Root

```powershell
# Replace "Ubuntu" with your distribution name
ubuntu config --default-user root
```

Or:
```powershell
wsl -d Ubuntu config --default-user root
```

### Step 3: Open WSL (Now as Root)

Now when you open WSL, you'll be logged in as root (no password needed).

### Step 4: Reset Password

In WSL (now running as root):
```bash
# Replace "your_username" with your username
passwd your_username

# Or change root password
passwd root
```

### Step 5: Change Default User Back (Optional)

After resetting your password, change the default user back:

```powershell
# In PowerShell (as Admin)
ubuntu config --default-user your_username
```

---

## Method 3: Reset Password Directly in WSL (If You Can Access It)

If you can still access WSL (just don't remember password for sudo):

### Option A: Reset from Root Shell

1. In WSL, if you can access it without sudo, try to get root access:
   ```bash
   # Try to switch to root (might work without password)
   su -
   ```

2. If that doesn't work, use Method 1 or 2 above.

### Option B: Create New User

If you can get root access somehow:
```bash
# As root
adduser new_username
usermod -aG sudo new_username
```

Then log in as the new user.

---

## Finding Your Username

If you don't know your WSL username, you can find it:

**From WSL:**
```bash
whoami
```

**From Windows PowerShell:**
```powershell
wsl whoami
```

**From Windows Command Prompt:**
```cmd
wsl whoami
```

---

## Quick Reference

### Most Common Solution:

1. Open **Windows PowerShell as Administrator**
2. Run: `wsl -d Ubuntu -u root passwd your_username`
3. Enter new password twice
4. Done! ✅

### If You Don't Know Your Distribution Name:

```powershell
# List all WSL distributions
wsl --list

# Output shows names like: Ubuntu, Ubuntu-20.04, etc.
```

### If You Don't Know Your Username:

```powershell
# From PowerShell
wsl whoami

# Or from WSL
whoami
```

---

## After Resetting Password

Once you've reset your password, you can:

1. **Use sudo normally:**
   ```bash
   sudo apt update
   sudo snap install mkcert
   ```

2. **Install mkcert system-wide (if you want):**
   ```bash
   sudo snap install mkcert
   sudo mkcert -install
   ```

3. **Or just keep using the user-installed mkcert** (no sudo needed, already installed in ~/bin)

---

## Troubleshooting

### "The requested operation requires elevation"

**Solution:** Make sure PowerShell is running as Administrator.

### "The system cannot find the file specified"

**Solution:** 
- Check the distribution name: `wsl --list`
- Use the exact name shown (case-sensitive)
- Try: `wsl -d Ubuntu-22.04 -u root passwd username` (with version number)

### "passwd: Authentication token manipulation error"

**Solution:** 
- Make sure you're using the correct username
- Try: `passwd` (to change root password first)

### "No distribution specified"

**Solution:**
```powershell
# List distributions
wsl --list

# Use exact name from the list
wsl -d "Ubuntu-22.04" -u root passwd username
```

---

## Security Note

After resetting your password, make sure to:
- ✅ Use a strong, memorable password
- ✅ Write it down somewhere safe (password manager, secure note)
- ✅ Consider using a password manager for all your passwords

---

## Alternative: Don't Reset, Just Use Without Sudo

Remember, for most development tasks, you don't need sudo!

- ✅ mkcert is already installed in `~/bin` (no sudo needed)
- ✅ Node.js and npm work without sudo
- ✅ Most development tools work without sudo

You only need sudo for:
- System package installation (`apt install`)
- Installing system-wide tools (`snap install`)
- Installing local CA (`mkcert -install`)

But you can work around all of these! 🎉

