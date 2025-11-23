/**
 * TurnEventHandler - Handles turn-related events
 * Manages end of turn processing and turn state changes
 */
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
      console.log('🔄 TurnEventHandler: Initialized');
   }

   /**
    * Set up event listeners for turn-related events
    */
   setupEventListeners()
   {
      // Listen for end turn requests
      eventBus.on('turn:endTurn', this.handleEndTurn.bind(this));

      console.log('🔄 TurnEventHandler: Event listeners set up');
   }

   /**
    * Handle end turn requests
    * @param {Object} context - Current context
    * @param {Object} eventData - Event data containing turn information
    */
   async handleEndTurn(context, eventData)
   {
      console.log('🔄 TurnEventHandler: Handling end turn request:', eventData);
      console.log('🔄 TurnEventHandler: Context:', context);

      try
      {
         // Validate required data
         if (!eventData.details)
         {
            throw new Error('Missing event details');
         }

         const playerId = context.playerId; // Use playerId from context, not user (user is user_id)
         const
         {
            gameId
         } = context;

         if (!gameId || !playerId)
         {
            throw new Error('Missing required parameters: gameId, playerId');
         }

         // Make the backend call to end the turn
         const result = await RB.fetchPost('/api/turns/end-turn', {
            gameId,
            playerId
         });
         console.log('🔄 TurnEventHandler: Turn ended successfully:', result);

         // Emit success event
         eventBus.emit('turn:endTurnSuccess',
         {
            success: true,
            details:
            {
               eventType: 'turn:endTurnSuccess',
               playerId,
               gameId,
               result
            }
         });

      }
      catch (error)
      {
         console.error('🔄 TurnEventHandler: Error ending turn:', error);

         // Emit error event
         eventBus.emit('turn:endTurnError',
         {
            success: false,
            details:
            {
               eventType: 'turn:endTurnError',
               error: error.message,
               originalEventData: eventData
            }
         });
      }
   }
}
