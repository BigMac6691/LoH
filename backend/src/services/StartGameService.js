import { pool } from '../db/pool.js';
import { generateMap } from '../MapFactory.js';
import { updateGameStatus } from '../repos/gamesRepo.js';
import { openTurn } from '../repos/turnsRepo.js';
import { upsertStarState } from '../repos/starsRepo.js';
import { addShip } from '../repos/shipsRepo.js';
import { webSocketService } from './WebSocketService.js';
import { serverBus } from '../utils/ServerBus.js';
import { myLogger } from '../utils/myLogger.js';
import { getGameWithCounts } from '../routes/GameRouter.js';
import { SystemError } from '../SystemError.js';
import { asyncLocalStorage } from '../utils/AsyncContext.js';

/**
 * StartGameService - Orchestrates game initialization
 * Handles map generation, player placement, and initial turn creation
 */
export class StartGameService
{
   constructor()
   {
      this.serverBus = serverBus;

      this.startMapGeneration = this.startMapGeneration.bind(this);
      this.startPlayerPlacement = this.startPlayerPlacement.bind(this);
      this.startFirstTurnCreation = this.startFirstTurnCreation.bind(this);
      this.activateGame = this.activateGame.bind(this);

      this.serverBus.on('game.start:generateMap', this.startMapGeneration);
      this.serverBus.on('game.start:placePlayers', this.startPlayerPlacement);
      this.serverBus.on('game.start:createFirstTurn', this.startFirstTurnCreation);
      this.serverBus.on('game.start:activateGame', this.activateGame);
   }

   async startMapGeneration(context)
   {
      myLogger('info', 'StartGameService: Starting map generation', { data: context });

      const { transactionId, gameId } = context;
      const response =
      {
         type: 'system:gameUpdated',
         entityId: gameId,
         payload: { transactionId, game: null }
      }

      const client = await pool.connect();
      const currentSubstatus = 'map_generated';

      try
      {
         await client.query('BEGIN');
         await this.generateMap(client, gameId);
         await updateGameStatus({ id: gameId, status: 'creating', substatus: currentSubstatus, statusReason: null }, client);
         await client.query('COMMIT');
      }
      catch (error)
      {
         await client.query('ROLLBACK');
         console.error(`🎮 StartGameService: Error generating map for ${gameId}:`, error);

         try
         {
            await updateGameStatus({ id: gameId, status: 'error', substatus: currentSubstatus, statusReason: error.message || 'Map generation failed' }, client);
         }
         catch (updateError)
         {
            console.error('🎮 StartGameService: Error updating status to error:', updateError);
         }
      }

      try
      {
         response.payload.game = await getGameWithCounts(gameId, client);
      }
      catch (error)
      {
         console.error('🎮 StartGameService: Error getting game with counts:', error);
      }
      finally
      {
         this.serverBus.emit('game.start:mapGenerated', { gameId });
         this.serverBus.emit('system:gameUpdated', response);
         client.release();
      }
   }

   async startPlayerPlacement(context)
   {
      myLogger('info', 'StartGameService: Starting player placement', { data: context });
      const { transactionId, gameId } = context;
      const response =
      {
         type: 'system:gameUpdated',
         entityId: gameId,
         payload: { transactionId, success: false, game: null }
      }

      const client = await pool.connect();
      const currentSubstatus = 'players_placed';

      try
      {
         await client.query('BEGIN');
         await this.placePlayers(client, gameId);
         await updateGameStatus({ id: gameId, status: 'creating', substatus: currentSubstatus, statusReason: null }, client);
         await client.query('COMMIT');
      }
      catch (error)
      {
         await client.query('ROLLBACK');
         console.error(`🎮 StartGameService: Error placing players for ${gameId}:`, error);

         try
         {
            await updateGameStatus({ id: gameId, status: 'error', substatus: currentSubstatus, statusReason: error.message || 'Player placement failed' }, client);
         }
         catch (updateError)
         {
            console.error('🎮 StartGameService: Error updating status to error:', updateError);
         }
      }

      try
      {
         response.payload.game = await getGameWithCounts(gameId, client);
      }
      catch (error)
      {
         console.error('🎮 StartGameService: Error getting game with counts:', error);
      }
      finally
      {
         this.serverBus.emit('game.start:playersPlaced', { gameId });
         this.serverBus.emit('system:gameUpdated', response);
         client.release();
      }
   }

