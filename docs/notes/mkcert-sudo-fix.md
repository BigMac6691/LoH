# Fix: sudo mkcert: command not found

## Problem

When you run `sudo mkcert -install`, you get:
```
sudo: mkcert: command not found
```

## Why This Happens

- ✅ `mkcert` works normally because it's in `~/bin/` which is in your user PATH
- ❌ `sudo` uses root's PATH, which doesn't include `~/bin/`
- ❌ So `sudo mkcert` can't find the command

## Solution: Use Full Path

Instead of `sudo mkcert`, use the full path:

```bash
sudo ~/bin/mkcert -install
```

This tells sudo exactly where to find mkcert!

---

## Step-by-Step Fix

### Step 1: Find mkcert Location

```bash
which mkcert
```

**Expected output:**
```
/home/garry_home/bin/mkcert
```

Or:
```
~/bin/mkcert
```

### Step 2: Use Full Path with Sudo

```bash
# Use the full path
sudo ~/bin/mkcert -install

# Or if that doesn't work:
sudo /home/garry_home/bin/mkcert -install
```

### Step 3: Enter Your Password

Enter your password when prompted (if you've reset it).

---

## Alternative Solutions

### Solution 1: Use Full Path (Recommended) ✅

```bash
sudo ~/bin/mkcert -install
```

This works because you're explicitly telling sudo where to find mkcert.

### Solution 2: Copy to System Directory (If You Have Sudo)

If you want mkcert available system-wide:

```bash
# First, install CA (using full path)
sudo ~/bin/mkcert -install

# Then, optionally copy to system directory
sudo cp ~/bin/mkcert /usr/local/bin/

# Now sudo mkcert will work
sudo mkcert -install  # This would work now, but not necessary
```

But since you already installed it, Solution 1 is easier!

### Solution 3: Skip CA Installation (No Sudo Needed!)

You can skip the CA installation entirely:

1. **Skip this step:** Don't run `mkcert -install`
2. **Just generate certificates:**
   ```bash
   cd ~/projects/LoH
   mkcert localhost 127.0.0.1 ::1
   ```
3. **Accept browser warnings** - they're harmless for development!

---

## Complete Workflow

### If You Have Sudo Access:

```bash
# 1. Install CA (using full path)
sudo ~/bin/mkcert -install

# 2. Generate certificates
cd ~/projects/LoH
mkcert localhost 127.0.0.1 ::1
```

### If You Don't Have Sudo Access:

```bash
# 1. Skip CA installation
# (Just proceed to step 2)

# 2. Generate certificates
cd ~/projects/LoH
mkcert localhost 127.0.0.1 ::1

# 3. Accept browser warnings when accessing https://localhost:3000
```

---

## Quick Reference

**Problem:** `sudo mkcert: command not found`

**Solution:** Use full path
```bash
sudo ~/bin/mkcert -install
```

**Or:** Skip CA installation entirely (certificates still work!)

---

## Verification

After running `sudo ~/bin/mkcert -install`, you should see:

```
Created a new local CA at "/home/garry_home/.local/share/mkcert" ✨
Installing to system store...
```

Then you can verify:
```bash
# Test that mkcert works
mkcert --version

# Should show: v1.4.4
```

---

## Summary

**The Fix:**
```bash
# Instead of: sudo mkcert -install
# Use: 
sudo ~/bin/mkcert -install
```

**Or:** Skip CA installation - your certificates will still work! ✅

