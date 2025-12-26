/**
 * TurnEventHandler - Handles turn-related events
 * Manages end of turn processing and turn state changes
 */
import { gameStateManager as GSM } from '../services/GameStateManager.js';
import
{
   eventBus
}
from '../eventBus.js';
import { RB } from '../utils/RequestBuilder.js';

export class TurnEventHandler
{
   constructor()
   {
      this.setupEventListeners();
   }

   /**
    * Set up event listeners for turn-related events
    */
   setupEventListeners()
   {
      // Listen for end turn requests
      eventBus.on('turn:endTurn', this.handleEndTurn.bind(this));
   }

   /**
    * Handle end turn requests
    * @param {Object} event - Event data containing turn information
    */
   async handleEndTurn(event)
   {
      console.log('🔄 TurnEventHandler: Handling end turn request:', event);

      try
      {
         // Make the backend call to end the turn (playerId is derived from authenticated user on backend)
         const result = await RB.fetchPost('/api/turns/end-turn', { gameId: GSM.gameId });
         console.log('🔄 TurnEventHandler: Turn ended successfully:', result);

      }
      catch (error)
      {
         console.error('🔄 TurnEventHandler: Error ending turn:', error);
      }
   }
}
