/**
 * Development Event Handler - Manages development-specific events
 * Handles scenario loading, testing, and other development workflows
 */
import
{
   eventBus
}
from '../eventBus.js';

export class DevEventHandler
{
   constructor()
   {
      // Initialize the four maps as specified
      this.gameData = new Map();
      this.playerData = new Map();
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
      this.gameData.set("simple-two-player",
      {
         ownerId: "a109d369-0df3-4e73-b262-62c793ad743f",
         title: "simple-two-player",
         description: "Simple game with two players",
         seed: 12345,
         mapSize: 5,
         densityMin: 3,
         densityMax: 7,
         status: 'lobby',
         params: JSON.stringify(
         {
            type: 'devScenario',
            scenario: 'simple-two-player',
            state:
            {
               gameCreated: false,
               playersAdded: false,
               mapGenerated: false,
               playersPlaced: false,
               specialsApplied: false
            }
         })
      });
      this.gameData.set("tiny-combat-tester",
      {
         ownerId: "a109d369-0df3-4e73-b262-62c793ad743f",
         title: "tiny-combat-tester",
         description: "Tiny map with two players for testing combat",
         seed: 54321,
         mapSize: 2,
         densityMin: 1,
         densityMax: 3,
         status: 'lobby',
         params: JSON.stringify(
         {
            type: 'devScenario',
            scenario: 'tiny-combat-tester',
            state:
            {
               gameCreated: false,
               playersAdded: false,
               mapGenerated: false,
               playersPlaced: false,
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
      }]);
      this.playerData.set("tiny-combat-tester", [
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
        }]);

   }

   /**
    * Set up event listeners for development events
    */
   setupEventListeners()
   {
      // Listen for dev events
      eventBus.on('dev:loadScenario', this.loadScenario.bind(this));

      // Listen for game events
      eventBus.on('game:gameCreated', this.loadScenario.bind(this));
      eventBus.on('game:playerAdded', this.loadScenario.bind(this));
      eventBus.on('game:mapGenerated', this.loadScenario.bind(this));
      eventBus.on('game:playersPlaced', this.loadScenario.bind(this));
   }

   /**
    * Handle scenario loading event - now the central state machine driver
    * @param {Object} context - Current system context (user, gameId)
    * @param {Object} eventData - Event data with standardized format
    */
   async loadScenario(context, eventData)
   {
      console.log('❗ DevEventHandler: Loading scenario with event data:', eventData);
      console.log('❗ DevEventHandler: Context:', context);

      // Resolve game state for dev events
      const gameState = await this.resolveGameState(eventData);
      console.log('🧪 DevEventHandler: Resolved game state:', gameState);

      if (!eventData.details.gameId)
         eventData.details.gameId = gameState.gameId;

      try
      {
         // Check if this is a dev event or game event
         if (eventData && eventData.details && eventData.details.eventType)
         {
            const eventType = eventData.details.eventType;

            if (eventType.startsWith('dev:'))
               await this.executeNextStep(gameState, eventData);
            else
            {
               // This is a game event, handle it appropriately
               console.log('🧪 DevEventHandler: Received game event:', eventType, 'Details:', eventData.details);

               // Check success flag first - fail fast if the operation failed
               if (!eventData.success)
                  throw new Error(`Game event failed: ${eventType} - ${eventData.error || 'Unknown error'}`);

               // Declare variables for state update
               let stateUpdate = {};
               let done = false;

               // Switch statement to construct the new state value
               switch (eventType)
               {
                  case 'game:gameCreated':
                     stateUpdate = {
                        gameCreated: true
                     };
                     break;

                  case 'game:playerAdded':
                     // If players are already added, don't check again
                     if (gameState.playersAdded)
                        return;

                     const currentPlayers = await this.checkPlayersAdded(gameState);
                     const requiredPlayers = this.playerData.get(gameState.scenario) || [];

                     // If current count < required count, do nothing and let it continue
                     if (currentPlayers.length < requiredPlayers.length)
                     {
                        console.log(`🧪 DevEventHandler: Still need more players - Current: ${currentPlayers.length}, Required: ${requiredPlayers.length}`);
                        // Don't return - let it continue to emit dev:loadScenario
                     }
                     else if (currentPlayers.length === requiredPlayers.length)
                     {
                        // All players added, update state
                        stateUpdate = {
                           playersAdded: true
                        };
                     }
                     break;

                  case 'game:mapGenerated':
                     stateUpdate = {
                        mapGenerated: true
                     };
                     break;

                  case 'game:playersPlaced':
                     stateUpdate = {
                        playersPlaced: true
                     };
                     break;


                  case 'game:gameLoaded':
                     stateUpdate = {
                        specialsApplied: true
                     };
                     done = true;
                     break;

                  default:
                     throw new Error(`Unknown game event type: ${eventType}`);
               }

               // Update the database state
               if (Object.keys(stateUpdate).length > 0)
               {
                  const gameId = eventData.details.gameId;
                  await this.updateGameState(gameId, stateUpdate);
               }

               // Only continue if not done
               if (!done)
               {
                  const gameId = eventData.details.gameId;
                  eventBus.emit('dev:loadScenario',
                  {
                     success: true,
                     details:
                     {
                        eventType: 'dev:loadScenario',
                        gameId: gameId,
                        scenario: gameState.scenario
                     }
                  });
               }

               return;
            }
         }
         else
            throw new Error('Invlaid format of event data');
      }
      catch (error)
      {
         console.error('🧪 DevEventHandler: Error in loadScenario:', error);

         // Emit error event with simplified format
         eventBus.emit('dev:scenarioStatus',
         {
            type: 'error',
            message: error.message || 'Failed to load scenario',
            scenario: 'unknown'
         });
      }
   }

   /**
    * Resolve game state from event data
    * @param {Object} eventData - Event data containing gameId and/or scenario
    * @returns {Promise<Object>} Game state object with all state flags
    */
   async resolveGameState(eventData)
   {
      try
      {
         const
         {
            gameId,
            scenario
         } = eventData.details ||
         {};
         let game = null;

         // First try to get game by gameId if it exists
         if (gameId)
         {
            console.log('🔍 DevEventHandler: Resolving game state by gameId:', gameId);
            const response = await fetch(`/api/dev/games/${gameId}`);
            if (response.ok)
            {
               const data = await response.json();
               game = data.game;
               console.log('✅ DevEventHandler: Found game by gameId:', game);
            }
         }

         // If no game found by gameId, try to find by scenario
         if (!game && scenario)
         {
            console.log('🔍 DevEventHandler: Resolving game state by scenario:', scenario);
            const response = await fetch(`/api/dev/games/by-scenario/${scenario}`);
            if (response.ok)
            {
               const data = await response.json();
               if (data.games && data.games.length > 0)
               {
                  game = data.games[0]; // Take the first (most recent) game
                  console.log('✅ DevEventHandler: Found game by scenario:', game);
               }
            }
         }

         // If game was found, create state object from params
         if (game)
         {
            const params = game.params ||
            {};
            const state = params.state ||
            {};

            return {
               gameId: game.id,
               scenario: params.scenario || scenario,
               status: game.status,
               gameCreated: state.gameCreated || false,
               playersAdded: state.playersAdded || false,
               mapGenerated: state.mapGenerated || false,
               playersPlaced: state.playersPlaced || false,
               specialsApplied: state.specialsApplied || false
            };
         }

         // No game found, create default state object
         console.log('🔍 DevEventHandler: No game found, creating default state for scenario:', scenario);
         return {
            gameId: null,
            scenario: scenario,
            status: null,
            gameCreated: false,
            playersAdded: false,
            mapGenerated: false,
            playersPlaced: false,
            specialsApplied: false
         };
      }
      catch (error)
      {
         console.error('❌ DevEventHandler: Error resolving game state:', error);
         throw error;
      }
   }

   /**
    * Create a game for the given scenario
    * @param {Object} data - Event data containing scenario
    */
   createGame(data)
   {
      console.log('🧪 DevEventHandler: Creating game with data:', data);

      // Extract scenario from standardized format or legacy format
      let scenario;
      if (data && data.details && data.details.scenario)
         scenario = data.details.scenario;
      else
         throw new Error('🧪 DevEventHandler: No scenario found in data');

      // Emit status update
      eventBus.emit('dev:scenarioStatus',
      {
         type: 'creatingGame',
         scenario
      });

      // Get game data from the map
      const gameData = this.gameData.get(scenario);
      if (!gameData)
         throw new Error('🧪 DevEventHandler: No game data found for scenario: ' + scenario);

      // Emit game creation event
      eventBus.emit('game:createGame', gameData);
   }


   /**
    * Add players to a game for a scenario
    * @param {Object} data - Event data
    */
   async addPlayers(data)
   {
      console.log('🧪 DevEventHandler: Adding players with data:', data);

      // Extract scenario and gameId from standardized format or legacy format
      let scenario, gameId;
      if (data && data.details && data.details.scenario && data.details.gameId)
      {
         scenario = data.details.scenario;
         gameId = data.details.gameId;
      }
      else
         throw new Error('🧪 DevEventHandler: No scenario or gameId found in data');

      if (!this.playerData.has(scenario))
         throw new Error('🧪 DevEventHandler: No players found for scenario: ' + scenario);

      // Get current players and required players
      const gameState = {
         gameId,
         scenario
      };
      const currentPlayers = await this.checkPlayersAdded(gameState);
      const requiredPlayers = this.playerData.get(scenario) || [];

      // Find players that haven't been added yet (compare by userId)
      const currentPlayerIds = currentPlayers.map(p => p.user_id);
      const missingPlayers = requiredPlayers.filter(player =>
         !currentPlayerIds.includes(player.userId)
      );

      if (missingPlayers.length === 0)
      {
         console.log('🧪 DevEventHandler: All players already added');
         return;
      }

      // Add only the first missing player
      const playerToAdd = missingPlayers[0];
      console.log('🧪 DevEventHandler: Adding player:', playerToAdd.name);

      // Emit status update
      eventBus.emit('dev:scenarioStatus',
      {
         type: 'addingPlayers',
         scenario,
         playerName: playerToAdd.name
      });

      // Emit player addition event for just one player
      eventBus.emit('game:addPlayer',
      {
         ...playerToAdd,
         gameId
      });
   }

   /**
    * Apply special rules for a scenario
    * @param {Object} data - Event data
    * @param {string} data.scenario - Scenario name
    * @param {string} data.gameId - Game ID
    */
   async applySpecials(data)
   {
      console.log('🧪 DevEventHandler: Applying special rules with data:', data);

      const
      {
         scenario,
         gameId
      } = data.details;
      console.log('🧪 DevEventHandler: Applying special rules for scenario:', scenario, 'game:', gameId);

      // Emit status update
      eventBus.emit('dev:scenarioStatus',
      {
         type: 'applyingSpecialRules',
         scenario
      });

      // Switch statement for scenario-specific setup
      switch (scenario)
      {
         case 'simple-two-player':
            await this.createSimpleTwoPlayer(gameId);
            break;
         default:
            console.log('🧪 DevEventHandler: No special setup for scenario:', scenario);

            await this.updateGameState(gameId,
              {
                 specialsApplied: true
              });
        
              // Emit dev:loadScenario event to continue the flow
              eventBus.emit('dev:loadScenario',
              {
                 success: true,
                 details:
                 {
                    eventType: 'dev:loadScenario',
                    gameId: gameId,
                    scenario: scenario
                 }
              });
      }
   }

   /**
    * Generate map for a scenario
    * @param {Object} data - Event data
    */
   generateMap(data)
   {
      console.log('🧪 DevEventHandler: Generating map with data:', data);

      // Extract scenario and gameId from standardized format or legacy format
      let scenario, gameId;
      if (data && data.details && data.details.scenario && data.details.gameId)
      {
         scenario = data.details.scenario;
         gameId = data.details.gameId;
      }
      else
         throw new Error('🧪 DevEventHandler: No scenario or gameId found in data');

      // Emit status update
      eventBus.emit('dev:scenarioStatus',
      {
         type: 'generatingMap',
         scenario: scenario
      });

      // Emit game map generation event (only need gameId - backend will retrieve all parameters)
      eventBus.emit('game:generateMap',
      {
         gameId
      });
   }

   /**
    * Place players on the map for a scenario
    * @param {Object} data - Event data
    * @param {string} data.scenario - Scenario name
    * @param {string} data.gameId - Game ID
    */
   placePlayers(data)
   {
      console.log('🧪 DevEventHandler: Placing players with data:', data);
      const
      {
         scenario,
         gameId
      } = data.details;
      console.log('🧪 DevEventHandler: Placing players for scenario:', scenario, 'game:', gameId);

      // Emit status update
      eventBus.emit('dev:scenarioStatus',
      {
         type: 'placingPlayers',
         scenario
      });

      // Emit game player placement event
      eventBus.emit('game:placePlayers',
      {
         gameId
      });
   }


   /**
    * Start game for a scenario
    * @param {Object} data - Event data
    * @param {string} data.scenario - Scenario name
    * @param {string} data.gameId - Game ID
    */
   startGame(data)
   {
      const
      {
         scenario,
         gameId
      } = data;
      console.log('🧪 DevEventHandler: Starting game for scenario:', scenario, 'game:', gameId);

      // Emit status update
      eventBus.emit('dev:scenarioStatus',
      {
         type: 'startingGame',
         scenario
      });

      throw new Error('🧪 DevEventHandler: Not implemented yet');

      // Emit game start event
      eventBus.emit('game:startGame',
      {
         gameId
      });
   }

   /**
    * Create simple two player scenario setup
    * @param {string} gameId - Game ID
    */
   async createSimpleTwoPlayer(gameId)
   {
      console.log('🧪 DevEventHandler: Creating simple two player setup for game:', gameId);

      // Mark this step as complete
      await this.updateGameState(gameId,
      {
         specialsApplied: true
      });

      // Emit dev:loadScenario event to continue the flow
      eventBus.emit('dev:loadScenario',
      {
         success: true,
         details:
         {
            eventType: 'dev:loadScenario',
            gameId: gameId,
            scenario: 'simple-two-player'
         }
      });
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
      eventBus.emit('dev:scenarioStatus',
      {
         type: 'gameLoaded',
         scenario
      });
   }


   /**
    * Execute the next step of scenario setup based on current state
    * @param {Object} gameState - Game state object from resolveGameState
    * @param {Object} eventData - Event data passed to loadScenario
    */
   async executeNextStep(gameState, eventData)
   {
      console.log('🧪 DevEventHandler: Executing next step with game state:', gameState);
      console.log('🧪 DevEventHandler: Event data:', eventData);

      const
      {
         gameId,
         scenario,
         status,
         gameCreated,
         playersAdded,
         mapGenerated,
         playersPlaced,
         specialsApplied
      } = gameState;

      if (!gameCreated)
      {
         console.log('🧪 DevEventHandler: Need to create game.');
         this.createGame(eventData);
      }
      else if (status === 'running')
      {
         console.log('🧪 DevEventHandler: Game is already running.');
      }
      else if (!playersAdded)
      {
         console.log('🧪 DevEventHandler: Need to add players.');
         await this.addPlayers(eventData);
      }
      else if (!mapGenerated)
      {
         console.log('🧪 DevEventHandler: Need to generate map.');
         this.generateMap(eventData);
      }
      else if (!playersPlaced)
      {
         console.log('🧪 DevEventHandler: Need to place players.');
         this.placePlayers(eventData);
      }
      else if (!specialsApplied)
      {
         console.log('🧪 DevEventHandler: Need to apply special rules.');
         await this.applySpecials(eventData);
      }
      else
      {
         console.log('🧪 DevEventHandler: Scenario setup complete.');
         eventBus.emit('dev:scenarioStatus',
         {
            type: 'scenarioSetupComplete',
            scenario
         });

         // Get players data and emit scenario complete event with player info
         const players = await this.checkPlayersAdded(gameState);
         eventBus.emit('dev:scenarioComplete',
         {
            scenario,
            gameId,
            players,
            currentPlayer: players[0] // Default to first player
         });

         // Optionally, emit a final game start event
         eventBus.emit('game:startGame',
         {
            gameId
         });
      }
   }


   /**
    * Get current players for the game
    * @param {Object} gameState - Current game state object
    * @returns {Promise<Array>} Array of current players
    */
   async checkPlayersAdded(gameState)
   {
      const
      {
         gameId,
         scenario
      } = gameState;

      if (!gameId || !scenario)
      {
         throw new Error(`🧪 DevEventHandler: Missing gameId or scenario in gameState: ${JSON.stringify(gameState)}`);
      }

      // Get current players from the database
      const response = await fetch(`/api/dev/games/${encodeURIComponent(gameId)}/players`);

      if (!response.ok)
      {
         throw new Error(`🧪 DevEventHandler: Error getting game players: HTTP ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      const currentPlayers = data.players || [];

      // Get required players from scenario data
      const requiredPlayers = this.playerData.get(scenario);
      if (!requiredPlayers)
      {
         throw new Error(`🧪 DevEventHandler: No player data found for scenario: ${scenario}`);
      }

      console.log(`🧪 DevEventHandler: Player check - Current: ${currentPlayers.length}, Required: ${requiredPlayers.length}`);

      return currentPlayers;
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

         const response = await fetch(`/api/dev/games/${gameId}/state`,
         {
            method: 'PUT',
            headers:
            {
               'Content-Type': 'application/json'
            },
            body: JSON.stringify(
            {
               state: stateUpdate
            })
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

      eventBus.off('game:gameCreated', this.loadScenario.bind(this));
      eventBus.off('game:mapGenerated', this.loadScenario.bind(this));
      eventBus.off('game:playerAdded', this.loadScenario.bind(this));
      eventBus.off('game:playersPlaced', this.loadScenario.bind(this));
   }
}
