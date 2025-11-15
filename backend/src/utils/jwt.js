import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret-in-production';

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '24h'; // 24 hours
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

/**
 * Generate JWT access token
 * 
 * @param {Object} payload - Token payload (user id, email, role)
 * @returns {string} JWT access token
 */
export function generateAccessToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate JWT refresh token
 * 
 * @param {Object} payload - Token payload (user id)
 * @returns {string} JWT refresh token
 */
export function generateRefreshToken(payload) {
  return jwt.sign(
    { id: payload.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verify JWT access token
 * 
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Verify JWT refresh token
 * 
 * @param {string} token - JWT refresh token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Get token expiration date
 * 
 * @param {string} expiresIn - Expiration string (e.g., '24h', '7d')
 * @returns {Date} Expiration date
 */
export function getTokenExpiration(expiresIn) {
  const now = new Date();
  if (expiresIn.endsWith('h')) {
    const hours = parseInt(expiresIn);
    now.setHours(now.getHours() + hours);
  } else if (expiresIn.endsWith('d')) {
    const days = parseInt(expiresIn);
    now.setDate(now.getDate() + days);
  }
  return now;
}

