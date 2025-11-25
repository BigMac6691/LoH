/**
 * GamesPlayingList - List of games the current user is playing
 */
import
{
   RB
}
from '../utils/RequestBuilder.js';
import
{
   MenuView
}
from './MenuView.js';
import
{
   eventBus
}
from '../eventBus.js';

export class GamesPlayingList extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.games = [];
   }

   /**
    * Create and return the games playing list container
    */
   create()
   {
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
      this.setupEventListeners();
      return this.container;
   }

   /**
    * Set up event listeners
    */
   setupEventListeners()
   {
      // Listen for game loaded event
      eventBus.on('game:gameLoaded', this.handleGameLoaded.bind(this));
   }

   /**
    * Load games from API
    */
   async loadGames()
   {
      const listContainer = this.container?.querySelector('.games-list-container');
      if (!listContainer) return;

      try
      {
         listContainer.innerHTML = '<div class="games-loading">Loading games...</div>';

         const data = await RB.fetchGet(`/api/games/playing`);

         this.games = data.games || [];
         this.renderGames();

      }
      catch (error)
      {
         console.error('Error loading games playing:', error);
         this.showError(error.message || 'Failed to load games');
      }
   }

   /**
    * Render games in the list
    */
   renderGames()
   {
      const listContainer = this.container?.querySelector('.games-list-container');
      if (!listContainer) return;

      if (this.games.length === 0)
      {
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
      listContainer.querySelectorAll('.play-btn').forEach(btn =>
      {
         btn.addEventListener('click', (e) =>
         {
            if (btn.disabled) return;
            const gameId = e.target.getAttribute('data-game-id');
            this.playGame(gameId);
         });
      });
   }

   /**
    * Handle PLAY button click - load the game
    */
   async playGame(gameId)
   {
      if (!gameId) return;

      // Post status message indicating game is being loaded
      this.displayStatusMessage('Loading game...', 'info');

      // Emit event to load game (main.js will handle UI switching, then emit game:loadGame)
      eventBus.emit('game:load',
      {
         gameId
      });
   }

   /**
    * Handle game loaded event
    * @param {Object} context - Current system context
    * @param {Object} data - Event data from game:gameLoaded event
    */
   handleGameLoaded(context, data)
   {
      if (data.success)
      {
         const gameId = data.details?.gameId;

         // Post status message indicating game has been loaded
         this.displayStatusMessage('Game loaded successfully', 'success');

         // Emit game:startGame event to start the game
         eventBus.emit('game:startGame',
         {
            gameId
         });
      }
      else
      {
         // Post error message if loading failed
         const errorMessage = data.message || 'Failed to load game';
         this.displayStatusMessage(`Error: ${errorMessage}`, 'error');
      }
   }

   /**
    * Show error message
    */
   showError(message)
   {
      const listContainer = this.container?.querySelector('.games-list-container');
      if (listContainer)
      {
         listContainer.innerHTML = `<div class="games-error">Error: ${this.escapeHtml(message)}</div>`;
      }
   }

   /**
    * Escape HTML to prevent XSS
    */
   escapeHtml(text)
   {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
   }

   /**
    * Get the container element
    */
   getContainer()
   {
      if (!this.container)
      {
         this.create();
      }
      return this.container;
   }

   /**
    * Refresh the games list
    */
   refresh()
   {
      this.loadGames();
   }

   /**
    * Clean up
    */
   dispose()
   {
      // Remove event listeners
      eventBus.off('game:gameLoaded', this.handleGameLoaded.bind(this));

      if (this.container && this.container.parentNode)
      {
         this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      this.games = [];
   }
}
