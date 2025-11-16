# Resetting Password with Multiple WSL Distributions

## Your WSL Setup

When you run `wsl --list`, you see:
```
  NAME            STATE           VERSION
* Ubuntu          Running         2
  docker-desktop  Running         2
```

## What This Means

- **Ubuntu** = Your main Linux distribution (this is what you use for development)
- **docker-desktop** = Docker Desktop's internal WSL distribution (don't modify this!)

## What to Do

**Use "Ubuntu" exactly as shown** - ignore docker-desktop!

---

## Reset Your Password

### In PowerShell (as Administrator):

```powershell
# Use "Ubuntu" exactly as shown in the list
wsl -d Ubuntu -u root passwd garry_home
```

**Important:**
- ✅ Use `Ubuntu` (case-sensitive, exactly as shown)
- ❌ Don't use `docker-desktop` (that's separate, used by Docker)
- ✅ Use `garry_home` (your username)

---

## Why There Are Two Entries

### Ubuntu
- **Purpose:** Your main development environment
- **This is where:** Your files, projects, and user account are
- **Use this one:** For resetting your password ✅

### docker-desktop
- **Purpose:** Docker Desktop's internal WSL distribution
- **Managed by:** Docker Desktop automatically
- **Don't modify:** This is separate from your Ubuntu environment ❌

---

## The Command (Exactly as You Should Run It)

**In Windows PowerShell (as Administrator):**

```powershell
wsl -d Ubuntu -u root passwd garry_home
```

**Steps:**
1. Open PowerShell as Administrator
2. Run the command above
3. Enter your new password when prompted
4. Confirm the new password
5. Done! ✅

---

## Verify It Worked

After resetting, test in your WSL Ubuntu:

```bash
# In WSL (Ubuntu distribution)
sudo whoami
# Enter your new password
# Should see: root
```

---

## Common Questions

### Q: Should I reset the password for docker-desktop?
**A:** No! Leave docker-desktop alone. It's managed by Docker Desktop.

### Q: Does docker-desktop affect my Ubuntu password?
**A:** No, they're completely separate. Your Ubuntu password is independent.

### Q: Which one should I use for development?
**A:** Use Ubuntu - that's your main development environment.

### Q: What if I use "docker-desktop" by mistake?
**A:** Don't do that! Use "Ubuntu" for your password reset.

---

## Summary

When you see two WSL distributions:
- ✅ **Use "Ubuntu"** - this is your main environment
- ❌ **Ignore "docker-desktop"** - that's Docker's internal tool

Your command stays exactly the same:
```powershell
wsl -d Ubuntu -u root passwd garry_home
```

Nothing changes! Just make sure you use "Ubuntu" (exactly as shown in the list). 🎯