   async startFirstTurnCreation(context)
   {
      myLogger('info', 'StartGameService: Starting first turn creation', { data: context });
      const { transactionId, gameId } = context;
      const response =
      {
         type: 'system:gameUpdated',
         entityId: gameId,
         payload: { transactionId, success: false, game: null }
      }

      const client = await pool.connect();
      const currentSubstatus = 'turn_created';

      try
      {
         await client.query('BEGIN');
         await this.createFirstTurn(client, gameId);
         await updateGameStatus({ id: gameId, status: 'creating', substatus: currentSubstatus, statusReason: null }, client);
         await client.query('COMMIT');
      }
      catch (error)
      {
         await client.query('ROLLBACK');
         console.error(`🎮 StartGameService: Error creating first turn for ${gameId}:`, error);

         try
         {
            await updateGameStatus({ id: gameId, status: 'error', substatus: currentSubstatus, statusReason: error.message || 'First turn creation failed' }, client);
         }
         catch (updateError)
         {
            console.error('🎮 StartGameService: Error updating status to error:', updateError);
         }
      }

      try
      {
         response.payload.game = await getGameWithCounts(gameId, client);
      }
      catch (error)
      {
         console.error('🎮 StartGameService: Error getting game with counts:', error);
      }
      finally
      {
         this.serverBus.emit('game.start:firstTurnCreated', { gameId });
         this.serverBus.emit('system:gameUpdated', response);
         client.release();
      }
   }

   async activateGame(context)
   {
      myLogger('info', 'StartGameService: Activating game', { data: context });
      const { transactionId, gameId } = context;
      const response =
      {
         type: 'system:gameUpdated',
         entityId: gameId,
         payload: { transactionId, game: null }
      }
      const client = await pool.connect();

      try
      {
         await client.query('BEGIN');
         await updateGameStatus({ id: gameId, status: 'running', substatus: null, statusReason: null, setStartedAt: true }, client);
         await client.query('COMMIT');
      }
      catch (error1)
      {
         await client.query('ROLLBACK');
         console.error(`🎮 StartGameService: Error activating game ${gameId}:`, error1);

         try
         {
            await updateGameStatus({ id: gameId, status: 'error', substatus: null, statusReason: error1.message || 'Game activation failed' }, client);
         }
         catch (error2)
         {
            console.error('🎮 StartGameService: Error updating status to error:', error2);
         }
      }

      try
      {
         response.payload.game = await getGameWithCounts(gameId, client);
      }
      catch (error)
      {
         console.error('🎮 StartGameService: Error getting game with counts:', error);
      }
      finally
      {
         this.serverBus.emit('system:gameUpdated', response);

         client.release();
      }
   }

