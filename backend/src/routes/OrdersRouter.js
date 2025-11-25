import express from 'express';
import { OrdersService } from '../services/OrdersService.js';
import { getOpenTurn } from '../repos/turnsRepo.js';
import { getStandingOrders, setStandingOrders, clearStandingOrders, getStarState } from '../repos/starsRepo.js';
import { deleteOrderById } from '../repos/ordersRepo.js';
import { authenticate } from '../middleware/auth.js';
import { requireGamePlayer } from '../middleware/rbac.js';
import { pool } from '../db/pool.js';

export class OrdersRouter
{
  constructor()
  {
    this.router = express.Router();
    this.ordersService = new OrdersService();
    this.setupRoutes();
  }

  setupRoutes()
  {
    // POST /api/orders - Create a new order (requires auth and game player)
    this.router.post('/', authenticate, requireGamePlayer(), this.createOrder.bind(this));
    
    // GET /api/orders/star/:starId - Get orders for a specific star (requires auth)
    this.router.get('/star/:starId', authenticate, this.getOrdersForStar.bind(this));
    
    // GET /api/orders/turn/:turnId - Get orders for a specific turn (requires auth)
    this.router.get('/turn/:turnId', authenticate, this.getOrdersForTurn.bind(this));
    
    // POST /api/orders/standing - Save standing orders for a star (requires auth and game player)
    this.router.post('/standing', authenticate, requireGamePlayer(), this.saveStandingOrders.bind(this));
    
    // GET /api/orders/standing/:starId - Get standing orders for a star (requires auth)
    this.router.get('/standing/:starId', authenticate, this.getStandingOrders.bind(this));
    
    // DELETE /api/orders/standing/:starId - Clear standing orders for a star (requires auth and game player)
    this.router.delete('/standing/:starId', authenticate, requireGamePlayer(), this.deleteStandingOrders.bind(this));
    
    // DELETE /api/orders/:orderId - Delete an order by ID (requires auth and game player)
    this.router.delete('/:orderId', authenticate, requireGamePlayer(), this.deleteOrderById.bind(this));
  }

  /**
   * Get the Express router instance
   * @returns {express.Router} The router instance
   */
  getRouter()
  {
    return this.router;
  }

