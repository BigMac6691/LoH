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
    
    this.createPanel();
    this.setupEventListeners();
  }
  
  /**
   * Create the backend test panel DOM element
   */
  createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'backend-test-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      min-width: 300px;
      max-width: 400px;
      display: none;
      border: 2px solid #00ff00;
    `;
    
    this.panel.innerHTML = `
      <div style="margin-bottom: 15px; font-weight: bold; color: #00ff00; font-size: 14px;">
        🗄️ BACKEND TEST PANEL
      </div>
      
      <form id="game-form">
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; color: #ccc;">Seed:</label>
          <input type="number" id="seed-input" value="12345" min="0" max="999999" style="
            width: 100%;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 3px;
            font-family: monospace;
            font-size: 11px;
          ">
        </div>
        
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; color: #ccc;">Map Size:</label>
          <input type="number" id="map-size-input" value="5" min="2" max="9" style="
            width: 100%;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 3px;
            font-family: monospace;
            font-size: 11px;
          ">
        </div>
        
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; color: #ccc;">Density Min:</label>
          <input type="number" id="density-min-input" value="3" min="0" max="9" style="
            width: 100%;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 3px;
            font-family: monospace;
            font-size: 11px;
          ">
        </div>
        
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; color: #ccc;">Density Max:</label>
          <input type="number" id="density-max-input" value="7" min="0" max="9" style="
            width: 100%;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 3px;
            font-family: monospace;
            font-size: 11px;
          ">
        </div>
        
        <div style="margin-bottom: 15px;">
          <div style="margin-bottom: 8px; color: #ccc; font-weight: bold;">Players:</div>
          
          <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 3px; color: #ccc;">Player 1:</label>
            <input type="text" id="player1-name" value="Red Player" placeholder="Name" style="
              width: 60%;
              padding: 5px;
              background: #333;
              color: white;
              border: 1px solid #555;
              border-radius: 3px;
              font-family: monospace;
              font-size: 11px;
              margin-right: 5px;
            ">
            <input type="color" id="player1-color" value="#ff0000" style="
              width: 35%;
              height: 25px;
              background: #333;
              border: 1px solid #555;
              border-radius: 3px;
            ">
          </div>
          
          <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 3px; color: #ccc;">Player 2:</label>
            <input type="text" id="player2-name" value="Blue Player" placeholder="Name" style="
              width: 60%;
              padding: 5px;
              background: #333;
              color: white;
              border: 1px solid #555;
              border-radius: 3px;
              font-family: monospace;
              font-size: 11px;
              margin-right: 5px;
            ">
            <input type="color" id="player2-color" value="#0000ff" style="
              width: 35%;
              height: 25px;
              background: #333;
              border: 1px solid #555;
              border-radius: 3px;
            ">
          </div>
        </div>
        
        <button type="submit" id="start-game-btn" style="
          width: 100%;
          background: #00aa00;
          color: white;
          border: none;
          padding: 10px;
          border-radius: 5px;
          cursor: pointer;
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
        ">🚀 START GAME</button>
      </form>
      
      <div id="status" style="
        margin-top: 15px;
        padding: 10px;
        background: #222;
        border-radius: 5px;
        font-size: 11px;
        min-height: 20px;
      "></div>
      
      <div style="margin-top: 15px; border-top: 1px solid #444; padding-top: 15px;">
          <div style="margin-bottom: 10px; font-weight: bold; color: #00ffff; font-size: 12px;">
            🧪 DEV TOOLS
          </div>
          
          <!-- Memory tests disabled for now
          <div style="margin-bottom: 10px;">
            <button id="memory-test-btn" style="
              background: #444;
              color: white;
              border: 1px solid #666;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              width: 100%;
              margin-bottom: 5px;
            ">Run Memory Test</button>
          </div>
          
          <div style="margin-bottom: 10px;">
            <button id="memory-log-btn" style="
              background: #444;
              color: white;
              border: 1px solid #666;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              width: 100%;
              margin-bottom: 5px;
            ">Log Memory Usage</button>
          </div>
          -->
          
          <div style="margin-bottom: 10px;">
            <button id="move-orders-btn" style="
              background: #444;
              color: white;
              border: 1px solid #666;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 11px;
              width: 100%;
              margin-bottom: 5px;
            ">Log Move Orders</button>
          </div>
        </div>
      
      <div style="margin-top: 15px;">
        <button id="toggle-panel-btn" style="
          background: #666;
          color: white;
          border: 1px solid #888;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
        ">Hide Panel</button>
      </div>
      
      <div style="font-size: 10px; color: #ccc; margin-top: 10px;">
        Press 'B' to toggle panel
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
      // Memory test disabled for now
      // else if (e.key === 'm' || e.key === 'M') {
      //   this.runMemoryTest();
      // }
    });
    
    // Dev tools buttons
    // const memoryTestBtn = this.panel.querySelector('#memory-test-btn');
    // const memoryLogBtn = this.panel.querySelector('#memory-log-btn');
    const moveOrdersBtn = this.panel.querySelector('#move-orders-btn');
    
    // Memory tests disabled for now
    /*
    memoryTestBtn.addEventListener('click', () => {
      this.runMemoryTest();
    });
    
    memoryLogBtn.addEventListener('click', () => {
      this.logMemoryUsage();
    });
    */
    
    moveOrdersBtn.addEventListener('click', () => {
      this.logMoveOrders();
    });
  }
  
  /**
   * Start a new game via backend API
   */
  async startGame() {
    const statusDiv = this.panel.querySelector('#status');
    statusDiv.innerHTML = '<span style="color: #ffff00;">⏳ Starting game...</span>';
    
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
      
      statusDiv.innerHTML = '<span style="color: #ffff00;">⏳ Creating game...</span>';
      
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
      statusDiv.innerHTML = `<span style="color: #00ff00;">✅ Game created! ID: ${startData.gameId}</span>`;
      
      // GET game state
      statusDiv.innerHTML = '<span style="color: #ffff00;">⏳ Loading game state...</span>';
      
      const stateResponse = await fetch(`/api/dev/state?gameId=${startData.gameId}`);
      
      if (!stateResponse.ok) {
        const errorData = await stateResponse.json();
        throw new Error(`Failed to load game state: ${errorData.error || stateResponse.statusText}`);
      }
      
      const stateData = await stateResponse.json();
      statusDiv.innerHTML = `<span style="color: #00ff00;">✅ Game state loaded! Stars: ${stateData.counts.stars}, Edges: ${stateData.counts.wormholes}</span>`;
      
      // Render the game state
      this.renderGameState(stateData);
      
    } catch (error) {
      console.error('Error starting game:', error);
      statusDiv.innerHTML = `<span style="color: #ff0000;">❌ Error: ${error.message}</span>`;
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
    const mapModel = {
      stars: stateData.stars.map(star => ({
        id: star.id,
        name: star.name,
        x: star.pos_x,
        y: star.pos_y,
        z: star.pos_z,
        sectorX: star.sector_x,
        sectorY: star.sector_y,
        owner: null // Will be set from starStates
      })),
      wormholes: stateData.wormholes.map(wormhole => ({
        star1: wormhole.star_a_id,
        star2: wormhole.star_b_id
      })),
      config: {
        mapSize: Math.sqrt(stateData.stars.length), // Approximate
        seed: 'backend-generated'
      }
    };
    
    // Apply ownership from starStates
    stateData.starStates.forEach(starState => {
      const star = mapModel.stars.find(s => s.id === starState.star_id);
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
