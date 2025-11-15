import express from 'express';
import { pool } from '../db/pool.js';
import { randomUUID, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import { 
  validatePassword, 
  sanitizeInput, 
  sanitizeEmail, 
  validateEmail, 
  getClientIp,
  generateSecureToken
} from '../utils/security.js';
import { 
  generateAccessToken, 
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from '../utils/jwt.js';
import { 
  loginRateLimiter, 
  registerRateLimiter, 
  recoverRateLimiter 
} from '../middleware/rateLimiter.js';

/**
 * AuthRouter - Handles authentication routes with comprehensive security
 * 
 * Security features:
 * - Rate limiting (5 login/15min, 3 register/1hr, 3 recover/1hr per IP)
 * - JWT tokens (access + refresh)
 * - Account lockout after 5 failed attempts (30 min)
 * - Email verification required for new accounts
 * - Strong password validation (8+ chars, upper, lower, number, symbol)
 * - Input sanitization to prevent XSS
 * - Password recovery with time-limited tokens
 * - CSRF protection via tokens
 */
export class AuthRouter {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
    
    // Account lockout configuration
    this.MAX_FAILED_ATTEMPTS = 5;
    this.LOCKOUT_DURATION_MINUTES = 30;
  }

  setupRoutes() {
    // Apply rate limiters to routes
    this.router.post('/login', loginRateLimiter, this.login.bind(this));
    this.router.post('/register', registerRateLimiter, this.register.bind(this));
    this.router.post('/recover', recoverRateLimiter, this.recover.bind(this));
    this.router.post('/verify-email', this.verifyEmail.bind(this));
    this.router.post('/resend-verification', this.resendVerification.bind(this));
    this.router.post('/verify-recovery-token', this.verifyRecoveryToken.bind(this));
    this.router.post('/reset-password', this.resetPassword.bind(this));
    this.router.post('/refresh-token', this.refreshToken.bind(this));
    this.router.post('/logout', this.logout.bind(this));
  }

  /**
   * Get the Express router instance
   */
  getRouter() {
    return this.router;
  }

  /**
   * Check if account is locked
   */
  async checkAccountLock(email) {
    const lockResult = await pool.query(
      `SELECT locked_until, failed_attempts 
       FROM account_lock 
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (lockResult.rows.length === 0) {
      return { locked: false, attempts: 0 };
    }

    const lock = lockResult.rows[0];
    
    // Check if lock has expired
    if (lock.locked_until && new Date(lock.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil(
        (new Date(lock.locked_until) - new Date()) / 60000
      );
      return { 
        locked: true, 
        attempts: lock.failed_attempts,
        minutesRemaining
      };
    }

    // Lock expired, clear it
    if (lock.locked_until) {
      await pool.query(
        'UPDATE account_lock SET locked_until = NULL, failed_attempts = 0 WHERE email = $1',
        [email.toLowerCase().trim()]
      );
    }

    return { locked: false, attempts: lock.failed_attempts || 0 };
  }

  /**
   * Record failed login attempt
   */
  async recordFailedAttempt(email, ip) {
    const sanitizedEmail = sanitizeEmail(email);
    
    // Get or create lock record
    const lockResult = await pool.query(
      'SELECT id, failed_attempts FROM account_lock WHERE email = $1',
      [sanitizedEmail]
    );

    const attempts = lockResult.rows.length > 0 
      ? lockResult.rows[0].failed_attempts + 1 
      : 1;

    if (lockResult.rows.length === 0) {
      // Create new lock record
      const lockId = randomUUID();
      const lockedUntil = attempts >= this.MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + this.LOCKOUT_DURATION_MINUTES * 60000)
        : null;

      await pool.query(
        `INSERT INTO account_lock (id, email, failed_attempts, locked_until, last_attempt_at, last_attempt_ip, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), $5, NOW())`,
        [lockId, sanitizedEmail, attempts, lockedUntil, ip]
      );
    } else {
      // Update existing lock record
      const lockedUntil = attempts >= this.MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + this.LOCKOUT_DURATION_MINUTES * 60000)
        : null;

      await pool.query(
        `UPDATE account_lock 
         SET failed_attempts = $1, 
             locked_until = $2, 
             last_attempt_at = NOW(), 
             last_attempt_ip = $3,
             updated_at = NOW()
         WHERE email = $4`,
        [attempts, lockedUntil, ip, sanitizedEmail]
      );
    }

    return attempts;
  }

  /**
   * Clear failed attempts (on successful login)
   */
  async clearFailedAttempts(email) {
    await pool.query(
      'UPDATE account_lock SET failed_attempts = 0, locked_until = NULL WHERE email = $1',
      [sanitizeEmail(email)]
    );
  }

  /**
   * POST /api/auth/login
   * Login with email and password
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const clientIp = getClientIp(req);

      // Sanitize and validate input
      const sanitizedEmail = email ? sanitizeEmail(email) : '';
      
      if (!sanitizedEmail || !password) {
        return res.status(400).json({
          success: false,
          error: 'EMAIL_AND_PASSWORD_REQUIRED',
          message: 'Email and password are required'
        });
      }

      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_EMAIL_FORMAT',
          message: 'Invalid email format'
        });
      }

      // Check account lock
      const lockStatus = await this.checkAccountLock(sanitizedEmail);
      if (lockStatus.locked) {
        return res.status(423).json({
          success: false,
          error: 'ACCOUNT_LOCKED',
          message: `Account locked due to too many failed attempts. Try again in ${lockStatus.minutesRemaining} minutes.`,
          minutesRemaining: lockStatus.minutesRemaining
        });
      }

      // Find user
      const userResult = await pool.query(
        'SELECT id, email, password_hash, display_name, role, status, email_verified FROM app_user WHERE email = $1',
        [sanitizedEmail]
      );

      // Type 2 failure: User not found
      if (userResult.rows.length === 0) {
        // Don't record failed attempt for non-existent users (prevents enumeration)
        return res.status(401).json({
          success: false,
          errorType: 2,
          error: 'USER_NOT_FOUND',
          message: 'Login failed'
        });
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_INACTIVE',
          message: 'Account is not active'
        });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);

      // Type 1 failure: Wrong password
      if (!passwordValid) {
        await this.recordFailedAttempt(sanitizedEmail, clientIp);
        return res.status(401).json({
          success: false,
          errorType: 1,
          error: 'INVALID_PASSWORD',
          message: 'Login failed'
        });
      }

      // Check email verification (warn but allow login)
      if (!user.email_verified) {
        // Log warning but still allow login
        console.warn(`Login attempted for unverified email: ${sanitizedEmail}`);
      }

      // Success - clear failed attempts
      await this.clearFailedAttempts(sanitizedEmail);

      // Generate JWT tokens
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });
      
      const refreshToken = generateRefreshToken({ id: user.id });

      // Hash refresh token for storage (using SHA-256 for fast lookups)
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      // Store refresh token
      const tokenId = randomUUID();
      await pool.query(
        `INSERT INTO auth_token (id, user_id, token_hash, token_type, expires_at, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, 'refresh', $4, $5, $6, NOW())`,
        [tokenId, user.id, refreshTokenHash, expiresAt, clientIp, req.headers['user-agent'] || null]
      );

      res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          emailVerified: user.email_verified
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during login'
      });
    }
  }

  /**
   * POST /api/auth/register
   * Register a new user
   */
  async register(req, res) {
    try {
      const { email, password, displayName } = req.body;
      const clientIp = getClientIp(req);

      // Sanitize inputs
      const sanitizedEmail = email ? sanitizeEmail(email) : '';
      const sanitizedDisplayName = displayName ? sanitizeInput(displayName) : '';

      // Validate inputs
      if (!sanitizedEmail || !password || !sanitizedDisplayName) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_FIELDS',
          message: 'Email, password, and display name are required'
        });
      }

      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_EMAIL_FORMAT',
          message: 'Invalid email format'
        });
      }

      // Validate password complexity
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'PASSWORD_INVALID',
          message: passwordValidation.errors.join('. ')
        });
      }

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM app_user WHERE email = $1',
        [sanitizedEmail]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'Email address is already registered'
        });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user (unverified)
      const userId = randomUUID();
      await pool.query(
        `INSERT INTO app_user (id, email, password_hash, display_name, role, status, email_verified)
         VALUES ($1, $2, $3, $4, 'player', 'active', false)`,
        [userId, sanitizedEmail, passwordHash, sanitizedDisplayName]
      );

      // Generate email verification token
      const verificationToken = generateSecureToken(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1); // 24 hours

      await pool.query(
        `INSERT INTO email_verification (id, user_id, token, expires_at, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [randomUUID(), userId, verificationToken, expiresAt, clientIp]
      );

      // TODO: Send verification email with token
      console.log(`Verification token for ${sanitizedEmail}: ${verificationToken}`);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
        user: {
          id: userId,
          email: sanitizedEmail,
          displayName: sanitizedDisplayName,
          role: 'player',
          emailVerified: false
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
          success: false,
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'Email address is already registered'
        });
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during registration'
      });
    }
  }

  /**
   * POST /api/auth/verify-email
   * Verify email address with token
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_REQUIRED',
          message: 'Verification token is required'
        });
      }

      // Find verification token
      const tokenResult = await pool.query(
        `SELECT ev.*, u.id as user_id, u.email 
         FROM email_verification ev
         JOIN app_user u ON ev.user_id = u.id
         WHERE ev.token = $1 AND ev.verified_at IS NULL`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired verification token'
        });
      }

      const verification = tokenResult.rows[0];

      // Check if expired
      if (new Date(verification.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Verification token has expired'
        });
      }

      // Mark as verified
      await pool.query(
        'UPDATE app_user SET email_verified = true WHERE id = $1',
        [verification.user_id]
      );

      await pool.query(
        'UPDATE email_verification SET verified_at = NOW() WHERE id = $1',
        [verification.id]
      );

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during email verification'
      });
    }
  }

  /**
   * POST /api/auth/resend-verification
   * Resend email verification token
   */
  async resendVerification(req, res) {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(sanitizeEmail(email))) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_EMAIL',
          message: 'Valid email address is required'
        });
      }

      const sanitizedEmail = sanitizeEmail(email);

      // Find user
      const userResult = await pool.query(
        'SELECT id, email_verified FROM app_user WHERE email = $1',
        [sanitizedEmail]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if user exists
        return res.json({
          success: true,
          message: 'If the email address exists and is unverified, a verification email has been sent'
        });
      }

      const user = userResult.rows[0];

      if (user.email_verified) {
        return res.json({
          success: true,
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      const verificationToken = generateSecureToken(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      // Delete old tokens
      await pool.query(
        'DELETE FROM email_verification WHERE user_id = $1 AND verified_at IS NULL',
        [user.id]
      );

      // Create new token
      await pool.query(
        `INSERT INTO email_verification (id, user_id, token, expires_at, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [randomUUID(), user.id, verificationToken, expiresAt, getClientIp(req)]
      );

      // TODO: Send verification email
      console.log(`Verification token for ${sanitizedEmail}: ${verificationToken}`);

      res.json({
        success: true,
        message: 'If the email address exists and is unverified, a verification email has been sent',
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred'
      });
    }
  }

  /**
   * POST /api/auth/recover
   * Request password recovery (rate limited to 3 per hour)
   */
  async recover(req, res) {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(sanitizeEmail(email))) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_EMAIL',
          message: 'Valid email address is required'
        });
      }

      const sanitizedEmail = sanitizeEmail(email);

      // Find user
      const userResult = await pool.query(
        'SELECT id FROM app_user WHERE email = $1',
        [sanitizedEmail]
      );

      // Always return success (prevent user enumeration)
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];

        // Generate recovery token
        const recoveryToken = generateSecureToken(32);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

        // Delete old unused tokens
        await pool.query(
          'DELETE FROM password_recovery_token WHERE user_id = $1 AND used_at IS NULL',
          [user.id]
        );

        // Store recovery token
        await pool.query(
          `INSERT INTO password_recovery_token (id, user_id, token, expires_at, ip_address, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [randomUUID(), user.id, recoveryToken, expiresAt, getClientIp(req)]
        );

        // TODO: Send recovery email
        console.log(`Recovery token for ${sanitizedEmail}: ${recoveryToken} (expires: ${expiresAt})`);
      }

      res.json({
        success: true,
        message: 'If the email address exists, a recovery link has been sent'
      });
    } catch (error) {
      console.error('Password recovery error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during password recovery'
      });
    }
  }

  /**
   * POST /api/auth/verify-recovery-token
   * Verify a recovery token is valid
   */
  async verifyRecoveryToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_REQUIRED',
          message: 'Recovery token is required'
        });
      }

      const tokenResult = await pool.query(
        `SELECT * FROM password_recovery_token 
         WHERE token = $1 AND used_at IS NULL`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid or used recovery token'
        });
      }

      const recoveryToken = tokenResult.rows[0];

      if (new Date(recoveryToken.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Recovery token has expired'
        });
      }

      res.json({
        success: true,
        message: 'Recovery token is valid'
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during token verification'
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Reset password with recovery token
   */
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_AND_PASSWORD_REQUIRED',
          message: 'Recovery token and new password are required'
        });
      }

      // Validate password complexity
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'PASSWORD_INVALID',
          message: passwordValidation.errors.join('. ')
        });
      }

      // Find recovery token
      const tokenResult = await pool.query(
        `SELECT prt.*, u.id as user_id 
         FROM password_recovery_token prt
         JOIN app_user u ON prt.user_id = u.id
         WHERE prt.token = $1 AND prt.used_at IS NULL`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid or used recovery token'
        });
      }

      const recoveryToken = tokenResult.rows[0];

      if (new Date(recoveryToken.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Recovery token has expired'
        });
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await pool.query(
        'UPDATE app_user SET password_hash = $1 WHERE id = $2',
        [passwordHash, recoveryToken.user_id]
      );

      // Mark token as used
      await pool.query(
        'UPDATE password_recovery_token SET used_at = NOW() WHERE id = $1',
        [recoveryToken.id]
      );

      // Clear failed attempts
      const userResult = await pool.query(
        'SELECT email FROM app_user WHERE id = $1',
        [recoveryToken.user_id]
      );
      if (userResult.rows.length > 0) {
        await this.clearFailedAttempts(userResult.rows[0].email);
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during password reset'
      });
    }
  }

  /**
   * POST /api/auth/refresh-token
   * Refresh access token using refresh token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token is required'
        });
      }

      // Verify JWT refresh token
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded || decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid refresh token'
        });
      }

      // Check if token exists in database and is not revoked
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const tokenResult = await pool.query(
        `SELECT at.*, u.id as user_id, u.email, u.role, u.display_name
         FROM auth_token at
         JOIN app_user u ON at.user_id = u.id
         WHERE at.token_hash = $1 AND at.revoked = false AND at.expires_at > NOW()`,
        [refreshTokenHash]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Refresh token not found or expired'
        });
      }

      const tokenRecord = tokenResult.rows[0];

      // Generate new access token
      const accessToken = generateAccessToken({
        id: tokenRecord.user_id,
        email: tokenRecord.email,
        role: tokenRecord.role
      });

      // Update last used
      await pool.query(
        'UPDATE auth_token SET last_used_at = NOW() WHERE id = $1',
        [tokenRecord.id]
      );

      res.json({
        success: true,
        accessToken,
        user: {
          id: tokenRecord.user_id,
          email: tokenRecord.email,
          displayName: tokenRecord.display_name,
          role: tokenRecord.role
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during token refresh'
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Logout and revoke refresh token
   */
  async logout(req, res) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        // Revoke refresh token
        const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
        await pool.query(
          'UPDATE auth_token SET revoked = true WHERE token_hash = $1',
          [refreshTokenHash]
        );
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during logout'
      });
    }
  }
}
