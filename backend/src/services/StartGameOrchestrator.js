import { serverBus } from '../utils/ServerBus.js';
import { pool } from '../db/pool.js';

export class StartGameOrchestrator
{
   constructor()
   {
      this.serverBus = serverBus;

      this.handleStepEvent = this.handleStepEvent.bind(this);

      this.serverBus.on('game.start:startGame', this.handleStepEvent);
      this.serverBus.on('game.start:mapGenerated', this.handleStepEvent);
      this.serverBus.on('game.start:playersPlaced', this.handleStepEvent);
      this.serverBus.on('game.start:firstTurnCreated', this.handleStepEvent);
   }

   async start()
   {
      console.log('🎮 StartGameOrchestrator: Server starting...');
   }

   async handleStepEvent(context)
   {
      try
      {
         const { gameId } = context;
         if (!gameId)
            throw new Error('StartGameOrchestrator: gameId is required');

         const { rows } = await pool.query('SELECT substatus FROM game WHERE id = $1', [gameId]);
         if (rows.length === 0)
            throw new Error(`StartGameOrchestrator: Game ${gameId} not found`);

         const substatus = rows[0].substatus || null;
         const nextEventBySubstatus =
         {
            null: 'game.start:generateMap',
            map_generated: 'game.start:placePlayers',
            players_placed: 'game.start:createFirstTurn',
            turn_created: 'game.start:activateGame'
         };

         const nextEvent = nextEventBySubstatus[substatus];
         if (!nextEvent)
            throw new Error(`StartGameOrchestrator: No next step for substatus ${substatus}`);

         this.serverBus.emit(nextEvent, context);
      }
      catch (error)
      {
         console.error('🎮 StartGameOrchestrator: Error handling step event:', error);
      }
   }
}

export const startGameOrchestrator = new StartGameOrchestrator();
