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
 * - Store token in memory
 * - Provide simple get/set/clear/hasToken API
 * - No dependencies on WebSocketManager, UI, or GameSession
 */
class TokenStore
{
   constructor()
   {
      /**
       * Token stored in memory
       * @private
       */
      this.token = null;
   }

   /**
    * Store an authentication token
    * @param {string} token - The authentication token
    */
   setToken(token)
   {
      this.token = token;
   }

   /**
    * Get the stored authentication token
    * @returns {string|null} The token or null if not set
    */
   getToken()
   {
      return this.token;
   }

   /**
    * Check if a token is stored
    * @returns {boolean} True if token exists
    */
   hasToken()
   {
      return this.token !== null && this.token !== undefined;
   }

   /**
    * Clear the stored token
    */
   clearToken()
   {
      this.token = null;
   }
}

// Export singleton instance
export const tokenStore = new TokenStore();

