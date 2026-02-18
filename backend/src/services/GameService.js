import { updateGameStatus } from '../repos/gamesRepo.js';
import { getGameWithCounts } from '../routes/GameRouter.js';
import { serverBus } from '../utils/ServerBus.js';
import { myLogger } from '../utils/myLogger.js';
import { startGameService } from './StartGameService.js';

export class GameService
{
   constructor()
   {
      this.serverBus = serverBus;
      this.handleStatusUpdate = this.handleStatusUpdate.bind(this);

      this.serverBus.on('game:updateStatus', this.handleStatusUpdate);
   }

   /**
    * 
    * @param {Entry point for updating the game status} context 
    * @returns 
    */
   async updateStatus(context)
   {
      const { game, gameId, status, statusReason, correlationId, userId, userRole } = context || {};

      if (!game || !gameId || !status)
      {
         myLogger('error', 'GameService: Missing status request parameters', { data: { gameId, status } });
         return { httpStatus: 500, response: { error: 'Invalid status request' } };
      }

      if ((game.status === 'lobby' || game.status === 'error') && status === 'running')
      {
         await startGameService.startGame({ gameId, userId, userRole });

         return {
            httpStatus: 202,
            response: 
            {
               data: { gameId, message: 'Game initialization has started! Please wait while the game is being initialized... This may take a few minutes.' },
               status: 202,
               correlationId
            }
         };
      }

      this.serverBus.emit('game:updateStatus', context);

      return {
         httpStatus: 202,
         response: 
         {
            data: { gameId, message: 'Game status update initiated.' },
            status: 202,
            correlationId
         }
      };
   }

   /**
    * Handles all game status update events that are not related to starting the game
    * @param {Handles the status update event} context 
    * @returns 
    */
   async handleStatusUpdate(context)
   {
      const { gameId, status, statusReason, correlationId } = context || {};

      if (!gameId || !status)
      {
         myLogger('error', 'GameService: Missing status update parameters', { data: { gameId, status } });
         return;
      }

      try
      {
         await updateGameStatus({ id: gameId, status, statusReason: statusReason || null, setStartedAt: false });

         let game = null;
         try
         {
            game = await getGameWithCounts(gameId);            
         }
         catch (error)
         {
            myLogger('error', 'GameService: Failed to load updated game state', { data: { gameId, status, statusReason, correlationId }, error });
         }

         this.serverBus.emit('system:gameUpdated',
         {
            type: 'system:gameUpdated',
            entityId: gameId,
            payload: { success: true, gameId, game, correlationId }
         });
      }
      catch (error)
      {
         myLogger('error', 'GameService: Failed to update game status', { data: { gameId, status, statusReason, correlationId }, error });

         this.serverBus.emit('system:gameUpdated',
         {
            type: 'system:gameUpdated',
            entityId: gameId,
            payload: { success: false, gameId, error: error.message || 'Failed to update game status', correlationId }
         });
      }
   }
}

export const gameService = new GameService();
