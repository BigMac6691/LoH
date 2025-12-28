/**
 * TokenStore - In-memory authentication token storage
 * 
 * Why TokenStore exists:
 * - Provides a centralized, dependency-free way to store authentication tokens
 * - Separates token storage from localStorage and other persistence mechanisms
 * - Allows SessionController to manage auth lifecycle without coupling to storage details
 * - No side effects - pure storage interface
 * 
 * Responsibilities:
 * - Store access and refresh tokens in memory
 * - Track token expiration times
 * - Provide simple get/set/clear/validation API
 * - No dependencies on WebSocketManager, UI, or GameSession
 */
class TokenStore
{
   /**
    * Access token stored in memory
    * @private
    */
   #accessToken = null;

   /**
    * Refresh token stored in memory
    * @private
    */
   #refreshToken = null;

   /**
    * Access token expiration timestamp (milliseconds since epoch)
    * @private
    */
   #expiresAt = null;

   /**
    * Store authentication tokens
    * @param {Object} tokens - Token object
    * @param {string} tokens.accessToken - Access token
    * @param {string} tokens.refreshToken - Refresh token (optional)
    * @param {number} tokens.expiresAt - Expiration timestamp in milliseconds (optional)
    */
   setTokens({ accessToken, refreshToken = null, expiresAt = null })
   {
      if (!accessToken)
         throw new Error('TokenStore: accessToken is required');

      this.#accessToken = accessToken;
      this.#refreshToken = refreshToken;
      this.#expiresAt = expiresAt;
   }

   /**
    * Clear all stored tokens
    */
   clear()
   {
      this.#accessToken = null;
      this.#refreshToken = null;
      this.#expiresAt = null;
   }

   /**
    * Get the stored access token
    * @returns {string|null} The access token or null if not set
    */
   getAccessToken()
   {
      return this.#accessToken;
   }

   /**
    * Get the stored refresh token
    * @returns {string|null} The refresh token or null if not set
    */
   getRefreshToken()
   {
      return this.#refreshToken;
   }

   /**
    * Check if an access token is stored
    * @returns {boolean} True if access token exists
    */
   hasAccessToken()
   {
      return this.#accessToken !== null && this.#accessToken !== undefined;
   }

   /**
    * Check if a refresh token is stored
    * @returns {boolean} True if refresh token exists
    */
   hasRefreshToken()
   {
      return this.#refreshToken !== null && this.#refreshToken !== undefined;
   }

   /**
    * Check if the access token is expired
    * @returns {boolean} True if token is expired or no expiration time is set, false if token exists and is not expired
    */
   isAccessTokenExpired()
   {
      // If no access token, consider it expired
      if (!this.hasAccessToken())
         return true;

      // If no expiration time is set, consider it not expired (expiration unknown)
      if (this.#expiresAt === null || this.#expiresAt === undefined)
         return false;

      // Check if current time is past expiration time
      return Date.now() >= this.#expiresAt;
   }
}

// Export singleton instance
export const tokenStore = new TokenStore();

