/**
 * ManageGamesView - Manage games interface (sponsor/admin/owner only)
 */
import { AIConfigFormBuilder } from './AIConfigFormBuilder.js';

export class ManageGamesView {
  constructor() {
    this.container = null;
    this.selectedGame = null;
    this.selectedPlayer = null;
    this.games = [];
    this.players = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.userRole = localStorage.getItem('user_role');
  }

  /**
   * Create and return the manage games view container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'manage-games-view';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Manage Games</h2>
      </div>
      <div class="view-content">
        <!-- Games List -->
        <div class="manage-games-section">
          <h3>Games</h3>
          <div class="games-list-container">
            <div class="games-loading">Loading games...</div>
          </div>
          <div class="pagination-controls">
            <button class="pagination-btn" id="prev-page-btn" disabled>Previous</button>
            <span class="pagination-info" id="page-info">Page 1 of 1</span>
            <button class="pagination-btn" id="next-page-btn" disabled>Next</button>
          </div>
        </div>

        <!-- Game Control Buttons -->
        <div class="manage-games-section">
          <h3>Game Controls</h3>
          <div class="game-controls">
            <button class="control-btn" id="start-game-btn" disabled>Start Game</button>
            <button class="control-btn" id="pause-unpause-btn" disabled>Pause</button>
            <button class="control-btn" id="freeze-unfreeze-btn" disabled>Freeze</button>
            <button class="control-btn" id="finish-game-btn" disabled>Finish Game</button>
            <button class="control-btn" id="add-ai-player-btn" disabled>Add AI Player</button>
          </div>
        </div>

        <!-- Players List -->
        <div class="manage-games-section">
          <h3>Players</h3>
          <div class="players-list-container">
            <div class="players-placeholder">Select a game to view players</div>
          </div>
        </div>

        <!-- Player Control Buttons -->
        <div class="manage-games-section">
          <h3>Player Controls</h3>
          <div class="player-controls">
            <button class="control-btn" id="end-turn-btn" disabled>End Turn</button>
            <button class="control-btn" id="reset-status-btn" disabled>Reset Status</button>
            <button class="control-btn" id="suspend-btn" disabled>Suspend</button>
            <button class="control-btn" id="eject-btn" disabled>Eject</button>
          </div>
        </div>

        <!-- Meta Edit Field -->
        <div class="manage-games-section">
          <h3>Player Meta</h3>
          <div class="meta-edit-container">
            <textarea 
              id="player-meta-input" 
              class="meta-input" 
              placeholder="Select a player to edit meta (must be valid JSON)"
              disabled
            ></textarea>
            <div class="meta-actions">
              <button class="control-btn" id="save-meta-btn" disabled>Save Meta</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.loadGames();
    return this.container;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Pagination
    const prevBtn = this.container.querySelector('#prev-page-btn');
    const nextBtn = this.container.querySelector('#next-page-btn');
    prevBtn?.addEventListener('click', () => this.changePage(-1));
    nextBtn?.addEventListener('click', () => this.changePage(1));

    // Game control buttons
    this.container.querySelector('#start-game-btn')?.addEventListener('click', () => this.startGame());
    this.container.querySelector('#pause-unpause-btn')?.addEventListener('click', () => this.pauseUnpauseGame());
    this.container.querySelector('#freeze-unfreeze-btn')?.addEventListener('click', () => this.freezeUnfreezeGame());
    this.container.querySelector('#finish-game-btn')?.addEventListener('click', () => this.finishGame());
    this.container.querySelector('#add-ai-player-btn')?.addEventListener('click', () => this.showAddAIPlayerDialog());

    // Player control buttons
    this.container.querySelector('#end-turn-btn')?.addEventListener('click', () => this.endPlayerTurn());
    this.container.querySelector('#reset-status-btn')?.addEventListener('click', () => this.resetPlayerStatus());
    this.container.querySelector('#suspend-btn')?.addEventListener('click', () => this.suspendPlayer());
    this.container.querySelector('#eject-btn')?.addEventListener('click', () => this.ejectPlayer());

    // Meta save button
    this.container.querySelector('#save-meta-btn')?.addEventListener('click', () => this.savePlayerMeta());
  }

  /**
   * Load games from API
   */
  async loadGames(page = 1) {
    const listContainer = this.container?.querySelector('.games-list-container');
    if (!listContainer) return;

    try {
      listContainer.innerHTML = '<div class="games-loading">Loading games...</div>';

      const response = await fetch(`/api/games/manage?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load games');
      }

      this.games = data.games || [];
      this.currentPage = data.pagination?.page || 1;
      this.totalPages = data.pagination?.totalPages || 1;

      this.renderGames();
      this.updatePaginationControls();

    } catch (error) {
      console.error('Error loading games:', error);
      this.showError(error.message || 'Failed to load games');
    }
  }

  /**
   * Render games in the list
   */
  renderGames() {
    const listContainer = this.container?.querySelector('.games-list-container');
    if (!listContainer) return;

    if (this.games.length === 0) {
      listContainer.innerHTML = '<div class="games-empty">No games found.</div>';
      return;
    }

    listContainer.innerHTML = this.games.map(game => {
      const isSelected = this.selectedGame?.id === game.id;
      return `
        <div class="game-card ${isSelected ? 'selected' : ''}" data-game-id="${game.id}">
          <div class="game-card-header">
            <h4 class="game-title">${this.escapeHtml(game.title)}</h4>
            <span class="game-status-badge status-${game.status}">${game.status}</span>
          </div>
          <div class="game-card-body">
            <div class="game-info-row">
              <span class="game-label">Description:</span>
              <span class="game-value">${this.escapeHtml(game.description || 'No description')}</span>
            </div>
            <div class="game-info-row">
              <span class="game-label">Sponsor:</span>
              <span class="game-value">${this.escapeHtml(game.owner_display_name || 'Unknown')}</span>
            </div>
            <div class="game-info-row">
              <span class="game-label">Map Size:</span>
              <span class="game-value">${game.map_size || 'N/A'}</span>
            </div>
            <div class="game-info-row">
              <span class="game-label">Current Turn:</span>
              <span class="game-value">${game.current_turn_number || 0}</span>
            </div>
            <div class="game-info-row">
              <span class="game-label">Players:</span>
              <span class="game-value">${game.player_count || 0} / ${game.max_players || 6}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    listContainer.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        const gameId = card.getAttribute('data-game-id');
        this.selectGame(gameId);
      });
    });
  }

  /**
   * Select a game
   */
  async selectGame(gameId) {
    this.selectedGame = this.games.find(g => g.id === gameId);
    if (!this.selectedGame) return;

    // Update UI
    this.container.querySelectorAll('.game-card').forEach(card => {
      card.classList.remove('selected');
      if (card.getAttribute('data-game-id') === gameId) {
        card.classList.add('selected');
      }
    });

    // Enable game control buttons
    this.updateGameControlButtons();

    // Load players for this game
    await this.loadPlayers(gameId);
    
    // Update game control buttons after loading players (in case player count changed)
    this.updateGameControlButtons();

    // Clear player selection
    this.selectedPlayer = null;
    this.updatePlayerControlButtons();
    this.updateMetaField();
  }

  /**
   * Update game control buttons based on selected game status
   */
  updateGameControlButtons() {
    const startBtn = this.container.querySelector('#start-game-btn');
    const pauseBtn = this.container.querySelector('#pause-unpause-btn');
    const freezeBtn = this.container.querySelector('#freeze-unfreeze-btn');
    const finishBtn = this.container.querySelector('#finish-game-btn');
    const addAIBtn = this.container.querySelector('#add-ai-player-btn');

    if (!this.selectedGame) {
      // No game selected - show default text and disable all buttons
      startBtn.disabled = true;
      startBtn.textContent = 'Start Game';
      pauseBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
      freezeBtn.disabled = true;
      freezeBtn.textContent = 'Freeze';
      finishBtn.disabled = true;
      finishBtn.textContent = 'Finish Game';
      addAIBtn.disabled = true;
      addAIBtn.textContent = 'Add AI Player';
      return;
    }

    const status = this.selectedGame.status;
    const playerCount = this.selectedGame.player_count || 0;
    const maxPlayers = this.selectedGame.max_players || 6;
    const allPlayersAdded = playerCount >= maxPlayers;

    // If status is 'lobby', disable all buttons except Start Game and Add AI Player
    if (status === 'lobby') {
      // Start Game: only enabled when all players have been added
      startBtn.disabled = !allPlayersAdded;
      startBtn.textContent = 'Start Game';
      
      // All other buttons disabled in lobby
      pauseBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
      freezeBtn.disabled = true;
      freezeBtn.textContent = 'Freeze';
      finishBtn.disabled = true;
      finishBtn.textContent = 'Finish Game';
      
      // Add AI Player: enabled in lobby if not at max players
      addAIBtn.disabled = allPlayersAdded;
      addAIBtn.textContent = 'Add AI Player';
      return;
    }

    // For non-lobby statuses, normal behavior
    // Start Game: disabled (only available in lobby)
    startBtn.disabled = true;
    startBtn.textContent = 'Start Game';

    // Pause/Unpause: only if status is 'running' or 'paused'
    pauseBtn.disabled = status !== 'running' && status !== 'paused';
    pauseBtn.textContent = status === 'paused' ? 'Unpause' : 'Pause';

    // Freeze/Unfreeze: can change from any status except 'finished'
    freezeBtn.disabled = status === 'finished';
    freezeBtn.textContent = status === 'frozen' ? 'Unfreeze' : 'Freeze';

    // Finish Game: can change from any status except 'finished'
    finishBtn.disabled = status === 'finished';
    finishBtn.textContent = 'Finish Game';
    
    // Add AI Player: disabled when not in lobby
    addAIBtn.disabled = true;
    addAIBtn.textContent = 'Add AI Player';
  }

  /**
   * Disable all game control buttons
   */
  disableAllGameButtons() {
    this.updateGameControlButtons(); // This will handle the disabled state and text
  }

  /**
   * Load players for a game
   */
  async loadPlayers(gameId) {
    const playersContainer = this.container?.querySelector('.players-list-container');
    if (!playersContainer) return;

    try {
      playersContainer.innerHTML = '<div class="players-loading">Loading players...</div>';

      const response = await fetch(`/api/games/${gameId}/manage/players`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load players');
      }

      this.players = data.players || [];
      this.renderPlayers();

    } catch (error) {
      console.error('Error loading players:', error);
      playersContainer.innerHTML = `<div class="players-error">Error: ${this.escapeHtml(error.message)}</div>`;
    }
  }

  /**
   * Render players in the list
   */
  renderPlayers() {
    const playersContainer = this.container?.querySelector('.players-list-container');
    if (!playersContainer) return;

    if (this.players.length === 0) {
      playersContainer.innerHTML = '<div class="players-empty">No players in this game.</div>';
      return;
    }

    playersContainer.innerHTML = this.players.map(player => {
      const isSelected = this.selectedPlayer?.id === player.id;
      const metaStr = typeof player.meta === 'string' ? player.meta : JSON.stringify(player.meta || {}, null, 2);
      return `
        <div class="player-card ${isSelected ? 'selected' : ''}" data-player-id="${player.id}">
          <div class="player-card-header">
            <h4 class="player-name">${this.escapeHtml(player.name)}</h4>
            <span class="player-status-badge status-${player.status}">${player.status}</span>
          </div>
          <div class="player-card-body">
            <div class="player-info-row">
              <span class="player-label">Country:</span>
              <span class="player-value">${this.escapeHtml(player.country_name || 'N/A')}</span>
            </div>
            <div class="player-info-row">
              <span class="player-label">Status:</span>
              <span class="player-value">${this.escapeHtml(player.status || 'active')}</span>
            </div>
            <div class="player-info-row">
              <span class="player-label">Meta:</span>
              <span class="player-value meta-preview">${this.escapeHtml(metaStr.substring(0, 100))}${metaStr.length > 100 ? '...' : ''}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    playersContainer.querySelectorAll('.player-card').forEach(card => {
      card.addEventListener('click', () => {
        const playerId = card.getAttribute('data-player-id');
        this.selectPlayer(playerId);
      });
    });
  }

  /**
   * Select a player
   */
  selectPlayer(playerId) {
    this.selectedPlayer = this.players.find(p => p.id === playerId);
    if (!this.selectedPlayer) return;

    // Update UI
    this.container.querySelectorAll('.player-card').forEach(card => {
      card.classList.remove('selected');
      if (card.getAttribute('data-player-id') === playerId) {
        card.classList.add('selected');
      }
    });

    // Enable player control buttons
    this.updatePlayerControlButtons();

    // Update meta field
    this.updateMetaField();
  }

  /**
   * Update player control buttons based on selected player status and game status
   */
  updatePlayerControlButtons() {
    if (!this.selectedPlayer) {
      this.disableAllPlayerButtons();
      return;
    }

    const playerStatus = this.selectedPlayer.status;
    const gameStatus = this.selectedGame ? this.selectedGame.status : null;
    const endTurnBtn = this.container.querySelector('#end-turn-btn');
    const resetBtn = this.container.querySelector('#reset-status-btn');
    const suspendBtn = this.container.querySelector('#suspend-btn');
    const ejectBtn = this.container.querySelector('#eject-btn');

    const isEjected = playerStatus === 'ejected';
    const isLobby = gameStatus === 'lobby';
    const isRunning = gameStatus === 'running';

    // End Turn: Only enabled when game is running and player is not ejected
    endTurnBtn.disabled = !isRunning || isEjected;

    // Reset Status: Disabled if game is lobby or player is ejected
    resetBtn.disabled = isLobby || isEjected;

    // Suspend: Disabled if game is lobby or player is ejected
    suspendBtn.disabled = isLobby || isEjected;

    // Eject: Always enabled unless player is already ejected
    ejectBtn.disabled = isEjected;
  }

  /**
   * Disable all player control buttons
   */
  disableAllPlayerButtons() {
    this.container.querySelectorAll('.player-controls .control-btn').forEach(btn => {
      btn.disabled = true;
    });
    this.container.querySelector('#save-meta-btn').disabled = true;
    this.container.querySelector('#player-meta-input').disabled = true;
  }

  /**
   * Update meta field with selected player's meta
   */
  updateMetaField() {
    const metaInput = this.container.querySelector('#player-meta-input');
    if (!metaInput) return;

    if (!this.selectedPlayer) {
      metaInput.value = '';
      metaInput.disabled = true;
      return;
    }

    const meta = this.selectedPlayer.meta;
    const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta || {}, null, 2);
    metaInput.value = metaStr;
    metaInput.disabled = false;
  }

  /**
   * Game control actions
   */
  async startGame() {
    if (!this.selectedGame || this.selectedGame.status !== 'lobby') return;
    await this.updateGameStatus('running');
  }

  async pauseUnpauseGame() {
    if (!this.selectedGame) return;
    const newStatus = this.selectedGame.status === 'paused' ? 'running' : 'paused';
    await this.updateGameStatus(newStatus);
  }

  async freezeUnfreezeGame() {
    if (!this.selectedGame || this.selectedGame.status === 'finished') return;
    const newStatus = this.selectedGame.status === 'frozen' ? 'running' : 'frozen';
    await this.updateGameStatus(newStatus);
  }

  async finishGame() {
    if (!this.selectedGame || this.selectedGame.status === 'finished') return;
    if (!confirm('Are you sure you want to finish this game? This action cannot be undone.')) {
      return;
    }
    await this.updateGameStatus('finished');
  }

  /**
   * Update game status
   */
  async updateGameStatus(newStatus) {
    if (!this.selectedGame) return;

    try {
      const response = await fetch(`/api/games/${this.selectedGame.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update game status');
      }

      // Update selected game status
      this.selectedGame.status = newStatus;
      
      // Reload games to get updated data (including player count)
      await this.loadGames(this.currentPage);
      
      // Re-select the game to update the UI
      if (this.selectedGame) {
        await this.selectGame(this.selectedGame.id);
      }
      
      this.updateGameControlButtons();
      
      // Update player control buttons in case a player is selected
      // (selectGame clears selection, but this is a safety check)
      if (this.selectedPlayer) {
        this.updatePlayerControlButtons();
      }

      alert(`Game status updated to ${newStatus}`);

    } catch (error) {
      console.error('Error updating game status:', error);
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Player control actions
   */
  async endPlayerTurn() {
    if (!this.selectedGame || !this.selectedPlayer) return;

    try {
      const response = await fetch(`/api/games/${this.selectedGame.id}/players/${this.selectedPlayer.id}/end-turn`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to end player turn');
      }

      alert('Player turn ended successfully');
      await this.loadPlayers(this.selectedGame.id);

    } catch (error) {
      console.error('Error ending player turn:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async resetPlayerStatus() {
    if (!this.selectedGame || !this.selectedPlayer || this.selectedPlayer.status === 'ejected') return;
    await this.updatePlayerStatus('active');
  }

  async suspendPlayer() {
    if (!this.selectedGame || !this.selectedPlayer || this.selectedPlayer.status === 'ejected') return;
    await this.updatePlayerStatus('suspended');
  }

  async ejectPlayer() {
    if (!this.selectedGame || !this.selectedPlayer || this.selectedPlayer.status === 'ejected') return;
    if (!confirm('Are you sure you want to eject this player? This action cannot be undone.')) {
      return;
    }
    await this.updatePlayerStatus('ejected');
  }

  /**
   * Update player status
   */
  async updatePlayerStatus(newStatus) {
    if (!this.selectedGame || !this.selectedPlayer) return;

    try {
      const response = await fetch(`/api/games/${this.selectedGame.id}/players/${this.selectedPlayer.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update player status');
      }

      // Update selected player status
      this.selectedPlayer.status = newStatus;
      this.updatePlayerControlButtons();
      this.renderPlayers(); // Re-render to update status badge

      alert(`Player status updated to ${newStatus}`);

    } catch (error) {
      console.error('Error updating player status:', error);
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Show Add AI Player dialog
   */
  async showAddAIPlayerDialog() {
    if (!this.selectedGame) return;

    // Fetch available AIs
    let availableAIs = [];
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/ai/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success && data.ais) {
        availableAIs = data.ais;
      } else {
        alert('Failed to load available AIs: ' + (data.error || 'Unknown error'));
        return;
      }
    } catch (error) {
      console.error('Error fetching AIs:', error);
      alert('Failed to load available AIs: ' + error.message);
      return;
    }

    if (availableAIs.length === 0) {
      alert('No AI implementations are available.');
      return;
    }

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'ai-player-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00ff88;
      border-radius: 15px;
      padding: 30px;
      color: white;
      z-index: 10002;
      min-width: 500px;
      max-width: 700px;
      max-height: 90vh;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    dialog.innerHTML = `
      <h2 style="margin: 0 0 20px 0; color: #00ff88; text-align: center;">Add AI Player</h2>
      <div class="ai-dialog-content">
        <div class="ai-selection-group">
          <label for="ai-select" style="display: block; margin-bottom: 8px; color: #00ff88;">Select AI:</label>
          <select id="ai-select" class="ai-select" style="
            width: 100%;
            padding: 8px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #00ff88;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            margin-bottom: 15px;
          ">
            <option value="">-- Select an AI --</option>
          </select>
        </div>
        <div id="ai-description" class="ai-description" style="
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(0, 255, 136, 0.1);
          border-left: 3px solid #00ff88;
          border-radius: 5px;
          font-size: 13px;
          line-height: 1.5;
          display: none;
        "></div>
        <div class="country-name-group">
          <label for="country-name-input" style="display: block; margin-bottom: 8px; color: #00ff88;">Country Name:</label>
          <input type="text" id="country-name-input" class="country-name-input" placeholder="Enter unique country name" style="
            width: 100%;
            padding: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #00ff88;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            margin-bottom: 15px;
          " />
        </div>
        <div id="ai-config-container" class="ai-config-container" style="
          margin-bottom: 20px;
          display: none;
        "></div>
        <div id="ai-dialog-error" class="ai-dialog-error" style="
          color: #ff4444;
          margin-bottom: 15px;
          display: none;
        "></div>
        <div class="ai-dialog-actions" style="
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        ">
          <button class="close-dialog-btn" style="
            padding: 10px 20px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid #00ff88;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
          ">Cancel</button>
          <button class="add-ai-player-btn" style="
            padding: 10px 20px;
            background: #00ff88;
            color: black;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
          " disabled>Add AI Player</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Populate AI select
    const aiSelect = dialog.querySelector('#ai-select');
    availableAIs.forEach(ai => {
      const option = document.createElement('option');
      option.value = ai.name;
      option.textContent = ai.name;
      aiSelect.appendChild(option);
    });

    const aiDescription = dialog.querySelector('#ai-description');
    const aiConfigContainer = dialog.querySelector('#ai-config-container');
    const countryNameInput = dialog.querySelector('#country-name-input');
    const addBtn = dialog.querySelector('.add-ai-player-btn');
    const errorDiv = dialog.querySelector('#ai-dialog-error');
    const formBuilder = new AIConfigFormBuilder();
    let currentForm = null;
    let selectedAI = null;

    // AI selection handler
    aiSelect.addEventListener('change', async (e) => {
      const aiName = e.target.value;
      if (!aiName) {
        aiDescription.style.display = 'none';
        aiConfigContainer.style.display = 'none';
        addBtn.disabled = true;
        selectedAI = null;
        return;
      }

      selectedAI = availableAIs.find(ai => ai.name === aiName);
      if (!selectedAI) return;

      // Show description
      if (selectedAI.description) {
        aiDescription.textContent = selectedAI.description;
        aiDescription.style.display = 'block';
      } else {
        aiDescription.style.display = 'none';
      }

      // Build config form
      if (selectedAI.schema && Object.keys(selectedAI.schema).length > 0) {
        currentForm = formBuilder.buildForm(selectedAI.schema, {}, aiConfigContainer);
        aiConfigContainer.style.display = 'block';
      } else {
        aiConfigContainer.innerHTML = '<p style="color: #888; font-size: 13px;">This AI has no configurable options.</p>';
        aiConfigContainer.style.display = 'block';
        currentForm = { getData: () => ({}), validate: () => [] };
      }

      // Enable add button if country name is filled
      updateAddButtonState();
    });

    // Country name input handler
    countryNameInput.addEventListener('input', () => {
      updateAddButtonState();
    });

    // Update add button state
    function updateAddButtonState() {
      const hasCountryName = countryNameInput.value.trim().length > 0;
      const hasAI = selectedAI !== null;
      addBtn.disabled = !(hasCountryName && hasAI);
    }

    // Add AI player handler
    addBtn.addEventListener('click', async () => {
      if (addBtn.disabled) return;

      const countryName = countryNameInput.value.trim();
      if (!countryName) {
        showError('Country name is required');
        return;
      }

      if (!selectedAI) {
        showError('Please select an AI');
        return;
      }

      // Validate form
      if (currentForm) {
        const errors = currentForm.validate();
        if (errors.length > 0) {
          showError(errors.join(', '));
          return;
        }
      }

      // Get AI config
      const aiConfig = currentForm ? currentForm.getData() : {};

      // Disable button during request
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      hideError();

      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/games/${this.selectedGame.id}/ai-players`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            aiName: selectedAI.name,
            countryName,
            aiConfig
          })
        });

        const data = await response.json();

        if (data.success) {
          // Close dialog
          document.body.removeChild(dialog);
          
          // Reload games and players
          await this.loadGames(this.currentPage);
          if (this.selectedGame) {
            await this.selectGame(this.selectedGame.id);
          }
        } else {
          showError(data.error || 'Failed to add AI player');
          addBtn.disabled = false;
          addBtn.textContent = 'Add AI Player';
        }
      } catch (error) {
        console.error('Error adding AI player:', error);
        showError('Failed to add AI player: ' + error.message);
        addBtn.disabled = false;
        addBtn.textContent = 'Add AI Player';
      }
    });

    function showError(message) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }

    function hideError() {
      errorDiv.style.display = 'none';
    }

    // Close button handler
    const closeBtn = dialog.querySelector('.close-dialog-btn');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    // Close on outside click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
      }
    });

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(dialog);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Save player meta
   */
  async savePlayerMeta() {
    if (!this.selectedGame || !this.selectedPlayer) return;

    const metaInput = this.container.querySelector('#player-meta-input');
    if (!metaInput) return;

    const metaStr = metaInput.value.trim();

    // Validate JSON
    let metaData;
    try {
      metaData = JSON.parse(metaStr);
    } catch (e) {
      alert('Error: Meta must be valid JSON');
      return;
    }

    try {
      const response = await fetch(`/api/games/${this.selectedGame.id}/players/${this.selectedPlayer.id}/meta`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        },
        body: JSON.stringify({ meta: metaData })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update player meta');
      }

      // Update selected player meta
      this.selectedPlayer.meta = metaData;
      this.renderPlayers(); // Re-render to update meta preview

      alert('Player meta updated successfully');

    } catch (error) {
      console.error('Error updating player meta:', error);
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Pagination
   */
  changePage(delta) {
    const newPage = this.currentPage + delta;
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.loadGames(newPage);
    }
  }

  updatePaginationControls() {
    const prevBtn = this.container.querySelector('#prev-page-btn');
    const nextBtn = this.container.querySelector('#next-page-btn');
    const pageInfo = this.container.querySelector('#page-info');

    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
  }

  /**
   * Show error message
   */
  showError(message) {
    const listContainer = this.container?.querySelector('.games-list-container');
    if (listContainer) {
      listContainer.innerHTML = `<div class="games-error">Error: ${this.escapeHtml(message)}</div>`;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get the container element
   */
  getContainer() {
    if (!this.container) {
      this.create();
    }
    return this.container;
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.selectedGame = null;
    this.selectedPlayer = null;
    this.games = [];
    this.players = [];
  }
}
