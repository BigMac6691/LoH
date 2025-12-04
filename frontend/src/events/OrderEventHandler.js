/**
 * OrderEventHandler - Handles order-related events and backend communication
 * Manages order submission, loading, and responses
 */
import { eventBus } from '../eventBus.js';
import { RB } from '../utils/RequestBuilder.js';

export class OrderEventHandler
{
  constructor()
  {
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for order-related events
   */
  setupEventListeners()
  {
    // Listen for order submission requests
    eventBus.on('order:move.submit', this.handleOrderSubmit.bind(this));
    eventBus.on('order:build.submit', this.handleOrderSubmit.bind(this));
    
    // Listen for order loading requests
    eventBus.on('order:move.loadForStar', this.handleLoadOrdersForStar.bind(this));
    eventBus.on('order:build.loadForStar', this.handleLoadOrdersForStar.bind(this));
    
    // Listen for order loading requests by turn
    eventBus.on('order:move.loadForTurn', this.handleLoadOrdersForTurn.bind(this));
    eventBus.on('order:build.loadForTurn', this.handleLoadOrdersForTurn.bind(this));
  }

  /**
   * Handle order submission requests
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing order information
   */
  async handleOrderSubmit(context, eventData)
  {
    console.log('📋 OrderEventHandler: Handling order submission:', eventData);
    console.log('📋 OrderEventHandler: Context:', context);
    
    try
    {
      // Validate required data
      if (!eventData.details)
      {
        throw new Error('Missing event details');
      }

      const { orderType, payload } = eventData.details;
      const gameId = context.gameId;

      if (!gameId || !orderType || !payload)
      {
        throw new Error(`Missing required parameters: gameId${gameId ? '✅' : '❌'}, orderType${orderType ? '✅' : '❌'}, payload${payload ? '✅' : '❌'}`);
      }

      // Make the backend call (playerId is derived from authenticated user on backend)
      const result = await RB.fetchPost('/api/orders', {
        gameId,
        orderType,
        payload
      });
      console.log('📋 OrderEventHandler: Order submitted successfully:', result);

      // Emit success event with order type specific naming
      const eventName = `order:${orderType}.submitSuccess`;
      eventBus.emit(eventName, {
        success: true,
        details: {
          eventType: eventName,
          order: result.order,
          orders: result.orders, // Include updated orders from server
          gameId,
          orderType,
          payload
        }
      });

    }
    catch (error)
    {
      console.error('📋 OrderEventHandler: Error submitting order:', error);
      
      // Emit error event with order type specific naming
      const eventName = `order:${orderType}.submitError`;
      eventBus.emit(eventName, {
        success: false,
        details: {
          eventType: eventName,
          error: error.message,
          originalEventData: eventData
        }
      });
    }
  }

  /**
   * Handle loading orders for a specific star
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing star information
   */
  async handleLoadOrdersForStar(context, eventData)
  {
    console.log('📋 OrderEventHandler: Handling load orders for star:', eventData);
    console.log('📋 OrderEventHandler: Context:', context);
    
    try
    {
      // Validate required data
      if (!eventData.details)
      {
        throw new Error('Missing event details');
      }

      const { sourceStarId, orderType } = eventData.details;
      const { gameId, playerId } = context;

      if (!gameId || !sourceStarId)
      {
        throw new Error('Missing required parameters: gameId, starId');
      }

      // Build query parameters
      const params = new URLSearchParams({ gameId });
      if (playerId) {
        params.append('playerId', playerId);
      }
      if (orderType) {
        params.append('orderType', orderType);
      }

      // Make the backend call
      const result = await RB.fetchGet(`/api/orders/star/${sourceStarId}?${params}`);
      console.log('📋 OrderEventHandler: Orders loaded successfully for star:', sourceStarId, result);

      // Emit success event with order type specific naming
      const eventName = `order:${orderType}.loadSuccess`;
      eventBus.emit(eventName, {
        success: true,
        details: {
          eventType: eventName,
          orders: result.orders,
          gameId,
          sourceStarId,
          playerId,
          orderType
        }
      });

    }
    catch (error)
    {
      console.error('📋 OrderEventHandler: Error loading orders for star:', error);
      
      // Emit error event with order type specific naming
      const eventName = `order:${orderType}.loadError`;
      eventBus.emit(eventName, {
        success: false,
        details: {
          eventType: eventName,
          error: error.message,
          originalEventData: eventData
        }
      });
    }
  }

  /**
   * Handle loading orders for a specific turn
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing turn information
   */
  async handleLoadOrdersForTurn(context, eventData)
  {
    console.log('📋 OrderEventHandler: Handling load orders for turn:', eventData);
    
    try
    {
      // Validate required data
      if (!eventData.details)
      {
        throw new Error('Missing event details');
      }

      const { gameId, turnId, playerId } = eventData.details;

      if (!gameId || !turnId)
      {
        throw new Error('Missing required parameters: gameId, turnId');
      }

      // Build query parameters
      const params = new URLSearchParams({ gameId });
      if (playerId) {
        params.append('playerId', playerId);
      }

      // Make the backend call
      const result = await RB.fetchGet(`/api/orders/turn/${turnId}?${params}`);
      console.log('📋 OrderEventHandler: Orders loaded successfully for turn:', turnId, result);

      // Emit success event
      eventBus.emit('order:loadSuccess', {
        success: true,
        details: {
          eventType: 'order:loadSuccess',
          orders: result.orders,
          gameId,
          turnId,
          playerId
        }
      });

    }
    catch (error)
    {
      console.error('📋 OrderEventHandler: Error loading orders for turn:', error);
      
      // Emit error event
      eventBus.emit('order:loadError', {
        success: false,
        details: {
          eventType: 'order:loadError',
          error: error.message,
          originalEventData: eventData
        }
      });
    }
  }
}
