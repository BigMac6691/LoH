/**
 * WebSocketService - Manages WebSocket connections and game state notifications
 * Tracks which clients are viewing which games and sends real-time updates
 */

export class WebSocketService
{
   constructor()
   {
      // Map of socketId -> { userId, gameId, playerId }
      this.connections = new Map();
      this.io = null;
   }

   /**
    * Initialize the WebSocket service with Socket.IO server
    * @param {Object} io - Socket.IO server instance
    */
   initialize(io)
   {
      this.io = io;
      this.setupEventHandlers();
      console.log('🔌 WebSocketService: Initialized');
   }

   /**
    * Set up Socket.IO event handlers
    */
   setupEventHandlers()
   {
      this.io.on('connection', (socket) =>
      {
         console.log(`🔌 WebSocketService: Client connected: ${socket.id}`);

         // Handle authentication
         socket.on('authenticate', async (data) =>
         {
            try
            {
               const
               {
                  token
               } = data;
               if (!token)
               {
                  socket.emit('error',
                  {
                     message: 'Authentication token required'
                  });
                  return;
               }

               // Verify JWT token (import here to avoid circular dependencies)
               const
               {
                  verifyAccessToken
               } = await import('../utils/jwt.js');
               const decoded = verifyAccessToken(token);

               if (!decoded)
               {
                  socket.emit('error',
                  {
                     message: 'Invalid or expired token'
                  });
                  return;
               }

               // Store user info in socket data
               socket.data.userId = decoded.id;
               socket.data.authenticated = true;

               console.log(`🔌 WebSocketService: Client ${socket.id} authenticated as user ${decoded.id}`);
               socket.emit('authenticated',
               {
                  success: true
               });
            }
            catch (error)
            {
               console.error('🔌 WebSocketService: Authentication error:', error);
               socket.emit('error',
               {
                  message: 'Authentication failed'
               });
            }
         });

         // Handle game join - client is viewing a game
         socket.on('game:join', async (data) =>
         {
            if (!socket.data.authenticated)
            {
               socket.emit('error',
               {
                  message: 'Not authenticated'
               });
               return;
            }

            try
            {
               const
               {
                  gameId,
                  playerId
               } = data;
               if (!gameId)
               {
                  socket.emit('error',
                  {
                     message: 'gameId required'
                  });
                  return;
               }

               // Verify user is a player in this game
               const
               {
                  pool
               } = await import('../db/pool.js');
               const
               {
                  rows
               } = await pool.query(
                  `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
                  [gameId, socket.data.userId]
               );

               if (rows.length === 0)
               {
                  socket.emit('error',
                  {
                     message: 'Not a player in this game'
                  });
                  return;
               }

               // Register connection
               this.connections.set(socket.id,
               {
                  userId: socket.data.userId,
                  gameId,
                  playerId: playerId || rows[0].id
               });

               console.log(`🔌 WebSocketService: Client ${socket.id} joined game ${gameId} (player ${playerId || rows[0].id})`);
               socket.emit('game:joined',
               {
                  success: true,
                  gameId,
                  playerId: playerId || rows[0].id
               });
            }
            catch (error)
            {
               console.error('🔌 WebSocketService: Error joining game:', error);
               socket.emit('error',
               {
                  message: 'Failed to join game'
               });
            }
         });

         // Handle game leave - client is no longer viewing a game
         socket.on('game:leave', () =>
         {
            if (this.connections.has(socket.id))
            {
               const connection = this.connections.get(socket.id);
               console.log(`🔌 WebSocketService: Client ${socket.id} left game ${connection.gameId}`);
               this.connections.delete(socket.id);
            }
            socket.emit('game:left',
            {
               success: true
            });
         });

         // Handle disconnect
         socket.on('disconnect', () =>
         {
            if (this.connections.has(socket.id))
            {
               const connection = this.connections.get(socket.id);
               console.log(`🔌 WebSocketService: Client ${socket.id} disconnected from game ${connection.gameId}`);
               this.connections.delete(socket.id);
            }
            else
            {
               console.log(`🔌 WebSocketService: Client ${socket.id} disconnected`);
            }
         });
      });
   }

   /**
    * Notify all clients viewing a specific game about a turn completion
    * Collects refreshable game data and sends it to clients
    * @param {string} gameId - Game ID
    * @param {Object} updateData - Update data to send (includes newTurnId, newTurnNumber, etc.)
    */
   async notifyGameUpdate(gameId, updateData)
   {
      if (!this.io)
      {
         console.warn('🔌 WebSocketService: Cannot notify - Socket.IO not initialized');
         return;
      }

      // Find all connections for this game
      const gameConnections = [];
      for (const [socketId, connection] of this.connections.entries())
      {
         if (connection.gameId === gameId)
         {
            gameConnections.push(socketId);
         }
      }

      if (gameConnections.length === 0)
      {
         console.log(`🔌 WebSocketService: No active connections for game ${gameId}`);
         return;
      }

      console.log(`🔌 WebSocketService: Notifying ${gameConnections.length} client(s) about turn completion for game ${gameId}`);

      try
      {
         // Collect refreshable data
         const { pool } = await import('../db/pool.js');
         const { getOpenTurn } = await import('../repos/turnsRepo.js');
         const { getOrdersForTurn } = await import('../repos/ordersRepo.js');
         const { getAllTurnEvents } = await import('../repos/turnEventRepo.js');

         console.log(`🔌 WebSocketService: Collecting refresh data for game ${gameId}`);
         console.log(`🔌 WebSocketService: updateData received:`, JSON.stringify(updateData, null, 2));

         // Get the new open turn
         const turn = await getOpenTurn(gameId);
         console.log(`🔌 WebSocketService: Current open turn:`, turn ? `Turn ${turn.number} (ID: ${turn.id})` : 'None');

         // Get star states (state)
         const { rows: starStates } = await pool.query(`SELECT * FROM star_state WHERE game_id = $1 ORDER BY star_id`, [gameId]);
         console.log(`🔌 WebSocketService: Star states: ${starStates.length} entries`);

         // Get ships
         const {rows: ships} = await pool.query(`SELECT * FROM ship WHERE game_id = $1 ORDER BY id`, [gameId]);
         console.log(`🔌 WebSocketService: Ships: ${ships.length} entries`);

         // Get orders for the new turn (if turn exists)
         let orders = [];
         if (turn && turn.id)
         {
            orders = await getOrdersForTurn(gameId, turn.id);
            console.log(`🔌 WebSocketService: Orders for new turn ${turn.number}: ${orders.length} orders`);
         }
         else
         {
            // If no turn exists, get all orders for the game (should be empty, but be safe)
            orders = [];
            console.log(`🔌 WebSocketService: No open turn, orders: ${orders.length}`);
         }

         // Get events for the PREVIOUS turn (the turn that just completed)
         // The new turn won't have events yet since it just started
         let events = [];
         const previousTurnId = updateData.previousTurnId;
         const previousTurnNumber = updateData.previousTurnNumber;
         console.log(`🔌 WebSocketService: Previous turn info - ID: ${previousTurnId}, Number: ${previousTurnNumber}`);
         
         if (previousTurnId)
         {
            // Verify the turn exists and get its number for logging
            const { rows: turnRows } = await pool.query(
               `SELECT id, number FROM game_turn WHERE id = $1 AND game_id = $2`,
               [previousTurnId, gameId]
            );
            
            if (turnRows.length > 0) {
               const verifiedTurn = turnRows[0];
               console.log(`🔌 WebSocketService: Verified previous turn - Turn ${verifiedTurn.number} (ID: ${verifiedTurn.id})`);
               console.log(`🔌 WebSocketService: Requesting events for turn ${verifiedTurn.number} (ID: ${previousTurnId})`);
            } else {
               console.warn(`🔌 WebSocketService: WARNING - Previous turn ID ${previousTurnId} not found in database!`);
            }
            
            events = await getAllTurnEvents(gameId, previousTurnId);
            
            // Log event details if we got any
            if (events.length > 0) {
               console.log(`🔌 WebSocketService: Retrieved ${events.length} events for previous turn ${previousTurnNumber || 'unknown'}`);
               // Log first few event kinds for debugging
               const eventKinds = events.slice(0, 5).map(e => e.kind).join(', ');
               console.log(`🔌 WebSocketService: Sample event kinds: ${eventKinds}${events.length > 5 ? '...' : ''}`);
            } else {
               console.log(`🔌 WebSocketService: No events found for previous turn ${previousTurnNumber || 'unknown'} (ID: ${previousTurnId})`);
            }
         }
         else
         {
            // If no previous turn ID, there are no events to show
            events = [];
            console.log(`🔌 WebSocketService: No previousTurnId provided, events: ${events.length}`);
         }

         // Prepare refresh data
         const refreshData = {
            type: 'game:turnComplete',
            gameId,
            turn: turn || null,
            state: starStates || [],
            ships: ships || [],
            orders: orders || [],
            events: events || [],
            ...updateData
         };

         console.log(`🔌 WebSocketService: Prepared refresh data summary:`);
         console.log(`🔌 WebSocketService:   - Current turn: ${turn?.number || 'none'} (ID: ${turn?.id || 'none'})`);
         console.log(`🔌 WebSocketService:   - Star states: ${starStates.length}`);
         console.log(`🔌 WebSocketService:   - Ships: ${ships.length}`);
         console.log(`🔌 WebSocketService:   - Orders: ${orders.length} (for turn ${turn?.number || 'none'})`);
         console.log(`🔌 WebSocketService:   - Events: ${events.length} (for previous turn ${previousTurnNumber || 'unknown'})`);
         if (events.length > 0) {
            // Log turn_id from first event to verify which turn the events belong to
            const firstEventTurnId = events[0].turn_id;
            console.log(`🔌 WebSocketService:   - First event turn_id: ${firstEventTurnId} (should match previousTurnId: ${previousTurnId})`);
         }

         // Send update to all clients viewing this game
         gameConnections.forEach(socketId =>
         {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket)
            {
               socket.emit('game:turnComplete', refreshData);
            }
         });

         console.log(`🔌 WebSocketService: Sent refresh data to ${gameConnections.length} client(s)`);
      }
      catch (error)
      {
         console.error('🔌 WebSocketService: Error collecting refresh data:', error);
         // Still send basic notification even if data collection fails, but include empty arrays for refreshable fields
         gameConnections.forEach(socketId =>
         {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket)
            {
               socket.emit('game:turnComplete',
               {
                  type: 'game:turnComplete',
                  gameId,
                  turn: null,
                  state: [],
                  ships: [],
                  orders: [],
                  events: [],
                  ...updateData
               });
            }
         });
      }
   }

   /**
    * Get count of active connections for a game
    * @param {string} gameId - Game ID
    * @returns {number} Number of active connections
    */
   getActiveGameConnections(gameId)
   {
      let count = 0;
      for (const connection of this.connections.values())
      {
         if (connection.gameId === gameId)
         {
            count++;
         }
      }
      return count;
   }

   /**
    * Get all active connections (for debugging)
    * @returns {Array} Array of connection info
    */
   getAllConnections()
   {
      return Array.from(this.connections.entries()).map(([socketId, connection]) => (
      {
         socketId,
         ...connection
      }));
   }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
