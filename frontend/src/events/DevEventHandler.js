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
      status: 'lobby'
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
    eventBus.on('dev:applySpecials', this.applySpecials.bind(this));
    
    // Listen for game events
    eventBus.on('game:gameCreated', this.handleGameCreated.bind(this));
    eventBus.on('game:playerAdded', this.handlePlayerAdded.bind(this));
    eventBus.on('game:gameLoaded', this.handleGameLoaded.bind(this));
  }

  /**
   * Handle scenario loading event
   * @param {Object} context - Current system context (user, gameId)
   * @param {string} scenario - Scenario data to load
   */
  loadScenario(context, scenario)
  {
    console.log('🧪 DevEventHandler: Loading scenario:', scenario);
    console.log('🧪 DevEventHandler: Context:', context);
    
    // Check if there's already a game for this scenario
    this.checkGame(scenario).then(gameInfo => {
      if (gameInfo)
      {
        if (gameInfo.status === 'running')
        {
          // Game is already running, load it
          eventBus.emit('dev:scenarioStatus', { type: 'loadingGame', scenario });
          eventBus.emit('game:loadGame', gameInfo.gameId);
          return;
        }
        
        if (gameInfo.status === 'lobby')
        {
          // Game exists but is in lobby, add players
          this.gameTracker.set(gameInfo.gameId, { scenario: scenario, currentPlayers: [] });
          eventBus.emit('dev:addPlayers', { scenario, gameId: gameInfo.gameId });
          return;
        }
      }
      
      // No game found, create one
      if (gameInfo)
      {
        this.gameTracker.set(gameInfo.gameId, { scenario: scenario, currentPlayers: [] });
      }
      eventBus.emit('dev:createGame', { scenario });
    }).catch(error => {
      console.error('🧪 DevEventHandler: Error in loadScenario:', error);
      
      // Emit error event with simplified format
      eventBus.emit('dev:scenarioStatus', { 
        type: 'error', 
        message: error.message || 'Failed to load scenario',
        scenario: scenario
      });
    });
  }

  /**
   * Check if there is a game in the database with title equal to the scenario
   * @param {string} scenario - Scenario name to check
   * @returns {Promise<Object|null>} Game info with gameId and status, or null if not found
   */
  async checkGame(scenario)
  {
    console.log('🧪 DevEventHandler: Checking for existing game with scenario:', scenario);
    
    try
    {
      const response = await fetch(`/api/dev/games/check/${encodeURIComponent(scenario)}`);
      
      if (!response.ok)
      {
        if (response.status === 409)
        {
          // Multiple games found - this is an error condition
          const errorData = await response.json();
          console.error('🧪 DevEventHandler: Duplicate games found:', errorData);
          
          // Emit error status with simplified format
          eventBus.emit('dev:scenarioStatus', { 
            type: 'error', 
            message: `Multiple games found with title: ${scenario}`,
            scenario: scenario
          });
          
          // Throw exception as requested
          throw new Error(`Multiple games found with title: ${scenario}`);
        }
        
        // Other error
        const errorData = await response.json();
        console.error('🧪 DevEventHandler: Error checking game:', errorData);
        throw new Error(`Failed to check game: ${errorData.error || 'Unknown error'}`);
      }
      
      const data = await response.json();
      
      if (!data.found)
      {
        console.log('🧪 DevEventHandler: No existing game found for scenario:', scenario);
        return null;
      }
      
      console.log('🧪 DevEventHandler: Found existing game:', data);
      return {
        gameId: data.gameId,
        status: data.status
      };
      
    }
    catch (error)
    {
      console.error('🧪 DevEventHandler: Error in checkGame:', error);
      throw error;
    }
  }

  /**
   * Create a game for the given scenario
   * @param {Object} data - Event data containing scenario
   * @param {string} data.scenario - Scenario name
   */
  createGame(context, data)
  {
    const { scenario } = data;
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
      
      // Update the gameTracker with the current players
      const gameTracker = this.gameTracker.get(gameId);
      gameTracker.currentPlayers = players;
      
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
   * @param {Object} data - Event data
   * @param {string} data.scenario - Scenario name
   * @param {string} data.gameId - Game ID
   */
  async addPlayers(context, data) {
    const { scenario, gameId } = data;
    console.log('🧪 DevEventHandler: Adding players for scenario:', scenario, 'game:', gameId);
    
    // Get current players
    const currentPlayers = await this.listGamePlayers(gameId);
    
    // Get required players from the map
    const requiredPlayers = this.playerData.get(scenario) || [];

    if(currentPlayers.length === requiredPlayers.length)
    {
      console.log('🧪 DevEventHandler: All players added for scenario:', scenario);
      eventBus.emit('dev:scenarioStatus', { type: 'allPlayersAdded', scenario });
      eventBus.emit('dev:applySpecials', { scenario, gameId });

      return;
    }

    // Loop through required players and add missing ones
    requiredPlayers.forEach(player => {
      if (!currentPlayers.find(cp => cp.user_id === player.userId))
      {

        console.log('cp.user_id', cp.user_id, 'player.userId', player.userId);
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
   * Handle game created event
   * @param {Object} context - Current context
   * @param {Object} gameData - Game data
   */
  handleGameCreated(context, gameData)
  {
    console.log('🧪 DevEventHandler: Game created:', gameData);
    
    // Set game tracker map
    this.gameTracker.set(gameData.id, { scenario: gameData.title, currentPlayers: [] });
    
    // Emit status update
    eventBus.emit('dev:scenarioStatus', { type: 'gameCreated', gameTitle: gameData.title });
    
    // Emit add players event
    eventBus.emit('dev:addPlayers', { scenario: gameData.title, gameId: gameData.id });
  }

  /**
   * Handle player added event
   * @param {Object} context - Current context
   * @param {Object} playerData - Player data
   */
  handlePlayerAdded(context, playerData)
  {
    console.log('🧪 DevEventHandler: Player added:', playerData);
    
    // Emit status update
    const gameTrackerData = this.gameTracker.get(playerData.gameId);
    const scenario = gameTrackerData ? gameTrackerData.scenario : null;
    eventBus.emit('dev:scenarioStatus', { type: 'playerAdded', scenario, playerName: playerData.name });
    
    // Add player to tracking object
    if (!this.gameTracker.has(playerData.gameId))
    {
      this.gameTracker.set(playerData.gameId, { scenario: null, currentPlayers: [] });
    }
    
    const gameTracker = this.gameTracker.get(playerData.gameId);
    if (!gameTracker.currentPlayers)
    {
      gameTracker.currentPlayers = [];
    }
    
    // Check for duplicates
    if (gameTracker.currentPlayers.find(p => p.userId === playerData.userId))
    {
      throw new Error(`Player ${playerData.name} already exists in game ${playerData.gameId}`);
    }
    
    gameTracker.currentPlayers.push(playerData);
    
    // Check if all required players are added
    const requiredPlayers = this.playerData.get(scenario) || [];
    if (gameTracker.currentPlayers.length === requiredPlayers.length)
    {
      eventBus.emit('dev:applySpecials', { scenario, gameId: playerData.gameId });
    }
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
   * Clean up event listeners
   */
  dispose()
  {
    eventBus.off('dev:loadScenario', this.loadScenario.bind(this));
    eventBus.off('dev:createGame', this.createGame.bind(this));
    eventBus.off('dev:addPlayers', this.addPlayers.bind(this));
    eventBus.off('dev:applySpecials', this.applySpecials.bind(this));
    eventBus.off('game:gameCreated', this.handleGameCreated.bind(this));
    eventBus.off('game:playerAdded', this.handlePlayerAdded.bind(this));
    eventBus.off('game:gameLoaded', this.handleGameLoaded.bind(this));
  }
}
