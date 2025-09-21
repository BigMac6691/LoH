import express from 'express';
import { OrdersService } from '../services/OrdersService.js';
import { getOpenTurn } from '../repos/turnsRepo.js';

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
    // POST /api/orders - Create a new order
    this.router.post('/', this.createOrder.bind(this));
    
    // GET /api/orders/star/:starId - Get orders for a specific star
    this.router.get('/star/:starId', this.getOrdersForStar.bind(this));
    
    // GET /api/orders/turn/:turnId - Get orders for a specific turn
    this.router.get('/turn/:turnId', this.getOrdersForTurn.bind(this));
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
      const { gameId, orderType, payload, playerId } = req.body;
      
      // Validate required parameters
      if (!gameId || !orderType || !payload || !playerId)
      {
        return res.status(400).json({
          error: 'Missing required parameters: gameId, orderType, payload, playerId'
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
      const { gameId, playerId, orderType } = req.query;

      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
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
      const { gameId, playerId } = req.query;

      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
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


}
