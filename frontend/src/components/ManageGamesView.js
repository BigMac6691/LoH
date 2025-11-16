/**
 * ManageGamesView - Manage games interface (sponsor/admin/owner only)
 */
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
              <span class="game-value">${game.player_count || 0}</span>
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
      return;
    }

    const status = this.selectedGame.status;

    // Start Game: only if status is 'lobby'
    startBtn.disabled = status !== 'lobby';
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
   * Update player control buttons based on selected player status
   */
  updatePlayerControlButtons() {
    if (!this.selectedPlayer) {
      this.disableAllPlayerButtons();
      return;
    }

    const status = this.selectedPlayer.status;
    const endTurnBtn = this.container.querySelector('#end-turn-btn');
    const resetBtn = this.container.querySelector('#reset-status-btn');
    const suspendBtn = this.container.querySelector('#suspend-btn');
    const ejectBtn = this.container.querySelector('#eject-btn');

    // All buttons enabled if player is not ejected
    const isEjected = status === 'ejected';
    endTurnBtn.disabled = isEjected;
    resetBtn.disabled = isEjected;
    suspendBtn.disabled = isEjected;
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
      this.updateGameControlButtons();
      this.renderGames(); // Re-render to update status badge

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