   /**
    * Generate map for a game
    * @param {Object} client - Database client (transaction)
    * @param {string} gameId - Game ID
    */
   async generateMap(client, gameId)
   {
      const { rows: gameRows } = await client.query('SELECT * FROM game WHERE id = $1', [gameId]);

      if (gameRows.length !== 1)
         throw new Error(`Game with ID ${gameId} ${gameRows.length === 0 ? 'not found' : 'multiple games found'}`);

      const { seed, map_size: mapSize, density_min: densityMin, density_max: densityMax } = gameRows[0];

      if (!seed || !mapSize || densityMin === undefined || densityMax === undefined)
         throw new Error(`Game ${gameId} is missing required map generation parameters: seed, mapSize, densityMin, densityMax`);

    //   const { MapModel } = await import('../../../packages/shared/src/MapModel.js');
      const model = await generateMap({ seed, mapSize, densityMin, densityMax });

      // Insert stars
      const stars = model.getStars();
      for (const s of stars)
      {
         await client.query(
            `INSERT INTO star (id, game_id, star_id, name, sector_x, sector_y, pos_x, pos_y, pos_z, resource)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [gameId, s.getId(), s.getName(), s.getSector().col, s.getSector().row, s.getPosition().x, s.getPosition().y, s.getPosition().z, s.getResourceValue()]
         );
      }

      // Insert wormholes (ensure a<b for uniqueness)
      const wormholes = model.getWormholes();
      for (const w of wormholes)
      {
         const a = w.star1.getId();
         const b = w.star2.getId();
         const aId = a < b ? a : b;
         const bId = a < b ? b : a;
         const wormholeId = `EDGE_${aId}_${bId}`;
         await client.query(
            `INSERT INTO wormhole (id, game_id, wormhole_id, star_a_id, star_b_id)
         VALUES (gen_random_uuid(),$1,$2,$3,$4)`,
            [gameId, wormholeId, aId, bId]
         );
      }

      return {
         starsCount: stars.length,
         wormholesCount: wormholes.length
      };
   }

   /**
    * Place players on the map for a game
    * @param {Object} client - Database client (transaction)
    * @param {string} gameId - Game ID
    */
   async placePlayers(client, gameId)
   {
      myLogger('info', 'StartGameService: Placing players for game', { data: { gameId } });

      const { rows: players } = await client.query('SELECT * FROM game_player WHERE game_id = $1', [gameId]);

      if (players.length === 0)
         throw new Error('No players found for game');

      const { rows: stars } = await client.query('SELECT * FROM star WHERE game_id = $1', [gameId]);

      if (stars.length === 0)
         throw new Error('No stars found for game');

      let playersPlaced = 0;

      for (const player of players)
      {
         let placed = false;
         let attempts = 0;
         const maxAttempts = 100;

         myLogger('info', 'StartGameService: Placing player on game', { data: { playerId: player.id, gameId } });

         while (!placed && attempts < maxAttempts)
         {
            const randomStar = stars[Math.floor(Math.random() * stars.length)];

            const { rows: existingOwner } = await client.query('SELECT owner_player FROM star_state WHERE game_id = $1 AND star_id = $2', [gameId, randomStar.star_id]);
            if (existingOwner.length === 0 || !existingOwner[0].owner_player)
            {
               // Star is unowned, place player here
               await client.query('UPDATE star SET resource = 10 WHERE game_id = $1 AND star_id = $2', [gameId, randomStar.star_id]);

               await upsertStarState({ gameId, starId: randomStar.star_id, ownerPlayer: player.id, economy: { industry: 10, available: 10, technology: 3 }, details: {} }, client);

               // Create three ships for the player at their home star
               for (let shipIndex = 0; shipIndex < 3; shipIndex++)
                  await addShip({ gameId, ownerPlayer: player.id, locationStarId: randomStar.star_id, hp: 3, power: 3, details: {} }, client);

               myLogger('info', 'StartGameService: Placed player on star with ships', { data: { playerId: player.id, gameId, starId: randomStar.star_id, shipsCreated: 3 } });
               playersPlaced++;
               placed = true;
            }
            else
               attempts++;
         }

         if (!placed)
            throw new Error(`Could not find unowned star for player ${player.id} after ${maxAttempts} attempts`);
      }

      myLogger('info', 'StartGameService: Successfully placed players', { data: { gameId, playersPlaced } });
      return { playersPlaced };
   }

   /**
    * Create the first turn for a game
    * @param {Object} client - Database client (transaction)
    * @param {string} gameId - Game ID
    */
   async createFirstTurn(client, gameId)
   {
      myLogger('info', 'StartGameService: Creating first turn for game', { data: { gameId } });
      const turn = await openTurn({ gameId, number: 1 }, client);
      myLogger('info', 'StartGameService: Created first turn', { data: { gameId, turnNumber: turn.number, turnId: turn.id } });
      return turn;
   }

   /**
    * Start a game - orchestrates the entire game initialization process
    * Steps execute sequentially:
    * 1. Generate map (substatus: map_generated)
    * 2. Place players (substatus: players_placed)
    * 3. Create first turn (substatus: turn_created)
    * 4. On success: status = running, substatus = null
    * 5. On error: status = error, preserve substatus, set status_reason
    * 
    * @param {string} gameId - Game ID
    * @throws {Error} On any failure during the process
    */
   async startGame({ gameId, userId, userRole })
   {
      myLogger('info', 'StartGameService: Starting game', { data: { gameId, userId, userRole } });

      const { rows: playerRows } = await pool.query(`SELECT COUNT(*) as count FROM game_player WHERE game_id = $1 AND status = 'active'`, [gameId]);
      const activePlayerCount = parseInt(playerRows[0].count);
      const { correlationId } = asyncLocalStorage.getStore();

      if (activePlayerCount < 2)
         throw SystemError.withSafeMessage(`Game must have at least 2 active players. Current: ${activePlayerCount}`, 400);

      this.serverBus.emit('game.start:startGame', { correlationId, gameId, userId, userRole }); // does not wait for the event to be processed, returns immediately
   }
}

// Export singleton instance
export const startGameService = new StartGameService();
