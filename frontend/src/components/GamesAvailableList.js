/**
 * GamesAvailableList - List of games available for the current user to join
 */
import { getHeaders, getHeadersForGet } from '../utils/apiHeaders.js';

export class GamesAvailableList {
  constructor() {
    this.container = null;
    this.games = [];
    this.userId = localStorage.getItem('user_id');
  }

  /**
   * Create and return the games available list container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'games-available-list';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Games Available</h2>
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

      const response = await fetch(`/api/games/available`, {
        headers: getHeadersForGet()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load games');
      }

      this.games = data.games || [];
      this.renderGames();

    } catch (error) {
      console.error('Error loading games available:', error);
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
      listContainer.innerHTML = '<div class="games-empty">No available games found. Create a new game to get started!</div>';
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
            <span class="game-label">Players:</span>
            <span class="game-value">${game.player_count || 0} / ${game.max_players || 6}</span>
          </div>
        </div>
        <div class="game-card-footer">
          <input 
            type="text" 
            class="country-name-input" 
            data-game-id="${game.id}"
            placeholder="Country name" 
            maxlength="50"
          />
          <button class="game-action-btn join-btn" data-game-id="${game.id}">
            JOIN
          </button>
        </div>
      </div>
    `).join('');

    // Add click handlers for JOIN buttons
    listContainer.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gameId = e.target.getAttribute('data-game-id');
        const countryInput = listContainer.querySelector(`.country-name-input[data-game-id="${gameId}"]`);
        const countryName = countryInput ? countryInput.value.trim() : '';
        
        if (!countryName) {
          alert('Please enter a country name');
          if (countryInput) countryInput.focus();
          return;
        }
        
        this.joinGame(gameId, countryName);
      });
    });
    
    // Allow Enter key to trigger join
    listContainer.querySelectorAll('.country-name-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const gameId = input.getAttribute('data-game-id');
          const countryName = input.value.trim();
          
          if (!countryName) {
            alert('Please enter a country name');
            return;
          }
          
          this.joinGame(gameId, countryName);
        }
      });
    });
  }

  /**
   * Handle JOIN button click - join the game then load it
   */
  async joinGame(gameId, countryName) {
    if (!gameId || !this.userId) return;
    if (!countryName || !countryName.trim()) {
      alert('Please enter a country name');
      return;
    }

    const btn = this.container?.querySelector(`[data-game-id="${gameId}"].join-btn`);
    const countryInput = this.container?.querySelector(`.country-name-input[data-game-id="${gameId}"]`);
    
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Joining...';
    }
    if (countryInput) {
      countryInput.disabled = true;
    }

    try {
      const response = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          // userId is now extracted from JWT token on backend
          name: null,
          colorHex: null,
          countryName: countryName.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join game');
      }

      // Successfully joined - show success message and refresh the games list
      alert(`Successfully joined game! You can now see it in your "Games Playing" list.`);
      
      // Refresh the available games list (this game should no longer appear)
      this.loadGames();
      
      // Optionally, you could emit an event to refresh the "Games Playing" list
      // but we'll let the user navigate there manually

    } catch (error) {
      console.error('Error joining game:', error);
      alert(`Failed to join game: ${error.message}`);
      
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'JOIN';
      }
      if (countryInput) {
        countryInput.disabled = false;
        countryInput.focus();
      }
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

