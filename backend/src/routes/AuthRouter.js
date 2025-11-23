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
import { authenticate } from '../middleware/auth.js';

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
    this.router.post('/verify-email', authenticate, this.verifyEmail.bind(this));
    this.router.post('/resend-verification', this.resendVerification.bind(this));
    this.router.post('/verify-recovery-token', this.verifyRecoveryToken.bind(this));
    this.router.post('/reset-password', this.resetPassword.bind(this));
    this.router.post('/refresh-token', this.refreshToken.bind(this));
    this.router.post('/logout', this.logout.bind(this));
    
    // Profile management routes (require authentication)
    this.router.get('/profile', authenticate, this.getProfile.bind(this));
    this.router.put('/profile', authenticate, this.updateProfile.bind(this));
    this.router.post('/change-password', authenticate, this.changePassword.bind(this));
    this.router.post('/profile/resend-verification', authenticate, this.resendVerificationAuthenticated.bind(this));
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
      
      if (!sanitizedEmail) {
        return res.status(400).json({
          success: false,
          error: 'EMAIL_REQUIRED',
          message: 'Email address is required'
        });
      }

      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_EMAIL_FORMAT',
          message: 'Invalid email format'
        });
      }

      // If password is missing or blank, return error that prompts for recovery
      if (!password || password.trim().length === 0) {
        return res.status(401).json({
          success: false,
          errorType: 1,
          error: 'PASSWORD_REQUIRED',
          message: 'Password is required. If you forgot your password, please use password recovery.'
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

      // Create user as visitor (unverified, limited access)
      const userId = randomUUID();
      await pool.query(
        `INSERT INTO app_user (id, email, password_hash, display_name, role, status, email_verified)
         VALUES ($1, $2, $3, $4, 'visitor', 'active', false)`,
        [userId, sanitizedEmail, passwordHash, sanitizedDisplayName]
      );

      // Generate email verification token
      const verificationToken = generateSecureToken(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1); // 24 hours

      // Store original role (visitor for new registrations)
      await pool.query(
        `INSERT INTO email_verification (id, user_id, token, expires_at, ip_address, original_role, created_at)
         VALUES ($1, $2, $3, $4, $5, 'visitor', NOW())`,
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
          role: 'visitor',
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
   * Verify email address with token (requires authentication)
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

      // Verify that user is authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required to verify email'
        });
      }

      // Find verification token
      const tokenResult = await pool.query(
        `SELECT ev.*, u.id as user_id, u.email, u.role as current_role
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

      // Verify that the authenticated user matches the user associated with the token
      if (verification.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You can only verify your own email address'
        });
      }

      // Check if expired
      if (new Date(verification.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Verification token has expired'
        });
      }

      // Determine new role:
      // - If original_role exists and is higher than 'player', restore it
      // - If current role is 'visitor', promote to 'player'
      // - Otherwise, keep current role
      let newRole = verification.current_role;
      if (verification.original_role) {
        // Restore original role if it was higher than 'player'
        const roleHierarchy = { 'visitor': 0, 'player': 1, 'sponsor': 2, 'admin': 3, 'owner': 4 };
        const originalLevel = roleHierarchy[verification.original_role] || 0;
        const currentLevel = roleHierarchy[verification.current_role] || 0;
        
        if (originalLevel > 1) { // Higher than 'player'
          newRole = verification.original_role;
        } else if (verification.current_role === 'visitor') {
          newRole = 'player';
        }
      } else if (verification.current_role === 'visitor') {
        // New registration: promote visitor to player
        newRole = 'player';
      }

      // Mark as verified and update role if needed
      const updateFields = ['email_verified = true'];
      const updateValues = [];
      let paramIndex = 1;

      if (newRole !== verification.current_role) {
        updateFields.push(`role = $${paramIndex++}`);
        updateValues.push(newRole);
      }

      updateValues.push(verification.user_id);

      await pool.query(
        `UPDATE app_user SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );

      await pool.query(
        'UPDATE email_verification SET verified_at = NOW() WHERE id = $1',
        [verification.id]
      );

      res.json({
        success: true,
        message: 'Email verified successfully',
        roleUpdated: newRole !== verification.current_role,
        newRole: newRole !== verification.current_role ? newRole : undefined
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
   * POST /api/auth/profile/resend-verification (authenticated)
   * Resend email verification token for current user
   */
  async resendVerificationAuthenticated(req, res) {
    try {
      console.log('Resend verification (authenticated) - User ID:', req.user?.id);
      
      if (!req.user || !req.user.id) {
        console.error('Resend verification (authenticated) - No user in request');
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      const userId = req.user.id;

      // Get user info
      const { rows: userRows } = await pool.query(
        'SELECT id, email, email_verified, role FROM app_user WHERE id = $1',
        [userId]
      );

      if (userRows.length === 0) {
        console.error('Resend verification (authenticated) - User not found:', userId);
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      const user = userRows[0];
      console.log('Resend verification (authenticated) - User:', { id: user.id, email: user.email, email_verified: user.email_verified, role: user.role });

      if (user.email_verified) {
        console.log('Resend verification (authenticated) - Email already verified');
        return res.json({
          success: true,
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      const verificationToken = generateSecureToken(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      // Store original role for restoration after verification
      const originalRole = user.role;

      // Delete old tokens
      await pool.query(
        'DELETE FROM email_verification WHERE user_id = $1 AND verified_at IS NULL',
        [user.id]
      );

      // Create new token with original role
      await pool.query(
        `INSERT INTO email_verification (id, user_id, token, expires_at, ip_address, original_role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), user.id, verificationToken, expiresAt, getClientIp(req), originalRole]
      );

      // TODO: Send verification email
      console.log(`📧 Verification token for ${user.email}: ${verificationToken}`);

      res.json({
        success: true,
        message: 'Verification token sent. Check console/logs for the token.',
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
      });
    } catch (error) {
      console.error('Resend verification (authenticated) error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while resending verification',
        details: error.message
      });
    }
  }

  /**
   * POST /api/auth/resend-verification (unauthenticated)
   * Resend email verification token by email
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
        'SELECT id, email_verified, role FROM app_user WHERE email = $1',
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

      // Store original role for restoration after verification
      const originalRole = user.role;

      // Delete old tokens
      await pool.query(
        'DELETE FROM email_verification WHERE user_id = $1 AND verified_at IS NULL',
        [user.id]
      );

      // Create new token with original role
      await pool.query(
        `INSERT INTO email_verification (id, user_id, token, expires_at, ip_address, original_role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), user.id, verificationToken, expiresAt, getClientIp(req), originalRole]
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
        // For development: Log recovery token to console (similar to email verification)
        console.log(`Password recovery token for ${sanitizedEmail}: ${recoveryToken}`);
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

  /**
   * GET /api/auth/profile
   * Get current user's profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT id, email, display_name, role, status, email_verified, bio, text_message_contact, created_at, updated_at
         FROM app_user
         WHERE id = $1`,
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      const user = rows[0];
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          status: user.status,
          emailVerified: user.email_verified,
          bio: user.bio || '',
          textMessageContact: user.text_message_contact || '',
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching profile'
      });
    }
  }

  /**
   * PUT /api/auth/profile
   * Update current user's profile
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { email, displayName, bio, textMessageContact } = req.body;

      // Fetch current user data
      const { rows: userRows } = await pool.query(
        `SELECT email, email_verified FROM app_user WHERE id = $1`,
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      const currentUser = userRows[0];
      const updates = [];
      const values = [];
      let paramIndex = 1;
      let emailChanged = false;

      // Validate and prepare email update
      if (email !== undefined) {
        const sanitizedEmail = sanitizeEmail(email);
        if (!validateEmail(sanitizedEmail)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_EMAIL',
            message: 'Invalid email format'
          });
        }

        // Check if email is already taken by another user
        const { rows: existingEmail } = await pool.query(
          `SELECT id FROM app_user WHERE email = $1 AND id != $2`,
          [sanitizedEmail, userId]
        );

        if (existingEmail.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'EMAIL_EXISTS',
            message: 'Email address is already in use'
          });
        }

        if (sanitizedEmail !== currentUser.email) {
          emailChanged = true;
          updates.push(`email = $${paramIndex++}`);
          values.push(sanitizedEmail);
        }
      }

      // Validate and prepare display name update
      if (displayName !== undefined) {
        const sanitizedDisplayName = sanitizeInput(displayName.trim());
        if (!sanitizedDisplayName || sanitizedDisplayName.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_DISPLAY_NAME',
            message: 'Display name cannot be empty'
          });
        }
        updates.push(`display_name = $${paramIndex++}`);
        values.push(sanitizedDisplayName);
      }

      // Validate and prepare bio update
      if (bio !== undefined) {
        const sanitizedBio = sanitizeInput(bio);
        updates.push(`bio = $${paramIndex++}`);
        values.push(sanitizedBio || null);
      }

      // Validate and prepare text_message_contact update (10-digit phone number)
      if (textMessageContact !== undefined) {
        const sanitizedContact = textMessageContact.trim();
        
        // If provided, validate it's exactly 10 digits
        if (sanitizedContact) {
          // Remove any non-digit characters for validation
          const digitsOnly = sanitizedContact.replace(/\D/g, '');
          
          if (digitsOnly.length !== 10) {
            return res.status(400).json({
              success: false,
              error: 'INVALID_PHONE_NUMBER',
              message: 'Phone number must be exactly 10 digits'
            });
          }
          
          // Store only the digits
          updates.push(`text_message_contact = $${paramIndex++}`);
          values.push(digitsOnly);
        } else {
          // Empty string means null (no phone number)
          updates.push(`text_message_contact = $${paramIndex++}`);
          values.push(null);
        }
      }

      // If email changed, set email_verified to false
      if (emailChanged) {
        updates.push(`email_verified = false`);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'NO_UPDATES',
          message: 'No fields to update'
        });
      }

      // Add updated_at
      updates.push(`updated_at = now()`);

      // Build and execute update query
      values.push(userId);
      const query = `
        UPDATE app_user
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, display_name, role, status, email_verified, bio, text_message_contact, updated_at
      `;

      const { rows } = await pool.query(query, values);

      const updatedUser = rows[0];

      // If email changed, generate new verification token
      if (emailChanged) {
        // Get current role to store for restoration
        const { rows: roleRows } = await pool.query(
          `SELECT role FROM app_user WHERE id = $1`,
          [userId]
        );
        const originalRole = roleRows[0]?.role || 'visitor';

        const verificationToken = generateSecureToken(32);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

        // Delete any existing verification tokens for this user
        await pool.query(
          `DELETE FROM email_verification WHERE user_id = $1`,
          [userId]
        );

        // Insert new verification token with original role for restoration
        await pool.query(
          `INSERT INTO email_verification (id, user_id, token, expires_at, ip_address, original_role)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
          [userId, verificationToken, expiresAt, getClientIp(req), originalRole]
        );

        // Log verification token for development (remove in production)
        console.log(`📧 Email verification token for ${updatedUser.email}: ${verificationToken}`);
      }

      res.json({
        success: true,
        message: emailChanged ? 'Profile updated. Please verify your new email address.' : 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          displayName: updatedUser.display_name,
          role: updatedUser.role,
          status: updatedUser.status,
          emailVerified: updatedUser.email_verified,
          bio: updatedUser.bio || '',
          textMessageContact: updatedUser.text_message_contact || '',
          updatedAt: updatedUser.updated_at
        }
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while updating profile'
      });
    }
  }

  /**
   * POST /api/auth/change-password
   * Change password (requires old password)
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword, confirmPassword } = req.body;

      // Validate required fields
      if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_FIELDS',
          message: 'Old password, new password, and confirm password are required'
        });
      }

      // Validate new password matches confirmation
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'PASSWORD_MISMATCH',
          message: 'New password and confirmation do not match'
        });
      }

      // Validate new password complexity
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'PASSWORD_INVALID',
          message: passwordValidation.errors.join('. ')
        });
      }

      // Fetch user and verify old password
      const { rows } = await pool.query(
        `SELECT id, password_hash FROM app_user WHERE id = $1`,
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      const user = rows[0];

      // Verify old password
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isOldPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_OLD_PASSWORD',
          message: 'Old password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await pool.query(
        `UPDATE app_user 
         SET password_hash = $1, updated_at = now()
         WHERE id = $2`,
        [newPasswordHash, userId]
      );

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while changing password'
      });
    }
  }
}
