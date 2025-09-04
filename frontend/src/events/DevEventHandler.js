/**
 * Development Event Handler - Manages development-specific events
 * Handles scenario loading, testing, and other development workflows
 */
import { eventBus } from '../eventBus.js';

export class DevEventHandler
{
  constructor()
  {
    // Initialize the four maps as specified
    this.gameData = new Map();
    this.playerData = new Map();
    this.shipData = new Map();
    this.gameTracker = new Map(); // game id -> scenario
    
    // Initialize scenario data
    this.initializeScenarioData();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Initialize the scenario data maps
   */
  initializeScenarioData()
  {
    // Initial game map
    this.gameData.set("simple-two-player", {
      ownerId: "a109d369-0df3-4e73-b262-62c793ad743f",
      title: "simple-two-player",
      description: "Simple game with two players and one ship each",
      seed: 12345,
      mapSize: 5,
      densityMin: 3,
      densityMax: 7,
      status: 'lobby',
      params: JSON.stringify({
        type: 'devScenario',
        scenario: 'simple-two-player',
        state:
        {
          playersAdded: false,
          mapGenerated: false,
          playersPlaced: false,
          shipsPlaced: false,
          specialsApplied: false
        }
      })
    });

    // Initial players map
    this.playerData.set("simple-two-player", [
      {
        userId: "7a0fc466-218e-49cf-9235-7a3d0d197b96",
        name: "Big Red",
        color_hex: "#ff0000",
        country_name: "Red Empire"
      },
      {
        userId: "93046edf-11c1-4e70-83a2-afebb209a343",
        name: "Great Blue",
        color_hex: "#0000ff",
        country_name: "Blue Kingdom"
      }
    ]);

    // Initialize ship data map (empty for now)
    this.shipData.set("simple-two-player", [
      {
        owner_player: "7a0fc466-218e-49cf-9235-7a3d0d197b96",
        location_star_id: "X",
        hp: 3,
        power: 3
      },
      {
        owner_player: "93046edf-11c1-4e70-83a2-afebb209a343",
        location_star_id: "X",
        hp: 3,
        power: 3
      }
    ]);
  }

  /**
   * Set up event listeners for development events
   */
  setupEventListeners()
  {
    // Listen for dev events
    eventBus.on('dev:loadScenario', this.loadScenario.bind(this));
    eventBus.on('dev:createGame', this.createGame.bind(this));
    eventBus.on('dev:addPlayers', this.addPlayers.bind(this));
    eventBus.on('dev:generateMap', this.generateMap.bind(this));
    eventBus.on('dev:placePlayers', this.placePlayers.bind(this));
    eventBus.on('dev:placeShips', this.placeShips.bind(this));
    eventBus.on('dev:applySpecials', this.applySpecials.bind(this));
    eventBus.on('dev:startGame', this.startGame.bind(this));
    
    // Listen for game events
    eventBus.on('game:gameCreated', this.loadScenario.bind(this));
    eventBus.on('game:playerAdded', this.loadScenario.bind(this));
    eventBus.on('game:mapGenerated', this.loadScenario.bind(this));
    eventBus.on('game:playersPlaced', this.loadScenario.bind(this));
    eventBus.on('game:shipPlaced', this.loadScenario.bind(this));
    
    eventBus.on('game:gameLoaded', this.handleGameLoaded.bind(this));
  }

  /**
   * Handle scenario loading event - now the central state machine driver
   * @param {Object} context - Current system context (user, gameId)
   * @param {Object} eventData - Event data with standardized format
   */
  async loadScenario(context, eventData)
  {
    console.log('🧪 DevEventHandler: Loading scenario with event data:', eventData);
    console.log('🧪 DevEventHandler: Context:', context);
    
    try
    {
      // Check if this is a dev event or game event
      if (eventData && eventData.details && eventData.details.eventType) {
        const eventType = eventData.details.eventType;
        
        if (eventType.startsWith('dev:')) {
          // This is a dev event, continue normally
          console.log('🧪 DevEventHandler: Processing dev event:', eventType);
          
          if (eventType === 'dev:loadScenario') {
            const scenario = eventData.details.scenario;
            await this.processLoadScenario(scenario);
          }
        } else {
          // This is a game event, just log for now
          console.log('🧪 DevEventHandler: Received game event:', eventType, 'Details:', eventData.details);
          return;
        }
      } else {
        // Legacy format or invalid data, try to extract scenario
        console.log('🧪 DevEventHandler: Legacy format detected, attempting to extract scenario');
        const scenario = typeof eventData === 'string' ? eventData : eventData?.scenario;
        if (scenario) {
          await this.processLoadScenario(scenario);
        } else {
          console.error('🧪 DevEventHandler: Could not extract scenario from event data:', eventData);
        }
      }
    }
    catch (error)
    {
      console.error('🧪 DevEventHandler: Error in loadScenario:', error);
      
      // Emit error event with simplified format
      eventBus.emit('dev:scenarioStatus', { 
        type: 'error', 
        message: error.message || 'Failed to load scenario',
        scenario: 'unknown'
      });
    }
  }

  /**
   * Process the actual scenario loading logic
   * @param {string} scenario - Scenario name to load
   */
  async processLoadScenario(scenario)
  {
    console.log('🧪 DevEventHandler: Processing scenario:', scenario);
    
    try
    {
      // Check for existing game first
      const gameInfo = await this.checkGame(scenario);
      
      if (gameInfo)
      {
        if (gameInfo.status === 'running')
        {
          // Game is already running, load it
          eventBus.emit('dev:scenarioStatus', { type: 'loadingGame', scenario });
          eventBus.emit('game:loadGame', { gameId: gameInfo.id });
          return;
        }
        
        // Game exists but is in lobby, use database state to continue
        console.log('🧪 DevEventHandler: Found existing game, using database state:', gameInfo.state);
        
        // Execute next step based on database state
        await this.executeNextStep(scenario, gameInfo);
        return;
      }
      
      // No game found, create a new one
      console.log('🧪 DevEventHandler: No game found, creating new game for scenario:', scenario);
      eventBus.emit('dev:createGame', { scenario });
    }
    catch (error)
    {
      console.error('🧪 DevEventHandler: Error in processLoadScenario:', error);
      throw error;
    }
  }

  /**
   * Check if there is a game in the database with title equal to the scenario
   * @param {string} scenario - Scenario name to check
   * @returns {Promise<Object|null>} Game info with gameId and status, or null if not found
   */
  async checkGame(scenario)
  {
    try {
      console.log(`🔍 DevEventHandler: Checking for scenario: ${scenario}`);
      
      const response = await fetch(`/api/dev/games/check/${scenario}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.found) {
        console.log(`🔍 DevEventHandler: No game found for scenario: ${scenario}`);
        return null;
      }
      
      if (data.error === 'duplicateGames') {
        eventBus.emit('dev:scenarioStatus', {
          type: 'error',
          message: data.message,
          scenario
        });
        throw new Error(data.message);
      }
      
      console.log(`✅ DevEventHandler: Found game for scenario: ${scenario}`, data.game);
      return data.game;
      
    } catch (error) {
      console.error(`❌ DevEventHandler: Error checking game for scenario ${scenario}:`, error);
      eventBus.emit('dev:scenarioStatus', {
        type: 'error',
        message: `Failed to check game: ${error.message}`,
        scenario
      });
      throw error;
    }
  }

  /**
   * Create a game for the given scenario
   * @param {Object} context - Current system context
   * @param {Object} data - Event data containing scenario
   */
  createGame(context, data)
  {
    console.log('🧪 DevEventHandler: Creating game with data:', data);
    
    // Extract scenario from standardized format or legacy format
    let scenario;
    if (data && data.details && data.details.scenario) {
      scenario = data.details.scenario;
    } else if (data && data.scenario) {
      scenario = data.scenario;
    } else {
      console.error('🧪 DevEventHandler: No scenario found in data:', data);
      return;
    }
    
    console.log('🧪 DevEventHandler: Creating game for scenario:', scenario);
    
    // Emit status update
    eventBus.emit('dev:scenarioStatus', { type: 'creatingGame', scenario });
    
    // Get game data from the map
    const gameData = this.gameData.get(scenario);
    if (!gameData)
    {
      console.error('🧪 DevEventHandler: No game data found for scenario:', scenario);
      return;
    }
    
    // Emit game creation event
    eventBus.emit('game:createGame', gameData);
  }

  /**
   * Get a list of players currently added to a given game
   * @param {string} gameId - Game ID to check
   * @returns {Promise<Array>} List of current players
   */
  async listGamePlayers(gameId)
  {
    console.log('🧪 DevEventHandler: Listing players for game:', gameId);
    
    try
    {
      // Get players from the backend API
      const response = await fetch(`/api/dev/games/${encodeURIComponent(gameId)}/players`);
      
      if (!response.ok)
      {
        const errorData = await response.json();
        console.error('🧪 DevEventHandler: Error getting game players:', errorData);
        throw new Error(`Failed to get game players: ${errorData.error || 'Unknown error'}`);
      }
      
      const data = await response.json();
      const players = data.players || [];
      
      console.log('🧪 DevEventHandler: Found players for game:', players);
      
      return players;      
    }
    catch (error)
    {
      console.error('🧪 DevEventHandler: Error in listGamePlayers:', error);
      
      // Always throw on API failures - we need to distinguish between no players and request failures
      throw error;
    }
  }

  /**
   * Add players to a game for a scenario
   * @param {Object} context - Current system context
   * @param {Object} data - Event data
   */
  async addPlayers(context, data) {
    console.log('🧪 DevEventHandler: Adding players with data:', data);
    
    // Extract scenario and gameId from standardized format or legacy format
    let scenario, gameId;
    if (data && data.details) {
      scenario = data.details.scenario;
      gameId = data.details.gameId;
    } else {
      scenario = data.scenario;
      gameId = data.gameId;
    }
    
    if (!scenario || !gameId) {
      console.error('🧪 DevEventHandler: Missing scenario or gameId in data:', data);
      return;
    }
    
    console.log('🧪 DevEventHandler: Adding players for scenario:', scenario, 'game:', gameId);
    
    // Get current players
    const currentPlayers = await this.listGamePlayers(gameId);
    
    // Get required players from the map
    const requiredPlayers = this.playerData.get(scenario) || [];

    if(currentPlayers.length === requiredPlayers.length)
    {
      console.log('🧪 DevEventHandler: All players added for scenario:', scenario);
      
      // Update database state to mark players as added
      await this.updateGameState(gameId, { playersAdded: true });
      
      eventBus.emit('dev:scenarioStatus', { type: 'allPlayersAdded', scenario });
      
      // Continue with next step using standardized format
      eventBus.emit('dev:loadScenario', {
        success: true,
        details: {
          eventType: 'dev:loadScenario',
          gameId: gameId,
          scenario: scenario
        }
      });

      return;
    }

    // Loop through required players and add missing ones
    requiredPlayers.forEach(player => {
      if (!currentPlayers.find(cp => cp.user_id === player.userId))
      {
        console.log('🧪 DevEventHandler: Adding missing player:', player.name);
        // Emit status update
        eventBus.emit('dev:scenarioStatus', { type: 'addingPlayers', scenario, playerName: player.name });
        
        // Emit player addition event
        eventBus.emit('game:addPlayer', { ...player, gameId });
      }
    });
  }

  /**
   * Apply special rules for a scenario
   * @param {Object} data - Event data
   * @param {string} data.scenario - Scenario name
   * @param {string} data.gameId - Game ID
   */
  applySpecials(context, data)
  {
    const { scenario, gameId } = data;
    console.log('🧪 DevEventHandler: Applying special rules for scenario:', scenario, 'game:', gameId);
    
    // Emit status update
    eventBus.emit('dev:scenarioStatus', { type: 'applyingSpecialRules', scenario });
    
    // Switch statement for scenario-specific setup
    switch (scenario)
    {
      case 'simple-two-player':
        this.createSimpleTwoPlayer(gameId);
        break;
      default:
        console.log('🧪 DevEventHandler: No special setup for scenario:', scenario);
        // Still emit loading events for scenarios without special setup
        eventBus.emit('dev:scenarioStatus', { type: 'loadingGame', scenario });
        eventBus.emit('game:loadGame', gameId);
        break;
    }
  }

  /**
   * Generate map for a scenario
   * @param {Object} data - Event data
   * @param {string} data.scenario - Scenario name
   * @param {string} data.gameId - Game ID
   */
  generateMap(context, data)
  {
    const { scenario, gameId } = data;
    console.log('🧪 DevEventHandler: Generating map for scenario:', scenario, 'game:', gameId);
    
    // Emit status update
    eventBus.emit('dev:scenarioStatus', { type: 'generatingMap', scenario });
    
    // Emit game map generation event
    eventBus.emit('game:generateMap', { scenario, gameId });
  }

  /**
   * Place players on the map for a scenario
   * @param {Object} data - Event data
   * @param {string} data.scenario - Scenario name
   * @param {string} data.gameId - Game ID
   */
  placePlayers(context, data)
  {
    const { scenario, gameId } = data;
    console.log('🧪 DevEventHandler: Placing players for scenario:', scenario, 'game:', gameId);
    
    // Emit status update
    eventBus.emit('dev:scenarioStatus', { type: 'placingPlayers', scenario });
    
    // Emit game player placement event
    eventBus.emit('game:placePlayers', { scenario, gameId });
  }

  /**
   * Place ships for a scenario
   * @param {Object} data - Event data
   * @param {string} data.scenario - Scenario name
   * @param {string} data.gameId - Game ID
   */
  placeShips(context, data)
  {
    const { scenario, gameId } = data;
    console.log('🧪 DevEventHandler: Placing ships for scenario:', scenario, 'game:', gameId);
    
    // Emit status update
    eventBus.emit('dev:scenarioStatus', { type: 'placingShips', scenario });
    
    // Emit game ship placement event
    eventBus.emit('game:placeShips', { scenario, gameId });
  }

  /**
   * Start game for a scenario
   * @param {Object} data - Event data
   * @param {string} data.scenario - Scenario name
   * @param {string} data.gameId - Game ID
   */
  startGame(context, data)
  {
    const { scenario, gameId } = data;
    console.log('🧪 DevEventHandler: Starting game for scenario:', scenario, 'game:', gameId);
    
    // Emit status update
    eventBus.emit('dev:scenarioStatus', { type: 'startingGame', scenario });
    
    // Emit game start event
    eventBus.emit('game:startGame', { gameId });
  }

  /**
   * Create simple two player scenario setup
   * @param {string} gameId - Game ID
   */
  createSimpleTwoPlayer(gameId)
  {
    console.log('🧪 DevEventHandler: Creating simple two player setup for game:', gameId);
    
    // TODO: Add any special setup conditions here
    
    // When done, emit loading events
    eventBus.emit('dev:scenarioStatus', { type: 'loadingGame', scenario: 'simple-two-player' });
    eventBus.emit('game:loadGame', gameId);
  }


  /**
   * Handle game loaded event
   * @param {Object} context - Current context
   * @param {string} gameId - Game ID
   */
  handleGameLoaded(context, gameId)
  {
    console.log('🧪 DevEventHandler: Game loaded:', gameId);
    
    // Emit status update
    const gameTrackerData = this.gameTracker.get(gameId);
    const scenario = gameTrackerData ? gameTrackerData.scenario : null;
    eventBus.emit('dev:scenarioStatus', { type: 'gameLoaded', scenario });
  }


  /**
   * Execute the next step of scenario setup based on current state
   * @param {string} scenario - Scenario name
   * @param {Object} gameInfo - Game info from database (includes id and state)
   */
  async executeNextStep(scenario, gameInfo)
  {
    const { id: gameId, state } = gameInfo;
    const { playersAdded, mapGenerated, playersPlaced, shipsPlaced, specialsApplied } = state;

    if (!playersAdded)
    {
      console.log('🧪 DevEventHandler: Need to add players.');
      eventBus.emit('dev:addPlayers', { scenario, gameId });
    }
    else if (!mapGenerated)
    {
      console.log('🧪 DevEventHandler: Need to generate map.');
      eventBus.emit('game:generateMap', { scenario, gameId });
    }
    else if (!playersPlaced)
    {
      console.log('🧪 DevEventHandler: Need to place players.');
      eventBus.emit('game:placePlayers', { scenario, gameId });
    }
    else if (!shipsPlaced)
    {
      console.log('🧪 DevEventHandler: Need to place ships.');
      eventBus.emit('game:placeShips', { scenario, gameId });
    }
    else if (!specialsApplied)
    {
      console.log('🧪 DevEventHandler: Need to apply special rules.');
      eventBus.emit('dev:applySpecials', { scenario, gameId });
    }
    else
    {
      console.log('🧪 DevEventHandler: Scenario setup complete.');
      eventBus.emit('dev:scenarioStatus', { type: 'scenarioSetupComplete', scenario });
      // Optionally, emit a final game start event
      eventBus.emit('game:startGame', { gameId });
    }
  }

  /**
   * Update game state in database after completing a step
   * @param {string} gameId - Game ID
   * @param {Object} stateUpdate - State fields to update
   */
  async updateGameState(gameId, stateUpdate)
  {
    try
    {
      console.log(`🔄 DevEventHandler: Updating game state for ${gameId}:`, stateUpdate);
      
      const response = await fetch(`/api/dev/games/${gameId}/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state: stateUpdate })
      });
      
      if (!response.ok)
      {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ DevEventHandler: Game state updated:`, result);
      
      return result;
    }
    catch (error)
    {
      console.error(`❌ DevEventHandler: Error updating game state:`, error);
      throw error;
    }
  }

  /**
   * Clean up event listeners
   */
  dispose()
  {
    eventBus.off('dev:loadScenario', this.loadScenario.bind(this));
    eventBus.off('dev:createGame', this.createGame.bind(this));
    eventBus.off('dev:addPlayers', this.addPlayers.bind(this));
    eventBus.off('dev:applySpecials', this.applySpecials.bind(this));

    eventBus.off('game:gameCreated', this.loadScenario.bind(this));
    eventBus.off('game:mapGenerated', this.loadScenario.bind(this));
    eventBus.off('game:playerAdded', this.loadScenario.bind(this));
    eventBus.off('game:playersPlaced', this.loadScenario.bind(this));
    eventBus.off('game:shipPlaced', this.loadScenario.bind(this));
    
    eventBus.off('game:gameLoaded', this.handleGameLoaded.bind(this));
  }
}
