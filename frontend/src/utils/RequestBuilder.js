/**
 * RB - Request Builder static class
 * Provides consistent headers for all API requests including Authorization token
 */
export class RB {
  /**
   * Get headers for POST/PUT/PATCH requests (includes Content-Type and Authorization)
   * @returns {Object} Headers object
   */
  static getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
    };
  }

  /**
   * Get headers for GET/DELETE requests (includes only Authorization)
   * @returns {Object} Headers object
   */
  static getHeadersForGet() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
    };
  }
}

