/**
 * GamesPlayingList - List of games the current user is playing
 */
import { MenuView } from './MenuView.js';
import { eventBus } from '../eventBus.js';
import { ApiEvent, ApiRequest } from '../events/Events.js';
import { Utils } from '../utils/Utils.js';

export class GamesPlayingList extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.games = [];
      this.abortControl = null;
      this.currentPage = 1;
      this.totalPages = 1;

      this.registerEventHandler('system:listGamesResponse', this.handleListGamesResponse.bind(this));
   }

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
        <div class="pagination-controls">
          <button class="pagination-btn" id="prev-page-btn" disabled>Previous</button>
          <span class="pagination-info" id="page-info">Page 1 of 1</span>
          <button class="pagination-btn" id="next-page-btn" disabled>Next</button>
        </div>
      </div>
      `;

      this.setupEventListeners();
      this.loadGames();

      return this.container;
   }

   setupEventListeners()
   {
      // Pagination
      Utils.requireChild(this.container, '#prev-page-btn').addEventListener('click', () => this.changePage(-1));
      Utils.requireChild(this.container, '#next-page-btn').addEventListener('click', () => this.changePage(1));
   }

   loadGames(page = 1)
   {
      Utils.requireChild(this.container, '.games-list-container').innerHTML = '<div class="games-loading">Loading games...</div>';

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Loading games...', 'info');

      eventBus.emit('system:listGamesRequest', new ApiRequest('system:listGamesRequest', {filter: 'playing', context: 'GamesPlayingList', page, limit: 5}, this.abortControl.signal));
   }

   /**
    * Handle list games response
    * @param {ApiResponse} event - List games response event
    */
   handleListGamesResponse(event)
   {
      // Only process responses for this component
      if (event.data?.context !== 'GamesPlayingList')
         return;

      if (event.isSuccess() && event.data)
      {
         this.games = event.data.games || [];
         this.currentPage = event.data.pagination?.page || 1;
         this.totalPages = event.data.pagination?.totalPages || 1;

         this.renderGames();
         this.updatePaginationControls();
      }
      else if (event.isAborted())
         this.displayStatusMessage('Games loading aborted.', 'error');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to load games', 'error');

      this.abortControl = null;
   }

   renderGames()
   {
      const listContainer = Utils.requireChild(this.container, '.games-list-container');

      if (this.games.length === 0)
      {
         listContainer.innerHTML = '<div class="games-empty">No games found. Join a game from the Available Games list!</div>';
         return;
      }

      listContainer.innerHTML = this.games.map(game => gameHTML(game)).join('');

      // Add click handlers for PLAY buttons
      listContainer.querySelectorAll('.play-btn').forEach(btn =>
      {
         btn.addEventListener('click', (e) =>
         {
            if (btn.disabled) 
               return;
            
            const gameId = e.target.getAttribute('data-game-id');
            this.playGame(gameId);
         });
      });
   }

   /**
    * Handle PLAY button click - load the game
    */
   playGame(gameId)
   {
      if (!gameId) 
         return;

      this.displayStatusMessage('Loading game...' + gameId, 'info');

      eventBus.emit('game:requestInitial', new ApiRequest('game:requestInitial', {gameId}));
   }

   getContainer()
   {
      if (!this.container)
         this.create();

      return this.container;
   }

   changePage(delta)
   {
      const newPage = this.currentPage + delta;

      if (newPage >= 1 && newPage <= this.totalPages)
         this.loadGames(newPage);
   }

   updatePaginationControls()
   {
      const prevBtn = this.container.querySelector('#prev-page-btn');
      const nextBtn = this.container.querySelector('#next-page-btn');
      const pageInfo = this.container.querySelector('#page-info');

      if (prevBtn) 
        prevBtn.disabled = this.currentPage <= 1;

      if (nextBtn) 
        nextBtn.disabled = this.currentPage >= this.totalPages;

      if (pageInfo) 
        pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
   }

   refresh()
   {
      this.loadGames(this.currentPage);
   }

   dispose()
   {
      // Abort any pending requests
      if (this.abortControl)
         this.abortControl.abort();

      this.unregisterEventHandlers();

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
      this.games = [];
      this.abortControl = null;
      this.currentPage = 1;
      this.totalPages = 1;
   }
}

const gameHTML = (game) => 
   `
      <div class="game-card">
        <div class="game-card-header">
          <h3 class="game-title">${Utils.escapeHtml(game.title)}</h3>
          <span class="game-status-badge status-${game.status}">${game.status}</span>
        </div>
        <div class="game-card-body">
          <div class="game-info-row">
            <span class="game-label">Description:</span>
            <span class="game-value">${Utils.escapeHtml(game.description || 'No description')}</span>
          </div>
          <div class="game-info-row">
            <span class="game-label">Sponsor:</span>
            <span class="game-value">${Utils.escapeHtml(game.owner_display_name || 'Unknown')}</span>
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
            <span class="game-value">${Utils.escapeHtml(game.player_status || 'active')}</span>
          </div>
        </div>
        <div class="game-card-footer">
          <button class="game-action-btn play-btn" data-game-id="${game.id}" ${game.status === 'lobby' || game.status === 'frozen' ? 'disabled' : ''}>
            PLAY
          </button>
        </div>
      </div>
    `