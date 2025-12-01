/**
 * ApiError - Custom error class for API request failures
 * Includes response status, statusText, and parsed error body
 */
export class ApiError extends Error
{
   constructor(message, status, statusText, body = null)
   {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.statusText = statusText;
      this.body = body; // Parsed JSON error response if available
   }
}

/**
 * RB - Request Builder static class
 * Provides consistent headers for all API requests including Authorization token
 */
export class RB
{
   /**
    * Get headers for POST/PUT/PATCH requests (includes Content-Type and Authorization)
    * @returns {Object} Headers object
    */
   static getHeaders()
   {
      return {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
      };
   }

  /**
   * Get headers for GET/DELETE requests (includes only Authorization)
   * @returns {Object} Headers object
   */
  static getHeadersForGet()
  {
     return {
        'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
     };
  }

  /**
   * Create a Request object for GET requests
   * @param {string} url - The URL for the request
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Request} Request object configured for GET
   */
  static getRequest(url, signal = null)
  {
     const options = {
        method: 'GET',
        headers: this.getHeadersForGet()
     };
     
     if (signal !== null) {
        options.signal = signal;
     }
     
     return new Request(url, options);
  }

  /**
   * Create a Request object for DELETE requests
   * @param {string} url - The URL for the request
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Request} Request object configured for DELETE
   */
  static deleteRequest(url, signal = null)
  {
     const options = {
        method: 'DELETE',
        headers: this.getHeadersForGet()
     };
     
     if (signal !== null) {
        options.signal = signal;
     }
     
     return new Request(url, options);
  }

  /**
   * Create a Request object for POST requests
   * @param {string} url - The URL for the request
   * @param {Object|string} [body] - Optional request body (will be JSON stringified if object)
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Request} Request object configured for POST
   */
  static postRequest(url, body = null, signal = null)
  {
     const options = {
        method: 'POST',
        headers: this.getHeaders()
     };
     
     if (body !== null) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
     }
     
     if (signal !== null) {
        options.signal = signal;
     }
     
     return new Request(url, options);
  }

  /**
   * Create a Request object for PUT requests
   * @param {string} url - The URL for the request
   * @param {Object|string} [body] - Optional request body (will be JSON stringified if object)
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Request} Request object configured for PUT
   */
  static putRequest(url, body = null, signal = null)
  {
     const options = {
        method: 'PUT',
        headers: this.getHeaders()
     };
     
     if (body !== null) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
     }
     
     if (signal !== null) {
        options.signal = signal;
     }
     
     return new Request(url, options);
  }

  /**
   * Create a Request object for POST requests without Authorization header
   * Useful for unauthenticated endpoints like login, register, etc.
   * @param {string} url - The URL for the request
   * @param {Object|string} [body] - Optional request body (will be JSON stringified if object)
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Request} Request object configured for POST (no Authorization header)
   */
  static postRequestUnauthenticated(url, body = null, signal = null)
  {
     const options = {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json'
        }
     };
     
     if (body !== null) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
     }
     
     if (signal !== null) {
        options.signal = signal;
     }
     
     return new Request(url, options);
  }

  /**
   * Extract error message from response body
   * Tries multiple common error message fields
   * @param {Object} body - Parsed JSON response body
   * @returns {string} Error message
   */
  static extractErrorMessage(body)
  {
     if (!body) 
       return null;
     return body.error || body.message || body.error?.message || null;
  }

  /**
   * Handle response and parse JSON, throwing ApiError if response is not ok
   * @param {Response} response - Fetch response object
   * @returns {Promise<Object>} Parsed JSON data
   * @throws {ApiError} If response is not ok
   */
  static async handleResponse(response)
  {
     if (!response.ok)
     {
        let errorBody = null;
        try
        {
           const contentType = response.headers.get('content-type');
           if (contentType && contentType.includes('application/json'))
           {
              errorBody = await response.json();
           }
        }
        catch (e)
        {
           // Failed to parse error body, that's okay
        }

        const errorMessage = this.extractErrorMessage(errorBody) || `HTTP ${response.status}: ${response.statusText}`;
        throw new ApiError(errorMessage, response.status, response.statusText, errorBody);
     }

     // Parse and return JSON
     return await response.json();
  }

  /**
   * Execute a GET request and return parsed JSON
   * @param {string} url - The URL for the request
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {ApiError} If the request fails
   */
  static async fetchGet(url, signal = null)
  {
     const request = this.getRequest(url, signal);
     const response = await fetch(request);
     return await this.handleResponse(response);
  }

  /**
   * Execute a POST request and return parsed JSON
   * @param {string} url - The URL for the request
   * @param {Object|string} [body] - Optional request body (will be JSON stringified if object)
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {ApiError} If the request fails
   */
  static async fetchPost(url, body = null, signal = null)
  {
     const request = this.postRequest(url, body, signal);
     const response = await fetch(request);
     return await this.handleResponse(response);
  }

  /**
   * Execute a PUT request and return parsed JSON
   * @param {string} url - The URL for the request
   * @param {Object|string} [body] - Optional request body (will be JSON stringified if object)
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {ApiError} If the request fails
   */
  static async fetchPut(url, body = null, signal = null)
  {
     const request = this.putRequest(url, body, signal);
     const response = await fetch(request);
     return await this.handleResponse(response);
  }

  /**
   * Execute a DELETE request and return parsed JSON
   * @param {string} url - The URL for the request
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {ApiError} If the request fails
   */
  static async fetchDelete(url, signal = null)
  {
     const request = this.deleteRequest(url, signal);
     const response = await fetch(request);
     return await this.handleResponse(response);
  }

  /**
   * Execute a POST request without Authorization header and return parsed JSON
   * Useful for unauthenticated endpoints like login, register, etc.
   * @param {string} url - The URL for the request
   * @param {Object|string} [body] - Optional request body (will be JSON stringified if object)
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancelling the request
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {ApiError} If the request fails
   */
  static async fetchPostUnauthenticated(url, body = null, signal = null)
  {
     const request = this.postRequestUnauthenticated(url, body, signal);
     const response = await fetch(request);
     return await this.handleResponse(response);
  }
}
