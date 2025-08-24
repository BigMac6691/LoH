/**
 * BackendTestPanel - Development panel for testing backend game generation
 * Only available in DEV_MODE
 */

export class BackendTestPanel {
  constructor(scene, renderer, camera, mapGenerator) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.mapGenerator = mapGenerator;
    this.panel = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    
    this.createPanel();
    this.setupEventListeners();
    this.setupDragging();
  }
  
  /**
   * Create the backend test panel DOM element
   */
  createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'backend-test-panel';
    this.panel.className = 'panel';
    this.panel.id = 'backend-test-panel';
    
    this.panel.innerHTML = `
      <div class="backend-test-panel-header">
        🗄️ BACKEND TEST PANEL
      </div>
      
      <form id="game-form" class="game-form">
        <div class="form-group">
          <label class="form-label">Seed:</label>
          <input type="number" id="seed-input" value="12345" min="0" max="999999" class="form-input">
        </div>
        
        <div class="form-group">
          <label class="form-label">Map Size:</label>
          <input type="number" id="map-size-input" value="5" min="2" max="9" class="form-input">
        </div>
        
        <div class="form-group">
          <label class="form-label">Density Min:</label>
          <input type="number" id="density-min-input" value="3" min="0" max="9" class="form-input">
        </div>
        
        <div class="form-group">
          <label class="form-label">Density Max:</label>
          <input type="number" id="density-max-input" value="7" min="0" max="9" class="form-input">
        </div>
        
        <div class="form-group">
          <div style="margin-bottom: 8px; color: #ccc; font-weight: bold;">Players:</div>
          
          <div class="player-input-group">
            <label class="form-label">Player 1:</label>
            <input type="text" id="player1-name" value="Red Player" placeholder="Name" class="player-name-input">
            <input type="color" id="player1-color" value="#ff0000" class="player-color-input">
          </div>
          
          <div class="player-input-group">
            <label class="form-label">Player 2:</label>
            <input type="text" id="player2-name" value="Blue Player" placeholder="Name" class="player-name-input">
            <input type="color" id="player2-color" value="#0000ff" class="player-color-input">
          </div>
        </div>
        
        <button type="submit" id="start-game-btn" class="start-game-btn">🚀 START GAME</button>
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
  setupEventListeners() {
    // Form submission
    const form = this.panel.querySelector('#game-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.startGame();
    });
    
    // Toggle panel button
    const toggleBtn = this.panel.querySelector('#toggle-panel-btn');
    toggleBtn.addEventListener('click', () => {
      this.toggle();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'b' || e.key === 'B') {
        this.toggle();
      }
      else if (e.key === 'm' || e.key === 'M') {
        this.runMemoryTest();
      }
    });
    
    // Dev tools buttons
    const memoryTestBtn = this.panel.querySelector('#memory-test-btn');
    const memoryLogBtn = this.panel.querySelector('#memory-log-btn');
    const moveOrdersBtn = this.panel.querySelector('#move-orders-btn');
    
    memoryTestBtn.addEventListener('click', () => {
      this.runMemoryTest();
    });
    
    memoryLogBtn.addEventListener('click', () => {
      this.logMemoryUsage();
    });
    
    moveOrdersBtn.addEventListener('click', () => {
      this.logMoveOrders();
    });
  }
  
  /**
   * Set up dragging functionality
   */
  setupDragging() {
    this.panel.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
        return; // Don't drag when clicking on form elements
      }
      
      this.isDragging = true;
      const rect = this.panel.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this.panel.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
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
    
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.panel.style.cursor = 'move';
      }
    });
  }
  
  /**
   * Run memory test
   */
  runMemoryTest() {
    console.log('🧪 Running memory test...');
    // Import and run the memory test
    import('./MemoryTest.js').then(module => {
      module.runMemoryTest();
    }).catch(error => {
      console.error('Failed to run memory test:', error);
    });
  }
  
  /**
   * Log memory usage
   */
  logMemoryUsage() {
    console.log('📊 Logging memory usage...');
    // Import and run the memory usage logging
    import('./MemoryTest.js').then(module => {
      module.logMemoryUsage();
    }).catch(error => {
      console.error('Failed to log memory usage:', error);
    });
  }
  
  /**
   * Start a new game via backend API
   */
  async startGame() {
    const statusDiv = this.panel.querySelector('#status');
          statusDiv.innerHTML = '<span class="status-loading">⏳ Starting game...</span>';
    
    try {
      // Get form values
      const seed = this.panel.querySelector('#seed-input').value;
      const mapSize = parseInt(this.panel.querySelector('#map-size-input').value);
      const densityMin = parseInt(this.panel.querySelector('#density-min-input').value);
      const densityMax = parseInt(this.panel.querySelector('#density-max-input').value);
      const player1Name = this.panel.querySelector('#player1-name').value;
      const player1Color = this.panel.querySelector('#player1-color').value;
      const player2Name = this.panel.querySelector('#player2-name').value;
      const player2Color = this.panel.querySelector('#player2-color').value;
      
      // Validate inputs
      if (!seed || !player1Name || !player2Name) {
        throw new Error('Please fill in all required fields');
      }
      
      if (densityMin > densityMax) {
        throw new Error('Density Min cannot be greater than Density Max');
      }
      
      // Prepare request body
      const requestBody = {
        seed,
        mapSize,
        densityMin,
        densityMax,
        players: [
          { name: player1Name, colorHex: player1Color },
          { name: player2Name, colorHex: player2Color }
        ]
      };

      console.log('requestBody', requestBody);
      
      statusDiv.innerHTML = '<span class="status-loading">⏳ Creating game...</span>';
      
      // POST to start game
      const startResponse = await fetch('/api/dev/start-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(`Failed to start game: ${errorData.error || startResponse.statusText}`);
      }
      
      const startData = await startResponse.json();
      statusDiv.innerHTML = `<span class="status-success">✅ Game created! ID: ${startData.gameId}</span>`;
      
      // GET game state
      statusDiv.innerHTML = '<span class="status-loading">⏳ Loading game state...</span>';
      
      const stateResponse = await fetch(`/api/dev/state?gameId=${startData.gameId}`);
      
      if (!stateResponse.ok) {
        const errorData = await stateResponse.json();
        throw new Error(`Failed to load game state: ${errorData.error || stateResponse.statusText}`);
      }
      
      const stateData = await stateResponse.json();
      statusDiv.innerHTML = `<span class="status-success">✅ Game state loaded! Stars: ${stateData.counts.stars}, Edges: ${stateData.counts.wormholes}</span>`;
      
      // Render the game state
      this.renderGameState(stateData);
      
    } catch (error) {
      console.error('Error starting game:', error);
      statusDiv.innerHTML = `<span class="status-error">❌ Error: ${error.message}</span>`;
    }
  }
  
  /**
   * Render the game state from backend data
   */
  renderGameState(stateData) {
    console.log('Rendering game state from backend:', stateData);
    
    // Clear existing map
    this.mapGenerator.clearMap();
    
    // Convert backend data to frontend format
    const stars = stateData.stars.map(star => ({
      id: star.star_id, // Use star_id instead of id for frontend compatibility
      name: star.name,
      x: star.pos_x,
      y: star.pos_y,
      z: star.pos_z,
      sectorX: star.sector_x,
      sectorY: star.sector_y,
      owner: null // Will be set from starStates
    }));
    
    const wormholes = stateData.wormholes.map(wormhole => {
      // Find the actual star objects by ID
      const star1 = stars.find(s => s.id === wormhole.star_a_id);
      const star2 = stars.find(s => s.id === wormhole.star_b_id);
      return {
        star1: star1,
        star2: star2
      };
    }).filter(wormhole => wormhole.star1 && wormhole.star2); // Only include wormholes where both stars exist
    
    const mapModel = {
      stars: stars,
      wormholes: wormholes,
      config: {
        mapSize: Math.sqrt(stateData.stars.length), // Approximate
        seed: 'backend-generated'
      }
    };
    
    // Reconstruct sectors from star data for sector border rendering
    const maxSectorX = Math.max(...stars.map(star => star.sectorX));
    const maxSectorY = Math.max(...stars.map(star => star.sectorY));
    const mapSize = Math.max(maxSectorX, maxSectorY) + 1;
    
    // Calculate sector size based on canvas size (same as original MapModel)
    const canvasSize = Math.min(window.innerWidth, window.innerHeight);
    const sectorSize = canvasSize / mapSize;
    const offset = canvasSize / 2;
    
    // Create sectors array (2D array of sector objects)
    mapModel.sectors = [];
    for (let row = 0; row < mapSize; row++) {
      const sectorRow = [];
      for (let col = 0; col < mapSize; col++) {
        sectorRow.push({
          row,
          col,
          x: (col * sectorSize) - offset + (sectorSize / 2),
          y: (row * sectorSize) - offset + (sectorSize / 2),
          width: sectorSize,
          height: sectorSize,
          stars: []
        });
      }
      mapModel.sectors.push(sectorRow);
    }
    
    // Apply ownership from starStates
    stateData.starStates.forEach(starState => {
      const star = stars.find(s => s.id === starState.star_id);
      if (star) {
        star.owner = starState.owner_player;
      }
    });
    
    // Generate map with backend data
    this.mapGenerator.generateMapFromModel(mapModel);
    
    // Update camera to fit the map
    this.mapGenerator.positionCameraToFitMap();
    
    console.log('✅ Game state rendered from backend data');
  }
  
  /**
   * Show the panel
   */
  show() {
    this.panel.style.display = 'block';
    this.isVisible = true;
  }
  
  /**
   * Hide the panel
   */
  hide() {
    this.panel.style.display = 'none';
    this.isVisible = false;
  }
  
  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Clean up the panel
   */
  destroy() {
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }

  // Memory test methods disabled for now
  // async runMemoryTest() { ... }
  // async logMemoryUsage() { ... }
}
