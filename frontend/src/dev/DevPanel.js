/**
 * DevPanel - Development panel for scenario management
 * Only available in DEV_MODE
 */
import { eventBus } from '../eventBus.js';

export class DevPanel
{
  constructor(scene, renderer, camera, mapGenerator)
  {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.mapGenerator = mapGenerator;
    this.panel = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = {x: 0, y: 0};
    
    // Track turn status for each player
    this.playerTurnStatus = new Map(); // playerId -> { hasEndedTurn: boolean, buttonElement: HTMLElement }

    this.createPanel();
    this.setupEventListeners();
    this.setupDragging();
  }

  /**
   * Create the dev panel DOM element
   */
  createPanel()
  {
    this.panel = document.createElement('div');
    this.panel.id = 'dev-panel';
    this.panel.className = 'panel';

    this.panel.innerHTML = `
      <div class="dev-panel-header">
        🧪 DEV PANEL
      </div>
      
      <form id="scenario-form" class="scenario-form">
        <div class="form-group">
          <label class="form-label">Scenario:</label>
          <select id="scenario-select" class="form-input">
            <option value="simple-two-player">Simple Two Player</option>
            <option value="tiny-combat-tester">Tiny Combat Tester</option>
            <option value="small-AI-tester">Small AI Tester</option>
          </select>
        </div>
        
        <button type="submit" id="start-game-btn" class="start-game-btn">🚀 Load Scenario</button>
      </form>
      
      <div id="status" class="status-display"></div>
      
      <div id="current-player-section" class="current-player-section" style="display: none;">
        <div class="form-group">
          <label class="form-label">Current Player:</label>
          <select id="current-player-select" class="form-input">
            <option value="">Select Player</option>
          </select>
        </div>
        
        <div id="player-turn-status" class="player-turn-status">
          <div class="dev-tools-header">
            👥 Player Turn Status
          </div>
          <div id="player-list" class="player-list">
            <!-- Player items will be dynamically added here -->
          </div>
        </div>
      </div>
      
      <div class="dev-tools-section">
          <div class="dev-tools-header">
            🧪 DEV TOOLS
          </div>
          
          <div class="mb-lg">
            <button id="memory-test-btn" class="dev-tools-btn">Run Memory Test</button>
          </div>
          
          <div class="mb-lg">
            <button id="memory-log-btn" class="dev-tools-btn">Log Memory Usage</button>
          </div>
          
          <div class="mb-lg">
            <button id="move-orders-btn" class="dev-tools-btn">Log Move Orders</button>
          </div>
        </div>
      
      <div class="mt-xl">
        <button id="toggle-panel-btn" class="toggle-panel-btn">Hide Panel</button>
      </div>
      
      <div class="help-text">
        Press 'B' to toggle panel<br>
        Press 'M' to run memory test<br>
        Drag to move panel
      </div>
    `;

    document.body.appendChild(this.panel);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners()
  {
    // Form submission
    const form = this.panel.querySelector('#scenario-form');
    form.addEventListener('submit', e =>
    {
      e.preventDefault();
      this.startGame();
    });

    // Scenario select dropdown
    const scenarioSelect = this.panel.querySelector('#scenario-select');
    scenarioSelect.addEventListener('change', e =>
    {
      console.log('Scenario selected:', e.target.value);
    });

    // Toggle panel button
    const toggleBtn = this.panel.querySelector('#toggle-panel-btn');
    toggleBtn.addEventListener('click', () =>
    {
      this.toggle();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e =>
    {
      if (e.key === 'b' || e.key === 'B')
      {
        this.toggle();
      }
      else if (e.key === 'm' || e.key === 'M')
      {
        this.runMemoryTest();
      }
    });

    // Dev tools buttons
    const memoryTestBtn = this.panel.querySelector('#memory-test-btn');
    const memoryLogBtn = this.panel.querySelector('#memory-log-btn');
    const moveOrdersBtn = this.panel.querySelector('#move-orders-btn');

    memoryTestBtn.addEventListener('click', () =>
    {
      this.runMemoryTest();
    });

    memoryLogBtn.addEventListener('click', () =>
    {
      this.logMemoryUsage();
    });

    moveOrdersBtn.addEventListener('click', () =>
    {
      this.logMoveOrders();
    });

    // Listen for dev:scenarioStatus events
    eventBus.on('dev:scenarioStatus', this.handleScenarioStatus.bind(this));
    
    // Listen for dev:scenarioComplete events
    eventBus.on('dev:scenarioComplete', this.handleScenarioComplete.bind(this));

    eventBus.on('game:startGame', this.handleGameStart.bind(this));
    
    // Current player dropdown change
    const currentPlayerSelect = this.panel.querySelector('#current-player-select');
    currentPlayerSelect.addEventListener('change', e => {
      this.handleCurrentPlayerChange(e.target.value);
    });
  }

  handleGameStart(context, eventData) {
    console.log('🎯 DevPanel: Game started:', eventData);

    // Reset all End Turn buttons back to "End Turn" state
    for (const [playerId, turnStatus] of this.playerTurnStatus.entries()) {
      if (turnStatus.hasEndedTurn) {
        console.log(`🎯 DevPanel: Resetting turn button for player ${playerId}`);
        
        // Reset button appearance and state
        turnStatus.buttonElement.textContent = 'End Turn';
        turnStatus.buttonElement.style.backgroundColor = '#444';
        turnStatus.buttonElement.style.cursor = 'pointer';
        turnStatus.buttonElement.disabled = false;
        
        // Reset status element
        turnStatus.statusElement.textContent = 'Turn: Active';
        turnStatus.statusElement.style.color = '#888';
        
        // Update tracking
        turnStatus.hasEndedTurn = false;
      }
    }
  }

  /**
   * Handle scenario status updates
   * @param {Object} context - Current context
   * @param {Object} statusData - Status data with type and other info
   */
  handleScenarioStatus(context, statusData) {
    const statusDiv = this.panel.querySelector('#status');
    const { type, scenario, gameTitle, playerName, message } = statusData;
    
    let statusText = '';
    let statusClass = 'status-info';
    
    switch (type) {
      case 'creatingGame':
        statusText = `⏳ Creating game for scenario: ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'gameCreated':
        statusText = `✅ Game created: ${gameTitle}`;
        statusClass = 'status-success';
        break;
      case 'addingPlayers':
        statusText = `👥 Adding player: ${playerName} to ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'playerAdded':
        statusText = `✅ Player added: ${playerName} to ${scenario}`;
        statusClass = 'status-success';
        break;
      case 'allPlayersAdded':
        statusText = `👥 All players added for scenario: ${scenario}`;
        statusClass = 'status-success';
        break;
      case 'generatingMap':
        statusText = `🗺️ Generating map for scenario: ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'mapGenerated':
        statusText = `✅ Map generated for scenario: ${scenario}`;
        statusClass = 'status-success';
        break;
      case 'placingPlayers':
        statusText = `📍 Placing players for scenario: ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'playersPlaced':
        statusText = `✅ Players placed for scenario: ${scenario}`;
        statusClass = 'status-success';
        break;
      case 'placingShips':
        statusText = `🚢 Placing ships for scenario: ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'shipPlaced':
        statusText = `✅ Ship placed for scenario: ${scenario}`;
        statusClass = 'status-success';
        break;
      case 'startingGame':
        statusText = `🎮 Starting game for scenario: ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'scenarioSetupComplete':
        statusText = `🎯 Scenario setup complete: ${scenario}`;
        statusClass = 'status-success';
        break;
      case 'applyingSpecialRules':
        statusText = `🔧 Applying special rules for: ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'loadingGame':
        statusText = `🚀 Loading game: ${scenario}`;
        statusClass = 'status-loading';
        break;
      case 'gameLoaded':
        statusText = `🎮 Game loaded: ${scenario}`;
        statusClass = 'status-success';
        break;
      case 'error':
        if (message) {
          statusText = `❌ Error: ${message}`;
          if (scenario) {
            statusText += ` (${scenario})`;
          }
        } else {
          // If wrong format arrives, fail fast to find bugs
          throw new Error(`Invalid error event format: missing message field in ${JSON.stringify(statusData)}`);
        }
        statusClass = 'status-error';
        break;
      default:
        statusText = `ℹ️ ${type}: ${scenario || ''}`;
        statusClass = 'status-info';
    }
    
    statusDiv.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
  }

  /**
   * Handle scenario complete event - show player dropdown
   * @param {Object} context - Current context
   * @param {Object} scenarioData - Scenario complete data with players
   */
  handleScenarioComplete(context, scenarioData) {
    console.log('🎯 DevPanel: Scenario complete, showing player dropdown:', scenarioData);
    
    const { players, currentPlayer } = scenarioData;
    const currentPlayerSection = this.panel.querySelector('#current-player-section');
    const currentPlayerSelect = this.panel.querySelector('#current-player-select');
    const playerList = this.panel.querySelector('#player-list');
    
    // Clear existing options and player list
    currentPlayerSelect.innerHTML = '<option value="">Select Player</option>';
    playerList.innerHTML = '';
    this.playerTurnStatus.clear();
    
    // Add player options to dropdown
    players.forEach(player => {
      const option = document.createElement('option');
      option.value = player.id;
      option.textContent = `${player.name} (${player.color_hex})`;
      option.style.color = player.color_hex;
      currentPlayerSelect.appendChild(option);
      
      // Create player list item
      this.createPlayerListItem(player);
    });
    
    // Set default selection
    if (currentPlayer) {
      currentPlayerSelect.value = currentPlayer.id;
    }
    
    // Show the section
    currentPlayerSection.style.display = 'block';
  }

  /**
   * Handle current player dropdown change
   * @param {string} playerId - Selected player ID
   */
  handleCurrentPlayerChange(playerId) {
    console.log('🎯 DevPanel: Current player changed to:', playerId);
    
    if (!playerId) {
      console.log('🎯 DevPanel: No player selected');
      return;
    }

    eventBus.setUser(playerId);
  }

  /**
   * Create a player list item with turn status and end turn button
   * @param {Object} player - Player object
   */
  createPlayerListItem(player) {
    const playerList = this.panel.querySelector('#player-list');
    
    // Create player item container
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    playerItem.style.borderLeft = `4px solid ${player.color_hex}`;
    playerItem.style.padding = '8px';
    playerItem.style.margin = '4px 0';
    playerItem.style.backgroundColor = '#2a2a2a';
    playerItem.style.borderRadius = '4px';
    
    // Create player info section
    const playerInfo = document.createElement('div');
    playerInfo.style.display = 'flex';
    playerInfo.style.justifyContent = 'space-between';
    playerInfo.style.alignItems = 'center';
    
    // Player name and status
    const playerDetails = document.createElement('div');
    playerDetails.innerHTML = `
      <div style="color: ${player.color_hex}; font-weight: bold;">${player.name}</div>
      <div id="turn-status-${player.id}" style="font-size: 12px; color: #888;">Turn: Active</div>
    `;
    
    // End turn button/toggle
    const endTurnButton = document.createElement('button');
    endTurnButton.id = `end-turn-btn-${player.id}`;
    endTurnButton.textContent = 'End Turn';
    endTurnButton.className = 'dev-tools-btn';
    endTurnButton.style.padding = '4px 8px';
    endTurnButton.style.fontSize = '12px';
    endTurnButton.style.backgroundColor = '#444';
    endTurnButton.style.border = '1px solid #666';
    endTurnButton.style.borderRadius = '4px';
    endTurnButton.style.color = '#fff';
    endTurnButton.style.cursor = 'pointer';
    
    // Add event listener for end turn button
    endTurnButton.addEventListener('click', () => {
      this.handleEndTurn(player.id);
    });
    
    // Assemble the player item
    playerInfo.appendChild(playerDetails);
    playerInfo.appendChild(endTurnButton);
    playerItem.appendChild(playerInfo);
    playerList.appendChild(playerItem);
    
    // Store turn status tracking
    this.playerTurnStatus.set(player.id, {
      hasEndedTurn: false,
      buttonElement: endTurnButton,
      statusElement: playerItem.querySelector(`#turn-status-${player.id}`)
    });
  }

  /**
   * Handle end turn button click
   * @param {string} playerId - Player ID
   */
  handleEndTurn(playerId) {
    console.log(`🎯 DevPanel: End turn requested for player: ${playerId}`);
    console.log('🎯 DevPanel: Player turn status:', this.playerTurnStatus);
    
    const turnStatus = this.playerTurnStatus.get(playerId);
    if (!turnStatus) {
      console.error(`🎯 DevPanel: No turn status found for player: ${playerId}`);
      return;
    }
    
    // Check if turn has already been ended
    if (turnStatus.hasEndedTurn) {
      console.log(`🎯 DevPanel: Player ${playerId} has already ended their turn`);
      return;
    }
    
    // Update UI to show turn has been ended
    turnStatus.buttonElement.textContent = 'Turn Ended';
    turnStatus.buttonElement.style.backgroundColor = '#666';
    turnStatus.buttonElement.style.cursor = 'not-allowed';
    turnStatus.buttonElement.disabled = true;
    
    turnStatus.statusElement.textContent = 'Turn: Ended';
    turnStatus.statusElement.style.color = '#666';
    
    // Update tracking
    turnStatus.hasEndedTurn = true;
    
    // Log to console as requested
    console.log(`🎯 DevPanel: Turn ended for player ${playerId} - Sending end turn event`);
    
    // Emit end turn event
    eventBus.emit('turn:endTurn', {
      success: true,
      details: {
        eventType: 'turn:endTurn',
        playerId: playerId
      }
    });
  }

  /**
   * Set up dragging functionality
   */
  setupDragging()
  {
    this.panel.addEventListener('mousedown', e =>
    {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'SELECT'
      )
      {
        return; // Don't drag when clicking on form elements
      }

      this.isDragging = true;
      const rect = this.panel.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this.panel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e =>
    {
      if (!this.isDragging) return;

      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      // Keep panel within viewport bounds
      const maxX = window.innerWidth - this.panel.offsetWidth;
      const maxY = window.innerHeight - this.panel.offsetHeight;

      this.panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
      this.panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
      this.panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () =>
    {
      if (this.isDragging)
      {
        this.isDragging = false;
        this.panel.style.cursor = 'move';
      }
    });
  }

  /**
   * Run memory test
   */
  runMemoryTest()
  {
    console.log('🧪 Running memory test...');
    // Import and run the memory test
    import('./MemoryTest.js')
      .then(module =>
      {
        module.runMemoryTest();
      })
      .catch(error =>
      {
        console.error('Failed to run memory test:', error);
      });
  }

  /**
   * Log memory usage
   */
  logMemoryUsage()
  {
    console.log('📊 Logging memory usage...');
    // Import and run the memory usage logging
    import('./MemoryTest.js')
      .then(module =>
      {
        module.logMemoryUsage();
      })
      .catch(error =>
      {
        console.error('Failed to log memory usage:', error);
      });
  }

  /**
   * Start a scenario via event system
   */
  async startGame()
  {
    const statusDiv = this.panel.querySelector('#status');
    const scenarioSelect = this.panel.querySelector('#scenario-select');
    const selectedScenario = scenarioSelect.value;

    try
    {
      if (!selectedScenario)
      {
        throw new Error('Please select a scenario');
      }

      statusDiv.innerHTML = '<span class="status-loading">⏳ Loading scenario...</span>';

      // Emit dev:loadScenario event with standardized format
      eventBus.emit('dev:loadScenario', {
        success: true,
        details: {
          eventType: 'dev:loadScenario',
          gameId: null,
          scenario: selectedScenario
        }
      });
    }
    catch (error)
    {
      console.error('Error starting scenario:', error);
      statusDiv.innerHTML = `<span class="status-error">❌ Error: ${error.message}</span>`;
    }
  }



  /**
   * Show the panel
   */
  show()
  {
    this.panel.style.display = 'block';
    this.isVisible = true;
  }

  /**
   * Hide the panel
   */
  hide()
  {
    this.panel.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Toggle panel visibility
   */
  toggle()
  {
    if (this.isVisible)
    {
      this.hide();
    }
    else
    {
      this.show();
    }
  }

  /**
   * Clean up the panel
   */
  destroy()
  {
    if (this.panel && this.panel.parentNode)
    {
      this.panel.parentNode.removeChild(this.panel);
    }
  }





  // Memory test methods disabled for now
  // async runMemoryTest() { ... }
  // async logMemoryUsage() { ... }
}
