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
          </select>
        </div>
        
        <button type="submit" id="start-game-btn" class="start-game-btn">🚀 Load Scenario</button>
      </form>
      
      <div id="status" class="status-display"></div>
      
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

      // Emit dev:loadScenario event
      eventBus.emit('dev:loadScenario', selectedScenario);
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
