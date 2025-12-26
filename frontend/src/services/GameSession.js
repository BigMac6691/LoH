/**
 * GameSession - Client-side session guard for game-related async operations
 * 
 * Provides session validation using a generation token (sessionId) pattern to prevent
 * stale async callbacks from mutating state after the session has been disposed.
 * 
 * GameSession is the authoritative client-side lifecycle and validity guard for a single game instance. 
 * It gates inbound and outbound operations based on session validity but does not own transport connections.
 */
export class GameSession
{
   /**
    * Session states
    */
   static STATES = 
   {
      ACTIVE: 'active',
      DISPOSED: 'disposed'
   };

   /**
    * Create a new game session
    * @param {string} gameId - The game ID this session is for
    */
   constructor(gameId)
   {
      if (!gameId)
         throw new Error('GameSession: gameId is required');

      this.gameId = gameId;
      
      /**
       * sessionId acts as a generation token for async callback validation.
       * 
       * Why sessionId exists:
       * - Async operations (HTTP requests, WebSocket messages, timers) may complete
       *   after the session has been disposed
       * - By capturing sessionId at the start of an async operation and verifying
       *   it matches before mutating state, we prevent stale callbacks from causing bugs
       * - When dispose() is called, the sessionId is changed, making all previously
       *   captured values stale
       * 
       * This pattern is more robust than cancellation because:
       * - We don't need to track and cancel every async operation
       * - Operations can complete naturally but safely ignore results
       * - No race conditions between disposal and operation completion
       */
      this.sessionId = crypto.randomUUID();

      /**
       * Session state - tracks whether the session is active or disposed
       */
      this.state = GameSession.STATES.ACTIVE;

      /**
       * Optional: Inbound message queue (passive - caller manages queue)
       * Used to store events that arrive before the game is ready
       */
      this.inboundQueue = [];

      /**
       * Optional: Outbound message queue (passive - caller manages queue)
       * Used to store messages when connection is unavailable
       */
      this.outboundQueue = [];

      /**
       * Optional: AbortController for canceling HTTP requests
       * Created lazily when needed
       */
      this.abortController = null;
   }

   /**
    * Get the game ID this session is for
    * @returns {string} The game ID
    */
   getGameId()
   {
      return this.gameId;
   }

   /**
    * Get the current session ID (for debugging/testing only)
    * The sessionId should NOT be sent to the server - it's strictly client-side
    * @returns {string} The current session ID
    */
   getSessionId()
   {
      return this.sessionId;
   }

   /**
    * Check if the session is still valid (not disposed)
    * @returns {boolean} True if session is active, false if disposed
    */
   isValid()
   {
      return this.state !== GameSession.STATES.DISPOSED;
   }

   /**
    * Get the current session state
    * @returns {string} Current state (ACTIVE or DISPOSED)
    */
   getState()
   {
      return this.state;
   }

   /**
    * Dispose the session, invalidating all pending async operations
    * 
    * How this works:
    * - Changes sessionId to a new value, making all previously captured sessionId
    *   values in async callbacks stale
    * - Sets state to DISPOSED
    * - Aborts any pending HTTP requests via AbortController
    * - Clears queues
    * 
    * Why disposal doesn't cancel correctness:
    * - We don't cancel async operations (HTTP requests, WebSocket messages may still complete)
    * - Instead, we change the sessionId so when those operations complete, their captured
    *   sessionId values no longer match, and they safely ignore the results
    * - This avoids race conditions and makes the code more predictable
    */
   dispose()
   {
      /**
       * Change sessionId to invalidate all pending async operations.
       * 
       * How closures interact with sessionId:
       * - Async callbacks capture the sessionId value in their closure scope
       * - They store it in a local const (e.g., const sid = this.sessionId)
       * - When the callback executes later, it compares the captured value with
       *   the current this.sessionId
       * - If they don't match, the session was disposed and the callback should
       *   ignore the result
       * 
       * Example:
       *   const sid = this.sessionId;  // Capture value "abc-123"
       *   setTimeout(() => {
       *      if (this.sessionId !== sid) return;  // Compare "xyz-789" !== "abc-123"
       *      // Safe to proceed
       *   }, 1000);
       */
      this.sessionId = crypto.randomUUID();
      this.state = GameSession.STATES.DISPOSED;

      // Cancel any pending HTTP requests
      if (this.abortController)
      {
         this.abortController.abort();
         this.abortController = null;
      }

      // Clear queues (passive cleanup)
      this.clearQueues();
   }

   /**
    * Execute a synchronous callback only if the session is valid
    * @param {Function} callback - Function to execute if session is valid
    * @returns {*} Result of callback, or null if session is invalid
    */
   runIfValid(callback)
   {
      if (this.isValid())
         return callback();
      return null;
   }

   /**
    * Execute an async callback with session validation
    * Captures sessionId at the start and verifies it matches before resolving
    * 
    * @param {Function} asyncCallback - Async function to execute
    * @returns {Promise} Promise that resolves with callback result, or rejects if session was disposed
    */
   async runAsync(asyncCallback)
   {
      const sid = this.sessionId; // Capture sessionId at start
      
      const result = await asyncCallback();
      
      // Verify sessionId hasn't changed (session wasn't disposed)
      if (this.sessionId !== sid)
         throw new Error('GameSession: Session was disposed during async operation');
      
      return result;
   }

   /**
    * Capture sessionId and pass it to callback for manual validation
    * Useful when you need to check validity in multiple places or at different times
    * 
    * @param {Function} callback - Function that receives the captured sessionId
    * @returns {*} Result of callback
    */
   withSessionId(callback)
   {
      const sid = this.sessionId;
      return callback(sid);
   }

   /**
    * Get or create an AbortController for canceling HTTP requests
    * @returns {AbortController} AbortController instance
    */
   getAbortController()
   {
      if (!this.abortController)
         this.abortController = new AbortController();
      
      return this.abortController;
   }

   /**
    * Add data to the inbound queue (passive - caller manages queue)
    * @param {*} data - Data to queue
    */
   queueInbound(data)
   {
      this.inboundQueue.push(data);
   }

   /**
    * Add data to the outbound queue (passive - caller manages queue)
    * @param {*} data - Data to queue
    */
   queueOutbound(data)
   {
      this.outboundQueue.push(data);
   }

   /**
    * Get the inbound queue array
    * @returns {Array} Array of queued inbound data
    */
   getInboundQueue()
   {
      return this.inboundQueue;
   }

   /**
    * Get the outbound queue array
    * @returns {Array} Array of queued outbound data
    */
   getOutboundQueue()
   {
      return this.outboundQueue;
   }

   /**
    * Clear both inbound and outbound queues
    */
   clearQueues()
   {
      this.inboundQueue = [];
      this.outboundQueue = [];
   }
}

