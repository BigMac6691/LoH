/**
 * Centralized API headers utility
 * Provides consistent headers for all API requests including Authorization token
 */

/**
 * Get headers for POST/PUT/PATCH requests (includes Content-Type and Authorization)
 * @returns {Object} Headers object
 */
export function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
  };
}

/**
 * Get headers for GET/DELETE requests (includes only Authorization)
 * @returns {Object} Headers object
 */
export function getHeadersForGet() {
  return {
    'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
  };
}

