// backend/src/services/TurnEventService.js
import { getTurnEventsForPlayer, getAllTurnEvents, getTurnEventsByKind } from '../repos/turnEventRepo.js';

export class TurnEventService {
  /**
   * Get turn events for a specific player
   * @param {string} gameId - Game UUID
   * @param {string} turnId - Turn UUID
   * @param {string} playerId - Player UUID
   * @param {string} kind - Event type filter (optional)
   * @returns {Promise<Object>} Result object with events
   */
  async getPlayerTurnEvents(gameId, turnId, playerId, kind = null) {
    console.log(`📝 TurnEventService: Getting turn events for player ${playerId} in turn ${turnId}`);
    
    try {
      const events = await getTurnEventsForPlayer(gameId, turnId, playerId, kind);
      
      console.log(`📝 TurnEventService: Found ${events.length} events for player ${playerId}`);
      
      return {
        success: true,
        events,
        count: events.length
      };
    } catch (error) {
      console.error('📝 TurnEventService: Error getting player turn events:', error);
      throw error;
    }
  }

  /**
   * Get all turn events for a turn (admin view)
   * @param {string} gameId - Game UUID
   * @param {string} turnId - Turn UUID
   * @param {string} kind - Event type filter (optional)
   * @returns {Promise<Object>} Result object with events
   */
  async getAllTurnEvents(gameId, turnId, kind = null) {
    console.log(`📝 TurnEventService: Getting all turn events for turn ${turnId}`);
    
    try {
      const events = await getAllTurnEvents(gameId, turnId, kind);
      
      console.log(`📝 TurnEventService: Found ${events.length} total events for turn ${turnId}`);
      
      return {
        success: true,
        events,
        count: events.length
      };
    } catch (error) {
      console.error('📝 TurnEventService: Error getting all turn events:', error);
      throw error;
    }
  }

  /**
   * Get turn events by kind across multiple turns
   * @param {string} gameId - Game UUID
   * @param {string} playerId - Player UUID (null for global events)
   * @param {string} kind - Event type
   * @param {number} limit - Maximum number of events to return
   * @returns {Promise<Object>} Result object with events
   */
  async getEventsByKind(gameId, playerId, kind, limit = 100) {
    console.log(`📝 TurnEventService: Getting ${kind} events for player ${playerId || 'global'}`);
    
    try {
      const events = await getTurnEventsByKind(gameId, playerId, kind, limit);
      
      console.log(`📝 TurnEventService: Found ${events.length} ${kind} events`);
      
      return {
        success: true,
        events,
        count: events.length,
        kind
      };
    } catch (error) {
      console.error('📝 TurnEventService: Error getting events by kind:', error);
      throw error;
    }
  }
}
