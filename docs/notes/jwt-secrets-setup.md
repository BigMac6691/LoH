# JWT Secrets Setup Guide

## Question 1: Setting JWT Secrets in .env File

**Yes, you should put these in a `.env` file** at the root of your project (same level as `package.json`, `backend/`, `frontend/`, etc.)

### Step 1: Create or Update .env File

Create a `.env` file in the root of your project (if it doesn't exist):

```bash
# From the project root
touch .env
```

### Step 2: Generate Secure Secret Values

**For JWT secrets, you need long, random, secure strings.** Here are ways to generate them:

#### Option 1: Using OpenSSL (Recommended - Already on Ubuntu/WSL)

```bash
# Generate JWT_SECRET (64 characters base64 encoded)
openssl rand -base64 64

# Generate JWT_REFRESH_SECRET (different one!)
openssl rand -base64 64
```

**Example output:**
```
9kL3mP8qR2tW5vY0zA6bC1dE4fG7hI9jK2lM5nO8pQ1rS4tU7vW0xY3zA6bC9dE2fG5hI8jK1lM4nO7pQ0rS3tU6vW9xY2zA5bC8dE1fG4hI7jK0lM3nO6pQ9rS2tU5vW8xY1zA4bC7dE0fG3hI6jK9lM2nO5pQ8rS1tU4vW7xY0zA3bC6dE9fG2hI5jK8lM1nO4pQ7rS0tU3vW6xY9zA2bC5dE8fG1hI4jK7lM0nO3pQ6rS9tU2vW5xY8zA1bC4dE7fG0hI3jK6lM9nO2pQ5rS8tU1vW4xY7zA0bC3dE6fG9hI2jK5lM8nO1pQ4rS7tU0vW3xY6zA9bC2dE5fG8hI1jK4lM7nO0pQ3rS6tU9vW2xY5zA8bC1dE4fG7hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA7bC0dE3fG6hI9jK2lM5nO8pQ1rS4tU7vW0xY3zA6bC9dE2fG5hI8jK1lM4nO7pQ0rS3tU6vW9xY2zA5bC8dE1fG4hI7jK0lM3nO6pQ9rS2tU5vW8xY1zA4bC7dE0fG3hI6jK9lM2nO5pQ8rS1tU4vW7xY0zA3bC6dE9fG2hI5jK8lM1nO4pQ7rS0tU3vW6xY9zA2bC5dE8fG1hI4jK7lM0nO3pQ6rS9tU2vW5xY8zA1bC4dE7fG0hI3jK6lM9nO2pQ5rS8tU1vW4xY7zA0bC3dE6fG9hI2jK5lM8nO1pQ4rS7tU0vW3xY6zA9bC2dE5fG8hI1jK4lM7nO0pQ3rS6tU9vW2xY5zA8bC1dE4fG7hI0jK3lM6nO9pQ2rS5tU8vW1xY4zA7bC0dE3fG6hI9jK2lM5nO8pQ1rS4tU7vW0xY3zA6
```

#### Option 2: Using Node.js (if you have Node installed)

```bash
# In Node.js REPL or script
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

#### Option 3: Using Python (if you have Python installed)

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

### Step 3: Add Secrets to .env File

Edit your `.env` file and add the generated secrets:

```env
# JWT Secrets - Keep these SECRET!
JWT_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here
```

**IMPORTANT:**
- **These MUST be different from each other!**
- **Never commit .env to git!** (It's already in .gitignore)
- **Use different secrets for development and production!**
- **Secrets should be at least 32 characters long** (64+ is better)

### Step 4: Make Sure dotenv is Loaded

Check that `backend/server.js` loads dotenv at the top:

```javascript
import 'dotenv/config';  // Load .env file at startup
```

If it's not there, add it as the first import!

---

## What Values to Use for Secrets?

**Requirements:**
- ✅ **Long**: At least 32 characters, preferably 64+
- ✅ **Random**: Generated cryptographically (not predictable)
- ✅ **Different**: JWT_SECRET and JWT_REFRESH_SECRET must be different
- ✅ **Secret**: Never share or commit to version control
- ✅ **Unique**: Use different secrets for dev/staging/production

**Good examples:**
- Base64 encoded random bytes (64+ chars)
- URL-safe random tokens (64+ chars)
- Hex-encoded random bytes (128+ chars)

**Bad examples:**
- ❌ `"my-secret-key"` (too short, not random)
- ❌ `"password123"` (predictable)
- ❌ `"jwt-secret"` (common, not secure)
- ❌ Same value for both secrets (security risk)

---

## Quick Setup Script

You can create a simple script to generate secrets:

```bash
#!/bin/bash
# generate-secrets.sh

echo "# JWT Secrets - Generated $(date)"
echo "JWT_SECRET=$(openssl rand -base64 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64)"
```

Save as `generate-secrets.sh`, make it executable, and run:
```bash
chmod +x generate-secrets.sh
./generate-secrets.sh >> .env
```

---

## Verify Setup

After setting up your `.env` file, verify it's loaded correctly:

```bash
# Start your backend and check console
# You should see the server start without errors
cd backend
npm start
```

If you see errors about JWT_SECRET, check:
1. `.env` file exists in project root
2. `dotenv` is loaded in `server.js`
3. Secrets are set correctly in `.env`

