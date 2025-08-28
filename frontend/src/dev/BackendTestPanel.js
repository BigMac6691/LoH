/**
 * BackendTestPanel - Development panel for testing backend game generation
 * Only available in DEV_MODE
 */

export class BackendTestPanel
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
    this.dragOffset = { x: 0, y: 0 };
    this.games = [];
    
    this.createPanel();
    this.setupEventListeners();
    this.setupDragging();
    this.loadGames();
  }
  
  /**
   * Create the backend test panel DOM element
   */
  createPanel()
  {
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
          <label class="form-label">Select Game:</label>
          <select id="game-select" class="form-input">
            <option value="">CREATE NEW</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Title:</label>
          <input type="text" id="title-input" value="Test Game" placeholder="Game Title" class="form-input">
        </div>
        
        <div class="form-group">
          <label class="form-label">Description:</label>
          <input type="text" id="description-input" value="A test game for development" placeholder="Game Description" class="form-input">
        </div>
        
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
  setupEventListeners()
  {
    // Form submission
    const form = this.panel.querySelector('#game-form');
    form.addEventListener('submit', (e) =>
    {
      e.preventDefault();
      this.startGame();
    });
    
    // Game select dropdown
    const gameSelect = this.panel.querySelector('#game-select');
    gameSelect.addEventListener('change', (e) =>
    {
      this.onGameSelect(e.target.value);
    });
    
    // Toggle panel button
    const toggleBtn = this.panel.querySelector('#toggle-panel-btn');
    toggleBtn.addEventListener('click', () =>
    {
      this.toggle();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) =>
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
  }
  
  /**
   * Set up dragging functionality
   */
  setupDragging()
  {
    this.panel.addEventListener('mousedown', (e) =>
    {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT')
      {
        return; // Don't drag when clicking on form elements
      }
      
      this.isDragging = true;
      const rect = this.panel.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this.panel.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) =>
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
    import('./MemoryTest.js').then(module =>
    {
      module.runMemoryTest();
    }).catch(error =>
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
    import('./MemoryTest.js').then(module =>
    {
      module.logMemoryUsage();
    }).catch(error =>
    {
      console.error('Failed to log memory usage:', error);
    });
  }
  
  /**
   * Start a new game or view existing game via backend API
   */
  async startGame()
  {
    const statusDiv = this.panel.querySelector('#status');
    const gameSelect = this.panel.querySelector('#game-select');
    const selectedGameId = gameSelect.value;
    
    try
    {
      if (!selectedGameId)
      {
        // Creating a new game
        statusDiv.innerHTML = '<span class="status-loading">⏳ Starting game...</span>';
        
        // Get form values
        const title = this.panel.querySelector('#title-input').value;
        const description = this.panel.querySelector('#description-input').value;
        const seed = this.panel.querySelector('#seed-input').value;
        const mapSize = parseInt(this.panel.querySelector('#map-size-input').value);
        const densityMin = parseInt(this.panel.querySelector('#density-min-input').value);
        const densityMax = parseInt(this.panel.querySelector('#density-max-input').value);
        const player1Name = this.panel.querySelector('#player1-name').value;
        const player1Color = this.panel.querySelector('#player1-color').value;
        const player2Name = this.panel.querySelector('#player2-name').value;
        const player2Color = this.panel.querySelector('#player2-color').value;
        
        // Debug logging
        console.log('Form values extracted:', { title, description, seed, mapSize, densityMin, densityMax, player1Name, player1Color, player2Name, player2Color });
        
        // Validate inputs
        if (!title || !description || !seed || !player1Name || !player2Name)
        {
          throw new Error('Please fill in all required fields');
        }
        
        if (densityMin > densityMax)
        {
          throw new Error('Density Min cannot be greater than Density Max');
        }
        
        // Prepare request body
        const requestBody = {
          title,
          description,
          seed,
          mapSize,
          densityMin,
          densityMax,
          ownerId: "a109d369-0df3-4e73-b262-62c793ad743f", // Using the same ownerId as GameRouter
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
        
        if (!startResponse.ok)
        {
          const errorData = await startResponse.json();
          throw new Error(`Failed to start game: ${errorData.error || startResponse.statusText}`);
        }
        
        const startData = await startResponse.json();
        statusDiv.innerHTML = `<span class="status-success">✅ Game created! ID: ${startData.gameId}</span>`;
        
        // Reload games list and select the new game
        await this.loadGames();
        gameSelect.value = startData.gameId;
        
        // Load and render the game state
        await this.loadAndRenderGameState(startData.gameId);
        
      } else
      {
        // Viewing an existing game
        statusDiv.innerHTML = '<span class="status-loading">⏳ Loading game...</span>';
        await this.loadAndRenderGameState(selectedGameId);
      }
      
    } catch (error)
    {
      console.error('Error with game:', error);
      statusDiv.innerHTML = `<span class="status-error">❌ Error: ${error.message}</span>`;
    }
  }
  
  /**
   * Load and render game state for a given game ID
   * @param {string} gameId - Game ID to load
   */
  async loadAndRenderGameState(gameId)
  {
    const statusDiv = this.panel.querySelector('#status');
    
    statusDiv.innerHTML = '<span class="status-loading">⏳ Loading game state...</span>';
    
    const stateResponse = await fetch(`/api/dev/state?gameId=${gameId}`);
    
    if (!stateResponse.ok)
    {
      const errorData = await stateResponse.json();
      throw new Error(`Failed to load game state: ${errorData.error || stateResponse.statusText}`);
    }
    
    const stateData = await stateResponse.json();
    statusDiv.innerHTML = `<span class="status-success">✅ Game state loaded! Stars: ${stateData.counts.stars}, Edges: ${stateData.counts.wormholes}</span>`;
    
    // Render the game state
    await this.renderGameState(stateData);
  }
  
  /**
   * Render the game state from backend data
   */
  async renderGameState(stateData)
  {
    console.log('Rendering game state from backend:', stateData);
    
    // Clear existing map
    this.mapGenerator.clearMap();
    
    // Create a MapModel instance and populate it with backend data
    const { MapModel } = await import('@loh/shared');
    const mapModel = new MapModel('backend-generated');
    
    // Set stars in MapModel (this creates Star instances)
    mapModel.setStars(stateData.stars);
    
    // Set wormholes in MapModel (this creates wormhole objects with Star references)
    mapModel.setWormholes(stateData.wormholes);
    
    // Build sectors from the stars
    mapModel.buildSectors();
    
    // Apply ownership from starStates and set correct player colors
    stateData.starStates.forEach(starState =>
    {
      const star = mapModel.getStarById(starState.star_id);
      if (star)
      {
        // Find the player who owns this star and set the correct color
        const ownerPlayer = stateData.players.find(p => p.id === starState.owner_player);
        if (ownerPlayer)
          star.assignOwner(ownerPlayer);
        else
        {
          star.setColor('#000000'); // Fallback to black if player not found, want it to stand out
          console.error('Owning player not found:', starState.owner_player);
        }
      }
      else
        console.error('Star not found:', starState.star_id);
    });
    
         // Add ships to stars based on ships data
     const { Ship } = await import('@loh/shared');
     for (const shipData of stateData.ships)
     {
       const star = mapModel.getStarById(shipData.location_star_id);
       if (star)
       {
         // Create Ship instance from backend data
         const ship = new Ship({
           id: shipData.id,
           power: shipData.power,
           damage: shipData.damage,
           owner: stateData.players.find(p => p.id === shipData.owner_player) || null,
           location: star
         });
         
         // Add ship if not already present
         if (!star.hasShip(ship))
           star.addShip(ship);
       }
       else
         console.error('Star not found for ship:', shipData.location_star_id);
     }
    
    // Generate map with the MapModel instance
    await this.mapGenerator.generateMapFromModel(mapModel);
    
    // Update camera to fit the map
    this.mapGenerator.positionCameraToFitMap();
    
    // Update star colors to show ownership
    this.mapGenerator.updateStarColors([]);
    
    // Update fleet icons for stars with ships
    const starList = this.mapGenerator.getStars();
    starList.forEach(star =>
    {
      if (star.hasShips())
        this.mapGenerator.updateFleetIconForStar(star);
    });
    
    console.log('✅ Game state rendered from backend data using MapModel');
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
    } else
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

  /**
   * Load games from the backend
   */
  async loadGames()
  {
    try
    {
      const response = await fetch('/api/dev/games');
      if (!response.ok)
      {
        throw new Error(`Failed to load games: ${response.statusText}`);
      }
      
      this.games = await response.json();
      this.populateGameSelect();
    } catch (error)
    {
      console.error('Error loading games:', error);
    }
  }
  
  /**
   * Populate the game select dropdown
   */
  populateGameSelect()
  {
    const gameSelect = this.panel.querySelector('#game-select');
    
    // Clear existing options except the first one
    gameSelect.innerHTML = '<option value="">CREATE NEW</option>';
    
    // Add games to the dropdown
    this.games.forEach(game =>
    {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.title;
      gameSelect.appendChild(option);
    });
  }
  
  /**
   * Handle game selection from dropdown
   * @param {string} gameId - Selected game ID or empty string for "CREATE NEW"
   */
  onGameSelect(gameId)
  {
    if (!gameId)
    {
      // CREATE NEW selected - clear form and enable inputs
      this.clearForm();
      this.enableForm();
      return;
    }
    
    // Find the selected game
    const selectedGame = this.games.find(game => game.id === gameId);
    if (!selectedGame)
    {
      console.error('Selected game not found:', gameId);
      return;
    }
    
    // Populate form with game data
    this.populateForm(selectedGame);
    this.disableForm();
  }
  
  /**
   * Clear the form
   */
  clearForm()
  {
    this.panel.querySelector('#title-input').value = 'Test Game';
    this.panel.querySelector('#description-input').value = 'A test game for development';
    this.panel.querySelector('#seed-input').value = '12345';
    this.panel.querySelector('#map-size-input').value = '5';
    this.panel.querySelector('#density-min-input').value = '3';
    this.panel.querySelector('#density-max-input').value = '7';
    this.panel.querySelector('#player1-name').value = 'Red Player';
    this.panel.querySelector('#player1-color').value = '#ff0000';
    this.panel.querySelector('#player2-name').value = 'Blue Player';
    this.panel.querySelector('#player2-color').value = '#0000ff';
  }
  
  /**
   * Populate form with game data
   * @param {Object} game - Game object
   */
  populateForm(game)
  {
    this.panel.querySelector('#title-input').value = game.title;
    this.panel.querySelector('#description-input').value = game.description;
    this.panel.querySelector('#seed-input').value = game.seed;
    this.panel.querySelector('#map-size-input').value = game.map_size;
    this.panel.querySelector('#density-min-input').value = game.density_min;
    this.panel.querySelector('#density-max-input').value = game.density_max;
  }
  
  /**
   * Enable form inputs
   */
  enableForm()
  {
    const inputs = this.panel.querySelectorAll('input, select');
    inputs.forEach(input =>
    {
      input.disabled = false;
    });
    this.panel.querySelector('#start-game-btn').textContent = '🚀 START GAME';
  }
  
  /**
   * Disable form inputs (when viewing existing game)
   */
  disableForm()
  {
    const inputs = this.panel.querySelectorAll('input');
    inputs.forEach(input =>
    {
      input.disabled = true;
    });
    this.panel.querySelector('#start-game-btn').textContent = '👁️ VIEW GAME';
  }

  // Memory test methods disabled for now
  // async runMemoryTest() { ... }
  // async logMemoryUsage() { ... }
}