  /**
   * POST /api/orders
   * Create a new order submission
   */
  async createOrder(req, res)
  {
    try
    {
      const { gameId, orderType, payload } = req.body;
      
      // Validate required parameters
      if (!gameId || !orderType || !payload)
      {
        return res.status(400).json({
          error: 'Missing required parameters: gameId, orderType, payload'
        });
      }

      // Derive playerId from authenticated user_id + gameId
      const { rows: playerRows } = await pool.query(
        `SELECT id, type FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
        [gameId, req.user.id]
      );

      if (playerRows.length === 0) {
        return res.status(404).json({
          error: 'Player not found in this game'
        });
      }

      const playerId = playerRows[0].id;

      if (playerRows[0].type === 'ai') {
        return res.status(403).json({
          error: 'Cannot submit orders for AI players'
        });
      }

      // Get the current open turn for the game
      const turn = await getOpenTurn(gameId);
      if (!turn)
      {
        return res.status(400).json({
          error: 'No open turn found for this game'
        });
      }

      // Create the order
      const order = await this.ordersService.createOrder({
        gameId,
        turnId: turn.id,
        playerId,
        orderType,
        payload: {
          ...payload,
          version: 'v1',
          timestamp: new Date().toISOString()
        }
      });

      // Get updated orders for the source star
      const sourceStarId = payload.sourceStarId;
      let updatedOrders = [];
      if (sourceStarId) {
        updatedOrders = await this.ordersService.getOrdersForStar(gameId, sourceStarId, playerId, orderType);
      }

      res.json({
        success: true,
        order: order,
        orders: updatedOrders
      });

    } catch (error)
    {
      console.error('Error creating order:', error);
      res.status(500).json({
        error: 'Failed to create order',
        details: error.message
      });
    }
  }

  /**
   * GET /api/orders/star/:starId
   * Get orders for a specific star
   */
  async getOrdersForStar(req, res)
  {

    console.log('🔍 getOrdersForStar: params', req.params);
    console.log('🔍 getOrdersForStar: query', req.query);

    try
    {
      const { starId } = req.params;
      const { gameId, playerId: providedPlayerId, orderType } = req.query;

      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      // Derive playerId from authenticated user if not provided, or verify it matches if provided
      let playerId = providedPlayerId;
      if (!playerId) {
        const { rows: playerRows } = await pool.query(
          `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
          [gameId, req.user.id]
        );
        if (playerRows.length > 0) {
          playerId = playerRows[0].id;
        }
      } else {
        // Verify provided playerId belongs to authenticated user
        const { rows: playerRows } = await pool.query(
          `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND id = $3 AND type = 'player'`,
          [gameId, req.user.id, playerId]
        );
        if (playerRows.length === 0) {
          return res.status(403).json({
            error: 'Player ID does not match authenticated user'
          });
        }
      }

      const orders = await this.ordersService.getOrdersForStar(gameId, starId, playerId, orderType);

      res.json({
        success: true,
        orders: orders
      });

    } catch (error)
    {
      console.error('Error getting orders for star:', error);
      res.status(500).json({
        error: 'Failed to get orders for star',
        details: error.message
      });
    }
  }

  /**
   * GET /api/orders/turn/:turnId
   * Get orders for a specific turn
   */
  async getOrdersForTurn(req, res)
  {
    try
    {
      const { turnId } = req.params;
      const { gameId, playerId: providedPlayerId } = req.query;

      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      // Derive playerId from authenticated user if not provided, or verify it matches if provided
      let playerId = providedPlayerId;
      if (!playerId) {
        const { rows: playerRows } = await pool.query(
          `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
          [gameId, req.user.id]
        );
        if (playerRows.length > 0) {
          playerId = playerRows[0].id;
        }
      } else {
        // Verify provided playerId belongs to authenticated user
        const { rows: playerRows } = await pool.query(
          `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND id = $3 AND type = 'player'`,
          [gameId, req.user.id, playerId]
        );
        if (playerRows.length === 0) {
          return res.status(403).json({
            error: 'Player ID does not match authenticated user'
          });
        }
      }

      const orders = await this.ordersService.getOrdersForTurn(gameId, turnId, playerId);

      res.json({
        success: true,
        orders: orders
      });

    } catch (error)
    {
      console.error('Error getting orders for turn:', error);
      res.status(500).json({
        error: 'Failed to get orders for turn',
        details: error.message
      });
    }
  }

  /**
   * POST /api/orders/standing
   * Save standing orders for a star
   */
  async saveStandingOrders(req, res)
  {
    try
    {
      const { gameId, starId, standingOrders } = req.body;
      
      // Validate required parameters
      if (!gameId || !starId || !standingOrders)
      {
        return res.status(400).json({
          error: 'Missing required parameters: gameId, starId, standingOrders'
        });
      }

      // Derive playerId from authenticated user_id + gameId
      const { rows: playerRows } = await pool.query(
        `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
        [gameId, req.user.id]
      );

      if (playerRows.length === 0) {
        return res.status(404).json({
          error: 'Player not found in this game'
        });
      }

      const playerId = playerRows[0].id;

      // Validate ownership - check that the star is owned by this player
      const starState = await getStarState({ gameId, starId });
      if (!starState)
      {
        return res.status(404).json({
          error: 'Star state not found'
        });
      }

      if (starState.owner_player !== playerId)
      {
        return res.status(403).json({
          error: 'Player does not own this star'
        });
      }

      // Validate standing orders structure
      if (standingOrders.industry)
      {
        const { expand, research, build } = standingOrders.industry;
        const total = (expand || 0) + (research || 0) + (build || 0);
        if (total > 100)
        {
          return res.status(400).json({
            error: 'Industry standing orders total cannot exceed 100%'
          });
        }
      }

      // Save standing orders
      await setStandingOrders({ gameId, starId, standingOrders });

      res.json({
        success: true,
        message: 'Standing orders saved successfully'
      });

    }
    catch (error)
    {
      console.error('Error saving standing orders:', error);
      res.status(500).json({
        error: 'Failed to save standing orders',
        details: error.message
      });
    }
  }

  /**
   * GET /api/orders/standing/:starId
   * Get standing orders for a star
   */
  async getStandingOrders(req, res)
  {
    try
    {
      const { starId } = req.params;
      const { gameId } = req.query;

      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      const standingOrders = await getStandingOrders({ gameId, starId });

      res.json({
        success: true,
        standingOrders: standingOrders || null
      });

    }
    catch (error)
    {
      console.error('Error getting standing orders:', error);
      res.status(500).json({
        error: 'Failed to get standing orders',
        details: error.message
      });
    }
  }

  /**
   * DELETE /api/orders/standing/:starId
   * Clear standing orders for a star
   */
  async deleteStandingOrders(req, res)
  {
    try
    {
      const { starId } = req.params;
      const { gameId } = req.query;

      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      // Derive playerId from authenticated user_id + gameId
      const { rows: playerRows } = await pool.query(
        `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
        [gameId, req.user.id]
      );

      if (playerRows.length === 0) {
        return res.status(404).json({
          error: 'Player not found in this game'
        });
      }

      const playerId = playerRows[0].id;

      // Validate ownership
      const starState = await getStarState({ gameId, starId });
      if (!starState)
      {
        return res.status(404).json({
          error: 'Star state not found'
        });
      }

      if (starState.owner_player !== playerId)
      {
        return res.status(403).json({
          error: 'Player does not own this star'
        });
      }

      // Clear standing orders
      await clearStandingOrders({ gameId, starId });

      res.json({
        success: true,
        message: 'Standing orders cleared successfully'
      });

    }
    catch (error)
    {
      console.error('Error clearing standing orders:', error);
      res.status(500).json({
        error: 'Failed to clear standing orders',
        details: error.message
      });
    }
  }

  /**
   * DELETE /api/orders/:orderId
   * Delete an order by its ID
   */
  async deleteOrderById(req, res)
  {
    try
    {
      const { orderId } = req.params;
      const { gameId } = req.query;

      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      // Derive playerId from authenticated user_id + gameId
      const { rows: playerRows } = await pool.query(
        `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
        [gameId, req.user.id]
      );

      if (playerRows.length === 0) {
        return res.status(404).json({
          error: 'Player not found in this game'
        });
      }

      const playerId = playerRows[0].id;

      // Delete the order (deleteOrderById validates playerId)
      const deleted = await deleteOrderById(orderId, playerId);

      if (!deleted)
      {
        return res.status(404).json({
          error: 'Order not found or access denied'
        });
      }

      res.json({
        success: true,
        message: 'Order deleted successfully'
      });

    }
    catch (error)
    {
      console.error('Error deleting order:', error);
      res.status(500).json({
        error: 'Failed to delete order',
        details: error.message
      });
    }
  }

}
