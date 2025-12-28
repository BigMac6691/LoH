/**
 * GamesAvailableList - List of games available for the current user to join
 */
import { MenuView } from './MenuView.js';
import { Utils } from '../utils/Utils.js';
import { eventBus } from '../eventBus.js';
import { ApiRequest } from '../events/Events.js';

export class GamesAvailableList extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.games = [];
      this.abortControl = null;

      this.registerEventHandler('system:gamesAvailableResponse', this.handleGamesAvailableResponse.bind(this));
      this.registerEventHandler('system:joinGameResponse', this.handleJoinGameResponse.bind(this));
   }

   create()
   {
      this.container = document.createElement('div');
      this.container.className = 'games-available-list';
      this.container.innerHTML = `
      <div class="view-header">
        <h2>Games Available</h2>
      </div>
      <div class="view-content">
        <fieldset>
          <div class="games-list-container">
            <div class="games-loading">Loading games...</div>
          </div>
        </fieldset>
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

      eventBus.emit('system:gamesAvailableRequest', new ApiRequest('system:gamesAvailableRequest', null, this.abortControl.signal));
   }

   /**
    * Handle games available response
    * @param {ApiResponse} event - Games available response event
    */
   handleGamesAvailableResponse(event)
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
         listContainer.innerHTML = '<div class="games-empty">No available games found. Create a new game to get started!</div>';
         return;
      }

      listContainer.innerHTML = this.games.map(game => gameHTML(game)).join('');
      
      // Add click handlers for JOIN buttons
      listContainer.querySelectorAll('.join-btn').forEach(btn =>
      {
         btn.addEventListener('click', (e) =>
         {
            const gameId = e.target.getAttribute('data-game-id');
            const countryInput = listContainer.querySelector(`.country-name-input[data-game-id="${gameId}"]`);
            const countryName = countryInput ? countryInput.value.trim() : '';

            this.joinGame(gameId, countryName);

            if (countryInput) 
              countryInput.focus();
         });
      });

      // Allow Enter key to trigger join
      listContainer.querySelectorAll('.country-name-input').forEach(input =>
      {
         input.addEventListener('keypress', (e) =>
         {
            if (e.key === 'Enter')
            {
               const gameId = input.getAttribute('data-game-id');
               const countryName = input.value.trim() || null;

               this.joinGame(gameId, countryName);

               input.focus();
            }
         });
      });
   }

   /**
    * Handle JOIN button click - join the game then load it
    */
   joinGame(gameId, countryName)
   {
      if (!gameId) 
        return;

      if (!countryName || !countryName.trim())
         return this.displayStatusMessage('Please enter a country name', 'warning'); // void function call

      // Abort any pending join request
      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      Utils.requireChild(this.container, 'fieldset').disabled = true;
      this.displayStatusMessage('Joining game...', 'info');
      
      eventBus.emit('system:joinGameRequest', new ApiRequest('system:joinGameRequest', {gameId, countryName: countryName.trim()}, this.abortControl.signal));
   }

   /**
    * Handle join game response
    * @param {ApiResponse} event - Join game response event
    */
   handleJoinGameResponse(event)
   {
      console.log('🔐 GamesAvailableList: Handling join game response', event);

      Utils.requireChild(this.container, 'fieldset').disabled = false;

      if (event.isSuccess())
      {
         this.displayStatusMessage(`Successfully joined game! You can now see it in your "Games Playing" list.`, 'success');
         this.loadGames();
      }
      else if (event.isAborted())
         this.displayStatusMessage('Join game aborted.', 'error');
      else
      {
         console.error('Error joining game:', event);
         this.displayStatusMessage(`Failed to join game: ${event.error?.message || event.data?.message || 'Unknown error'}`, 'error');
      }

      this.abortControl = null;
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

const gameHTML = (game) => `
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
`;