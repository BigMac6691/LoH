/**
 * GameStateManager - Singleton manager for game state
 * Centralizes all game data and handles game:gameLoaded and game:gameRefreshed events
 */
import
{
   eventBus
}
from '../eventBus.js';
import { ApiError } from '../utils/RequestBuilder.js';

class GameStateManager
{
   // Private fields that do NOT change between turns (only set on game:gameLoaded)
   #gameId = null;
   #stars = null;
   #wormholes = null;
   #players = null;
   #gameInfo = null; // Includes map_size, seed, etc.
   #starMap = new Map(); // Map of star_id -> star object for fast lookup
   #playerMap = new Map(); // Map of player id -> player object for fast lookup

   // Private fields that DO change between turns (updated on both events)
   #turn = null;
   #state = null; // star_state / starStates
   #ships = null;
   #orders = null;
   #events = null;

   // Additional private metadata
   #currentPlayerId = null;

   constructor()
   {
      // Set up event listeners
      this.setupEventListeners();
   }

   /**
    * Set up event listeners for game state events
    */
   setupEventListeners()
   {
      eventBus.on('game:gameLoaded', this.handleGameLoaded.bind(this));
      eventBus.on('game:gameRefreshed', this.handleGameRefreshed.bind(this));
   }

   /**
    * Handle game:gameLoaded event - replaces all game state
    * @param {Object} context - Current system context
    * @param {Object} eventData - Event data containing complete game state
    */
   handleGameLoaded(context, eventData)
   {
      console.log('📦 GameStateManager: Received game:gameLoaded event');
      console.log('📦 GameStateManager: Event data:', eventData);
      console.log('📦 GameStateManager: Instance:', this);

      if (!eventData.success || !eventData.details || !eventData?.details?.gameData)
        throw new ApiError('📦 GameStateManager: game:gameLoaded event was not successful or missing details', 500);

      const
      {
         gameId,
         gameData,
         currentTurn
      } = eventData.details;

      // Replace all fields
      this.#gameId = gameId;
      this.#stars = gameData.stars || null;
      this.#wormholes = gameData.wormholes || null;
      this.#players = gameData.players || null;
      this.#gameInfo = gameData.gameInfo || null;

      // Build star map for fast lookup by star_id
      this.#buildStarMap();

      // Build player map for fast lookup by player id
      this.#buildPlayerMap();

      // Replace refreshable fields
      this.#turn = currentTurn || null;
      this.#state = gameData.starStates || gameData.state || null;
      this.#ships = gameData.ships || null;
      this.#orders = gameData.orders || null;
      this.#events = gameData.events || null;

      // Set current player ID if available
      this.#currentPlayerId = gameData.currentPlayerId || null;

      // Apply state to stars (sets economy and owner_player from state records)
      this.applyState();

      console.log('📦 GameStateManager: Game state fully loaded');
      console.log('📦 GameStateManager: Game ID:', this.#gameId);
      console.log('📦 GameStateManager: Stars:', this.#stars?.length || 0);
      console.log('📦 GameStateManager: Star map size:', this.#starMap.size);
      console.log('📦 GameStateManager: Wormholes:', this.#wormholes?.length || 0);
      console.log('📦 GameStateManager: Players:', this.#players?.length || 0);
      console.log('📦 GameStateManager: Player map size:', this.#playerMap.size);
      console.log('📦 GameStateManager: Current Turn:', this.#turn?.number || null);
      console.log('📦 GameStateManager: Orders:', this.#orders?.length || 0);
      console.log('📦 GameStateManager: Events:', this.#events?.length || 0);
   }

   /**
    * Handle game:gameRefreshed event - only updates refreshable fields
    * @param {Object} context - Current system context
    * @param {Object} eventData - Event data containing refreshed game state
    */
   handleGameRefreshed(context, eventData)
   {
      console.log('📦 GameStateManager: Received game:gameRefreshed event');
      console.log('📦 GameStateManager: Event data:', eventData);
      console.log('📦 GameStateManager: Instance:', this);

      if (!eventData.success || !eventData.details || !eventData?.details?.turn || !eventData?.details?.state || !eventData?.details?.ships || !eventData?.details?.orders || !eventData?.details?.events)
        throw new ApiError('📦 GameStateManager: game:gameRefreshed event was not successful or missing details', 500);

      // Only update refreshable fields (do NOT update gameId, stars, wormholes, players)
      this.#turn = eventData.details.turn;
      this.#state = state;
      this.#ships = ships;
      this.#orders = orders;
      this.#events = events;

      // Apply state to stars (updates economy and owner_player from state records)
      this.applyState();

      console.log('📦 GameStateManager: Game state refreshed');
      console.log('📦 GameStateManager: Current Turn:', this.#turn?.number || null);
      console.log('📦 GameStateManager: State entries:', this.#state?.length || 0);
      console.log('📦 GameStateManager: Ships:', this.#ships?.length || 0);
      console.log('📦 GameStateManager: Orders:', this.#orders?.length || 0);
      console.log('📦 GameStateManager: Events:', this.#events?.length || 0);
   }

   /**
    * Build the star map for fast lookup by star_id
    * @private
    */
   #buildStarMap()
   {
      this.#starMap.clear();

      if (!this.#stars || !Array.isArray(this.#stars))
         throw new ApiError('📦 GameStateManager: No stars to build star map', 500);

      for (const star of this.#stars)
      {
        star.owner = null;
        star.color = '#cccccc';
        star.economy = null;
        star.ships = [];

        this.#starMap.set(star.star_id, star);
      }

      console.log('📦 GameStateManager: Built star map with', this.#starMap.size, 'entries');
   }

   /**
    * Build the player map for fast lookup by player id
    * @private
    */
   #buildPlayerMap()
   {
      this.#playerMap.clear();

      if (!this.#players || !Array.isArray(this.#players))
         throw new ApiError('📦 GameStateManager: No players to build player map', 500);

      for (const player of this.#players)
        this.#playerMap.set(player.id, player);
      
      console.log('📦 GameStateManager: Built player map with', this.#playerMap.size, 'entries');
   }

   /**
    * Get a star by its star_id
    * @param {string} starId - The star_id to look up
    * @returns {Object|null} The star object or null if not found
    */
   getStarByStarId(starId)
   {
      if (!starId)
         return null;

      return this.#starMap.get(starId) || null;
   }

   /**
    * Get a player by their player id
    * @param {string} playerId - The player id to look up
    * @returns {Object|null} The player object or null if not found
    */
   getPlayerById(playerId)
   {
      if (!playerId)
         return null;

      return this.#playerMap.get(playerId) || null;
   }

   /**
    * Apply state records to stars
    * Updates each star's economy and owner_player properties from the corresponding state record
    */
   applyState()
   {
      if (!this.#state || !Array.isArray(this.#state))
      {
         console.log('📦 GameStateManager: No state to apply');
         return;
      }

      for (const stateRecord of this.#state)
      {
         const star = this.getStarByStarId(stateRecord.star_id);

         if (!star)
            throw new ApiError(`📦 GameStateManager: Star not found for star_id: ${stateRecord.star_id}`, 404);

        const player = this.#playerMap.get(stateRecord.owner_player) || null;
            
        star.owner = player;
        star.color = player.color_hex ? player.color_hex : '#cccccc';
        star.economy = stateRecord.economy || null;
      }

      for(const star of this.#stars)
         star.ships = [];

      for(const ship of this.#ships)
      {
         const star = this.getStarByStarId(ship.location_star_id);

         if (!star)
            throw new ApiError(`📦 GameStateManager: Star not found for ship location_star_id: ${ship.location_star_id}`, 404);

         star.ships.push(ship);
      }

      console.log('📦 GameStateManager: Applied state to stars and ships');
   }

   /**
    * Get the current game ID
    * @returns {string|null} Game ID or null
    */
   get gameId()
   {
      return this.#gameId;
   }

   /**
    * Get all stars
    * @returns {Array|null} Stars array or null
    */
   get stars()
   {
      return this.#stars;
   }

   /**
    * Get all wormholes
    * @returns {Array|null} Wormholes array or null
    */
   get wormholes()
   {
      return this.#wormholes;
   }

   /**
    * Get all players
    * @returns {Array|null} Players array or null
    */
   get players()
   {
      return this.#players;
   }

   /**
    * Get game info (map_size, seed, etc.)
    * @returns {Object|null} Game info or null
    */
   get gameInfo()
   {
      return this.#gameInfo;
   }

   /**
    * Get current turn
    * @returns {Object|null} Current turn or null
    */
   get turn()
   {
      return this.#turn;
   }

   /**
    * Get star states
    * @returns {Array|null} Star states array or null
    */
   get state()
   {
      return this.#state;
   }

   /**
    * Get all ships
    * @returns {Array|null} Ships array or null
    */
   get ships()
   {
      return this.#ships;
   }

   /**
    * Get all orders
    * @returns {Array|null} Orders array or null
    */
   get orders()
   {
      return this.#orders;
   }

   /**
    * Get all events
    * @returns {Array|null} Events array or null
    */
   get events()
   {
      return this.#events;
   }

   /**
    * Get current player ID
    * @returns {string|null} Current player ID or null
    */
   get currentPlayerId()
   {
      return this.#currentPlayerId;
   }

   /**
    * Get complete game state
    * @returns {Object} Complete game state object
    */
   getGameState()
   {
      const currentState = 
      {
         gameId: this.#gameId,
         stars: this.#stars,
         wormholes: this.#wormholes,
         players: this.#players,
         gameInfo: this.#gameInfo,
         turn: this.#turn,
         state: this.#state,
      }

      return currentState;
   }
}

// Create singleton instance
let gameStateManagerInstance = null;

/**
 * Get the singleton GameStateManager instance
 * @returns {GameStateManager} The singleton instance
 */
export function getGameStateManager()
{
   if (!gameStateManagerInstance)
      gameStateManagerInstance = new GameStateManager();

   return gameStateManagerInstance;
}

// Export the singleton instance directly for convenience
export const gameStateManager = getGameStateManager();
