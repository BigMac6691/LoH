/**
 * OrderEventHandler - Handles order-related events and backend communication
 * Manages order submission, loading, and responses
 */
import { eventBus } from '../eventBus.js';

export class OrderEventHandler
{
  constructor()
  {
    this.setupEventListeners();
    console.log('📋 OrderEventHandler: Initialized');
  }

  /**
   * Set up event listeners for order-related events
   */
  setupEventListeners()
  {
    // Listen for order submission requests
    eventBus.on('order:submit', this.handleOrderSubmit.bind(this));
    
    // Listen for order loading requests
    eventBus.on('order:loadForStar', this.handleLoadOrdersForStar.bind(this));
    
    // Listen for order loading requests by turn
    eventBus.on('order:loadForTurn', this.handleLoadOrdersForTurn.bind(this));
    
    console.log('📋 OrderEventHandler: Event listeners set up');
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

      const { starId, orderType, payload } = eventData.details;
      const gameId = context.gameId;
      const playerId = context.user;

      if (!gameId || !starId || !playerId || !orderType || !payload)
      {
        throw new Error('Missing required parameters: gameId, starId, playerId, orderType, payload');
      }

      // Make the backend call
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          starId,
          playerId,
          orderType,
          payload
        }),
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit order');
      }

      const result = await response.json();
      console.log('📋 OrderEventHandler: Order submitted successfully:', result);

      // Emit success event
      eventBus.emit('order:submitSuccess', {
        success: true,
        details: {
          eventType: 'order:submitSuccess',
          order: result.order,
          gameId,
          starId,
          playerId,
          orderType,
          payload
        }
      });

    }
    catch (error)
    {
      console.error('📋 OrderEventHandler: Error submitting order:', error);
      
      // Emit error event
      eventBus.emit('order:submitError', {
        success: false,
        details: {
          eventType: 'order:submitError',
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

      const { starId } = eventData.details;
      const { gameId, playerId } = context;

      if (!gameId || !starId)
      {
        throw new Error('Missing required parameters: gameId, starId');
      }

      // Build query parameters
      const params = new URLSearchParams({ gameId });
      if (playerId) {
        params.append('playerId', playerId);
      }

      // Make the backend call
      const response = await fetch(`/api/orders/star/${starId}?${params}`);
      
      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load orders');
      }

      const result = await response.json();
      console.log('📋 OrderEventHandler: Orders loaded successfully for star:', starId, result);

      // Emit success event
      eventBus.emit('order:loadSuccess', {
        success: true,
        details: {
          eventType: 'order:loadSuccess',
          orders: result.orders,
          gameId,
          starId,
          playerId
        }
      });

    }
    catch (error)
    {
      console.error('📋 OrderEventHandler: Error loading orders for star:', error);
      
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
      const response = await fetch(`/api/orders/turn/${turnId}?${params}`);
      
      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load orders');
      }

      const result = await response.json();
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
