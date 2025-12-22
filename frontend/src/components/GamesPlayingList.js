/**
 * GamesPlayingList - List of games the current user is playing
 */
import { MenuView } from './MenuView.js';
import { eventBus } from '../eventBus.js';
import { ApiEvent, ApiRequest } from '../events/Events.js';
import { Utils } from '../utils/Utils.js';
import { webSocketManager } from '../services/WebSocketManager.js';
import { gameStateManager as GSM } from '../services/GameStateManager.js';

export class GamesPlayingList extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.games = [];
      this.abortControl = null;

      this.registerEventHandler('system:gamesPlayingResponse', this.handleGamesPlayingResponse.bind(this));
      this.registerEventHandler('game:gameLoaded', this.handleGameLoaded.bind(this));
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
      </div>
      `;

      this.loadGames();

      return this.container;
   }

   loadGames()
   {
      Utils.requireChild(this.container, '.games-list-container').innerHTML = '<div class="games-loading">Loading games...</div>';

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Loading games...', 'info');

      eventBus.emit('system:gamesPlayingRequest', new ApiRequest('system:gamesPlayingRequest', null, this.abortControl.signal));
   }

   /**
    * Handle games playing response
    * @param {ApiResponse} event - Games playing response event
    */
   handleGamesPlayingResponse(event)
   {
      if (event.isSuccess() && event.data)
      {
         this.games = event.data.games || [];
         this.renderGames();
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

      this.displayStatusMessage('Loading game...', 'info');

      eventBus.emit('game:loadGame', new ApiRequest('game:loadGame', {gameId}));
   }

   /**
    * Handle game loaded event
    * @param {Object} context - Current system context
    * @param {Object} event - Event data from game:gameLoaded event
    */
   handleGameLoaded(event)
   {
      console.log('🎮 GamesPlayingList: Game loaded event received:', event, GSM);

      if (event.isSuccess())
      {
         this.displayStatusMessage('Game loaded successfully', 'success');

         if (webSocketManager.isWebSocketConnected())
            webSocketManager.joinGame();
         else
            this.displayStatusMessage('WebSocket not connected... unable to get game state updates automatically.', 'warning');

         eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'game'}));
      }
      else
         this.displayStatusMessage(`Error: ${event.message || 'Failed to load game'}`, 'error');
   }

   getContainer()
   {
      if (!this.container)
         this.create();

      return this.container;
   }

   refresh()
   {
      this.loadGames();
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