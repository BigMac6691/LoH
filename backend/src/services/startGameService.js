import { pool } from '../db/pool.js';
import { generateMap } from '../MapFactory.js';
import { updateGameStatus } from '../repos/gamesRepo.js';
import { openTurn } from '../repos/turnsRepo.js';
import { addPlayer } from '../repos/playersRepo.js';
import { upsertStarState } from '../repos/starsRepo.js';
import { addShip } from '../repos/shipsRepo.js';
import { webSocketService } from './WebSocketService.js';

/**
 * StartGameService - Orchestrates game initialization
 * Handles map generation, player placement, and initial turn creation
 */
export class StartGameService {
  /**
   * Notify clients via WebSocket about game status/substatus updates
   * @param {string} gameId - Game ID
   * @param {string} status - Game status
   * @param {string|null} substatus - Game substatus (optional)
   * @param {string|null} statusReason - Status reason (optional)
   */
  async notifyStatusUpdate(gameId, status, substatus = null, statusReason = null) {
    try {
      if (!webSocketService.io) {
        console.warn('🔌 StartGameService: Cannot notify - Socket.IO not initialized');
        return;
      }

      // Find all connections for this game
      const gameConnections = [];
      for (const [socketId, connection] of webSocketService.connections.entries()) {
        if (connection.gameId === gameId) {
          gameConnections.push(socketId);
        }
      }

      if (gameConnections.length === 0) {
        console.log(`🔌 StartGameService: No active connections for game ${gameId}`);
        return;
      }

      const updateData = {
        type: 'system:substatusUpdated',
        gameId,
        status,
        substatus,
        statusReason
      };

      // Send update to all clients viewing this game
      gameConnections.forEach(socketId => {
        const socket = webSocketService.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('system:substatusUpdated', updateData);
        }
      });

      console.log(`🔌 StartGameService: Sent status update to ${gameConnections.length} client(s) for game ${gameId}: status=${status}, substatus=${substatus}`);
    } catch (error) {
      console.error('🔌 StartGameService: Error notifying status update:', error);
      // Don't throw - WebSocket notification failure shouldn't block game creation
    }
  }

  /**
   * Update game status and notify clients
   * @param {Object} client - Database client (transaction)
   * @param {string} gameId - Game ID
   * @param {string} status - New status
   * @param {string|null} substatus - Optional substatus
   * @param {string|null} statusReason - Optional status reason
   */
  async updateStatusAndNotify(client, gameId, status, substatus = null, statusReason = null) {
    // Update in database
    await updateGameStatus({ id: gameId, status, substatus, statusReason }, client);
    
    // Notify via WebSocket
    await this.notifyStatusUpdate(gameId, status, substatus, statusReason);
  }

  /**
   * Generate map for a game
   * @param {Object} client - Database client (transaction)
   * @param {string} gameId - Game ID
   */
  async generateMap(client, gameId) {
    const { rows: gameRows } = await client.query('SELECT * FROM game WHERE id = $1', [gameId]);

    if (gameRows.length !== 1)
      throw new Error(`Game with ID ${gameId} ${gameRows.length === 0 ? 'not found' : 'multiple games found'}`);

    const { seed, mapSize, densityMin, densityMax } = gameRows[0];

    if (!seed || !mapSize || densityMin === undefined || densityMax === undefined)
      throw new Error(`Game ${gameId} is missing required map generation parameters: seed, mapSize, densityMin, densityMax`);

    const model = generateMap({ seed, mapSize, densityMin, densityMax });

    // Insert stars
    const stars = model.getStars();
    for (const s of stars) {
      await client.query(
        `INSERT INTO star (id, game_id, star_id, name, sector_x, sector_y, pos_x, pos_y, pos_z, resource)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [gameId, s.getId(), s.getName(), s.getSector().col, s.getSector().row, s.getPosition().x, s.getPosition().y, s.getPosition().z, s.getResourceValue()]
      );
    }

    // Insert wormholes (ensure a<b for uniqueness)
    const wormholes = model.getWormholes();
    for (const w of wormholes) {
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
  async placePlayers(client, gameId) {
    console.log(`🎮 StartGameService: Placing players for game: ${gameId}`);

    const { rows: players } = await client.query(
      `SELECT * FROM game_player WHERE game_id = $1`,
      [gameId]
    );

    if (players.length === 0) {
      throw new Error('No players found for game');
    }

    const { rows: stars } = await client.query(
      `SELECT * FROM star WHERE game_id = $1`,
      [gameId]
    );

    if (stars.length === 0) {
      throw new Error('No stars found for game');
    }

    let playersPlaced = 0;

    for (const player of players) {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100;

      console.log(`🎮 StartGameService: Placing player ${player.id} on game ${gameId}`);

      while (!placed && attempts < maxAttempts) {
        const randomStar = stars[Math.floor(Math.random() * stars.length)];

        const { rows: existingOwner } = await client.query(
          `SELECT owner_player FROM star_state WHERE game_id = $1 AND star_id = $2`,
          [gameId, randomStar.star_id]
        );

        if (existingOwner.length === 0 || !existingOwner[0].owner_player) {
          // Star is unowned, place player here
          await client.query(
            `UPDATE star SET resource = 10 WHERE game_id = $1 AND star_id = $2`,
            [gameId, randomStar.star_id]
          );

          await upsertStarState({
            gameId: gameId,
            starId: randomStar.star_id,
            ownerPlayer: player.id,
            economy: { industry: 10, available: 10, technology: 3 },
            details: {}
          }, client);

          // Create three ships for the player at their home star
          for (let shipIndex = 0; shipIndex < 3; shipIndex++) {
            await addShip({
              gameId: gameId,
              ownerPlayer: player.id,
              locationStarId: randomStar.star_id,
              hp: 3,
              power: 3,
              details: {}
            }, client);
          }

          console.log(`🎮 StartGameService: Placed player ${player.id} on star ${randomStar.star_id} with 3 ships`);
          playersPlaced++;
          placed = true;
        } else {
          attempts++;
        }
      }

      if (!placed) {
        throw new Error(`Could not find unowned star for player ${player.id} after ${maxAttempts} attempts`);
      }
    }

    console.log(`🎮 StartGameService: Successfully placed ${playersPlaced} players`);
    return { playersPlaced };
  }

  /**
   * Create the first turn for a game
   * @param {Object} client - Database client (transaction)
   * @param {string} gameId - Game ID
   */
  async createFirstTurn(client, gameId) {
    console.log(`🎮 StartGameService: Creating first turn for game: ${gameId}`);
    const turn = await openTurn({ gameId, number: 1 }, client);
    console.log(`🎮 StartGameService: Created turn ${turn.number} (ID: ${turn.id})`);
    return turn;
  }

  /**
   * Start a game - orchestrates the entire game initialization process
   * Steps execute sequentially:
   * 1. Generate map (substatus: generating_map)
   * 2. Place players (substatus: placing_players)
   * 3. Create first turn (substatus: creating_turn)
   * 4. On success: status = running, substatus = null
   * 5. On error: status = error, preserve substatus, set status_reason
   * 
   * @param {string} gameId - Game ID
   * @throws {Error} On any failure during the process
   */
  async startGame(gameId) {
    const client = await pool.connect();
    let currentSubstatus = null;

    try {
      await client.query('BEGIN');

      // Step 1: Generate map
      console.log(`🎮 StartGameService: Starting game ${gameId} - Step 1: Generating map`);
      currentSubstatus = 'generating_map';
      await this.updateStatusAndNotify(client, gameId, 'creating', currentSubstatus);
      await this.generateMap(client, gameId);

      // Step 2: Place players
      console.log(`🎮 StartGameService: Step 2: Placing players`);
      currentSubstatus = 'placing_players';
      await this.updateStatusAndNotify(client, gameId, 'creating', currentSubstatus);
      await this.placePlayers(client, gameId);

      // Step 3: Create first turn
      console.log(`🎮 StartGameService: Step 3: Creating first turn`);
      currentSubstatus = 'creating_turn';
      await this.updateStatusAndNotify(client, gameId, 'creating', currentSubstatus);
      await this.createFirstTurn(client, gameId);

      // Step 4: Success - update to running
      console.log(`🎮 StartGameService: Game ${gameId} started successfully`);
      await this.updateStatusAndNotify(client, gameId, 'running', null, null);

      await client.query('COMMIT');
      console.log(`🎮 StartGameService: Game ${gameId} initialization complete`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`🎮 StartGameService: Error starting game ${gameId}:`, error);

      // Update to error status, preserve current substatus, set status_reason
      try {
        await this.updateStatusAndNotify(
          client,
          gameId,
          'error',
          currentSubstatus,
          error.message || 'Game initialization failed'
        );
      } catch (notifyError) {
        console.error('🎮 StartGameService: Error updating status to error:', notifyError);
      }

      throw error; // Re-throw so caller knows it failed
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const startGameService = new StartGameService();

// Backward compatibility: Export old function names
import { createGame } from '../repos/gamesRepo.js';

export async function createEmptyGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, maxPlayers, status, params = {} })
{
  const client = await pool.connect();
  try
  {
    await client.query('BEGIN');

    const game = await createGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, maxPlayers, params, status }, client);

    await client.query('COMMIT');
    return { game };
  }
  catch (e)
  {
    await client.query('ROLLBACK');
    throw e;
  }
  finally
  {
    client.release();
  }
}

export async function generateMapForGame({ gameId })
{
  const client = await pool.connect();
  try
  {
    await client.query('BEGIN');
    await startGameService.generateMap(client, gameId);
    await client.query('COMMIT');
    return { success: true };
  }
  catch (e)
  {
    await client.query('ROLLBACK');
    throw e;
  }
  finally
  {
    client.release();
  }
}

export async function placePlayersForGame({ gameId })
{
  const client = await pool.connect();
  try
  {
    await client.query('BEGIN');
    const result = await startGameService.placePlayers(client, gameId);
    await client.query('COMMIT');
    return result;
  }
  catch (e)
  {
    await client.query('ROLLBACK');
    throw e;
  }
  finally
  {
    client.release();
  }
}

