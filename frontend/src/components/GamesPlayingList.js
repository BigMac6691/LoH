/**
 * GamesPlayingList - List of games the current user is playing
 */
import { getHeadersForGet } from '../utils/apiHeaders.js';
import { MenuView } from './MenuView.js';

export class GamesPlayingList extends MenuView {
  constructor(homePage) {
    super(homePage);
    this.container = null;
    this.games = [];
    this.userId = localStorage.getItem('user_id');
  }

  /**
   * Create and return the games playing list container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'games-playing-list';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Games Playing</h2>
      </div>
      <div class="view-content">
        <div class="games-list-container">
          <div class="games-loading">Loading games...</div>
        </div>
      </div>
    `;
    
    this.loadGames();
    return this.container;
  }

  /**
   * Load games from API
   */
  async loadGames() {
    if (!this.userId) {
      this.showError('User ID not found. Please log in again.');
      return;
    }

    const listContainer = this.container?.querySelector('.games-list-container');
    if (!listContainer) return;

    try {
      listContainer.innerHTML = '<div class="games-loading">Loading games...</div>';

      const response = await fetch(`/api/games/playing`, {
        headers: getHeadersForGet()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load games');
      }

      this.games = data.games || [];
      this.renderGames();

    } catch (error) {
      console.error('Error loading games playing:', error);
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
      listContainer.innerHTML = '<div class="games-empty">No games found. Join a game from the Available Games list!</div>';
      return;
    }

    listContainer.innerHTML = this.games.map(game => `
      <div class="game-card">
        <div class="game-card-header">
          <h3 class="game-title">${this.escapeHtml(game.title)}</h3>
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
            <span class="game-label">Your Status:</span>
            <span class="game-value">${this.escapeHtml(game.player_status || 'active')}</span>
          </div>
        </div>
        <div class="game-card-footer">
          <button class="game-action-btn play-btn" data-game-id="${game.id}" ${game.status === 'lobby' || game.status === 'frozen' ? 'disabled' : ''}>
            PLAY
          </button>
        </div>
      </div>
    `).join('');

    // Add click handlers for PLAY buttons
    listContainer.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (btn.disabled) return;
        const gameId = e.target.getAttribute('data-game-id');
        this.playGame(gameId);
      });
    });
  }

  /**
   * Handle PLAY button click - load the game
   */
  async playGame(gameId) {
    if (!gameId) return;

    // Emit event to load game (main.js will handle this)
    if (window.eventBus) {
      window.eventBus.emit('game:load', { gameId });
    } else {
      console.error('Event bus not available');
    }
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
   * Refresh the games list
   */
  refresh() {
    this.loadGames();
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.games = [];
  }
}

