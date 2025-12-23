/**
 * GameStateManager - Singleton manager for game state
 * Centralizes all game data and handles game:gameLoaded and game:gameRefreshed events
 */
import { eventBus } from '../eventBus.js';
import { ApiEvent } from '../events/Events.js';
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
    * @param {Object} event - Event data containing complete game state
    */
   handleGameLoaded(event)
   {
      console.log('📦 GameStateManager: Received game:gameLoaded event');
      console.log('📦 GameStateManager: Event data:', event);
      console.log('📦 GameStateManager: Instance:', this);

      if (event.isError())
        throw new ApiError('📦 GameStateManager: game:gameLoaded event was not successful or missing details', 500);

      const {gameId, currentPlayerId, stars, wormholes, players, gameInfo, turn, starStates, ships, orders, events} = event.data;

      // Replace all fields
      this.#gameId = gameId;
      this.#currentPlayerId = currentPlayerId || null;
      this.#stars = stars || null;
      this.#wormholes = wormholes || null;
      this.#players = players || null;
      this.#gameInfo = gameInfo || null;

      // Build star map for fast lookup by star_id
      this.#buildStarMap();

      // Build player map for fast lookup by player id
      this.#buildPlayerMap();

      // Replace refreshable fields
      this.#turn = turn || null;
      this.#state = starStates || null;
      this.#ships = ships || null;
      this.#orders = orders || null;
      this.#events = events || null;

      this.applyState();

      eventBus.emit('game:gameReady', new ApiEvent('game:gameReady', {refreshed: false}));
   }

   /**
    * Handle game:gameRefreshed event - only updates refreshable fields
    * @param {Object} context - Current system context
    * @param {Object} event - Event data containing refreshed game state
    */
   handleGameRefreshed(event)
   {
      console.log('📦 GameStateManager: Received game:gameRefreshed event');
      console.log('📦 GameStateManager: Event data:', event);
      console.log('📦 GameStateManager: Instance:', this);

      if (!event.success || !event.details || !event?.details?.turn || !event?.details?.state || !event?.details?.ships || !event?.details?.orders || !event?.details?.events)
        throw new ApiError('📦 GameStateManager: game:gameRefreshed event was not successful or missing details', 500);

      // Only update refreshable fields (do NOT update gameId, stars, wormholes, players)
      this.#turn = event.details.turn;
      this.#state = state;
      this.#ships = ships;
      this.#orders = orders;
      this.#events = events;

      this.applyState();

      eventBus.emit('game:gameReady', new ApiEvent('game:gameReady', {refreshed: true}));
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
      console.log('📦 GameStateManager: Applying state');

      if (!this.#state || !Array.isArray(this.#state))
         return eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'No state to apply', type: 'error'})); // void function

      for (const stateRecord of this.#state)
      {
         const star = this.getStarByStarId(stateRecord.star_id);

         if (!star)
            throw new ApiError(`📦 GameStateManager: Star not found for star_id: ${stateRecord.star_id}`, 404);

         const player = this.#playerMap.get(stateRecord.owner_player) || null;

         star.owner = player;
         star.color = player?.color_hex || '#cccccc';
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

      eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'State applied to stars and ships', type: 'success'})); // void function
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

   get stars()
   {
      return this.#stars;
   }

   /**
    * Get complete game state
    * @returns {Object} Complete game state object
    */
   get gameState()
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
