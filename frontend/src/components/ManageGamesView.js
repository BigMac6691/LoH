/**
 * ManageGamesView - Manage games interface (sponsor/admin/owner only)
 * @description This view allows the sponsor/admin/owner to manage games, players, and AI players.
 * Game status of lobby means the game is in the setup phase waiting for all players to be added.
 * Game status of running means the game is in progress and players can play.
 * Game status of paused means the game is paused and players can view the game but not play.
 * Game status of frozen means the game is frozen and players cannot load the game.
 * Game status of finished means the game is finished and players can view the game but not play.
 * Player status of active means the player is active and can play.
 * Player status of waiting means the player is waiting for all other players to finish their turns.
 * Player status of suspended means the player is suspended and cannot play for a period of time.
 * Player status of ejected means the player is ejected and cannot play in that game anymore.
 */
import { AIConfigFormBuilder } from './AIConfigFormBuilder.js';
import { eventBus } from '../eventBus.js';
import { MenuView } from './MenuView.js';
import { Utils } from '../utils/Utils.js';
import { ApiRequest } from '../events/Events.js';
import { Dialog } from './Dialog.js';

export class ManageGamesView extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.selectedGame = null;
      this.selectedPlayer = null;
      this.games = [];
      this.players = [];
      this.currentPage = 1;
      this.totalPages = 1;
      this.userRole = localStorage.getItem('user_role');
      this.abortControl = null;
      this.pendingGameReselectId = null;
      this.pendingAIDialogElement = null;
      this.dialog = null;

      // Register event handlers
      this.registerEventHandler('system:listGamesResponse', this.handleListGamesResponse.bind(this));
      this.registerEventHandler('system:manageGamePlayersResponse', this.handleManageGamePlayersResponse.bind(this));
      this.registerEventHandler('system:updateGameStatusResponse', this.handleUpdateGameStatusResponse.bind(this));
      this.registerEventHandler('system:endPlayerTurnResponse', this.handleEndPlayerTurnResponse.bind(this));
      this.registerEventHandler('system:updatePlayerStatusResponse', this.handleUpdatePlayerStatusResponse.bind(this));
      this.registerEventHandler('system:updatePlayerMetaResponse', this.handleUpdatePlayerMetaResponse.bind(this));
      this.registerEventHandler('system:aiListResponse', this.handleAIListResponse.bind(this));
      this.registerEventHandler('system:addAIPlayerResponse', this.handleAddAIPlayerResponse.bind(this));
   }

   create()
   {
      this.container = document.createElement('div');
      this.container.className = 'manage-games-view';
      this.container.innerHTML = manageGamesHTML;

      this.setupEventListeners();
      this.loadGames();

      return this.container;
   }

   setupEventListeners()
   {
      // Pagination
      Utils.requireChild(this.container, '#prev-page-btn').addEventListener('click', () => this.changePage(-1));
      Utils.requireChild(this.container, '#next-page-btn').addEventListener('click', () => this.changePage(1));

      // Game control buttons
      Utils.requireChild(this.container, '#start-game-btn').addEventListener('click', () => this.startGame());
      Utils.requireChild(this.container, '#pause-unpause-btn').addEventListener('click', () => this.pauseUnpauseGame());
      Utils.requireChild(this.container, '#freeze-unfreeze-btn').addEventListener('click', () => this.freezeUnfreezeGame());
      Utils.requireChild(this.container, '#finish-game-btn').addEventListener('click', () => this.finishGame());
      Utils.requireChild(this.container, '#add-ai-player-btn').addEventListener('click', () => this.showAddAIPlayerDialog());

      // Player control buttons
      Utils.requireChild(this.container, '#end-turn-btn').addEventListener('click', () => this.endPlayerTurn());
      Utils.requireChild(this.container, '#reset-status-btn').addEventListener('click', () => this.resetPlayerStatus());
      Utils.requireChild(this.container, '#suspend-btn').addEventListener('click', () => this.suspendPlayer());
      Utils.requireChild(this.container, '#eject-btn').addEventListener('click', () => this.ejectPlayer());
      Utils.requireChild(this.container, '#edit-meta-btn').addEventListener('click', () => this.showEditMetaDialog());
   }

   loadGames(page = 1)
   {
      console.log('🔐 ManageGamesView: Loading games for page', page);
      const listContainer = Utils.requireChild(this.container, '.games-list-container');
      listContainer.innerHTML = '<div class="games-loading">Loading games...</div>';

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Loading games...', 'info');

      eventBus.emit('system:listGamesRequest', new ApiRequest('system:listGamesRequest', {filter: 'manage', context: 'ManageGamesView', page, limit: 5}, this.abortControl.signal));
   }

   /**
    * Handle list games response
    * @param {ApiResponse} event - List games response event
    */
   handleListGamesResponse(event)
   {
      // Only process responses for this component
      if (event.data?.context !== 'ManageGamesView')
         return;

      if (event.isSuccess() && event.data)
      {
         this.games = event.data.games || [];
         this.currentPage = event.data.pagination?.page || 1;
         this.totalPages = event.data.pagination?.totalPages || 1;

         this.displayStatusMessage(`Loaded ${this.games.length} games`, 'success');
         this.renderGames();
         this.updatePaginationControls();

         // Re-select game if pending (e.g., after status update)
         if (this.pendingGameReselectId)
         {
            const gameId = this.pendingGameReselectId;
            this.pendingGameReselectId = null;
            this.selectGame(gameId);
            this.updateGameControlButtons(); // select above also updates the control buttons if there is a selected game

            if (this.selectedPlayer) // Update player control buttons in case a player is selected
               this.updatePlayerControlButtons();
         }
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
         listContainer.innerHTML = '<div class="games-empty">No games found.</div>';
         return;
      }

      listContainer.innerHTML = this.games.map(game => gameCardHTML(game, this.selectedGame?.id === game.id)).join('');

      // Add click handlers
      listContainer.querySelectorAll('.game-card').forEach(card => card.addEventListener('click', () => this.selectGame(card.getAttribute('data-game-id'))));
   }

   selectGame(gameId)
   {
      console.log('🔐 ManageGamesView: Selecting game', gameId);
      this.selectedGame = this.games.find(game => game.id === gameId);

      // Update UI
      this.container.querySelectorAll('.game-card').forEach(card => card.getAttribute('data-game-id') === gameId ? card.classList.add('selected') : card.classList.remove('selected'));
      this.updateGameControlButtons();
      this.loadPlayers(gameId);
      this.selectedPlayer = null;
      this.updatePlayerControlButtons();
   }

   updateGameControlButtons()
   {
      const startBtn = this.container.querySelector('#start-game-btn');
      const pauseBtn = this.container.querySelector('#pause-unpause-btn');
      const freezeBtn = this.container.querySelector('#freeze-unfreeze-btn');
      const finishBtn = this.container.querySelector('#finish-game-btn');
      const addAIBtn = this.container.querySelector('#add-ai-player-btn');

      if (!this.selectedGame)
      {
         // No game selected - show default text and disable all buttons
         startBtn.disabled = true;
         pauseBtn.disabled = true;
         pauseBtn.textContent = 'Pause';
         freezeBtn.disabled = true;
         freezeBtn.textContent = 'Freeze';
         finishBtn.disabled = true;
         addAIBtn.disabled = true;

         return;
      }

      const status = this.selectedGame.status;
      const playerCount = this.selectedGame.player_count || 0;
      const maxPlayers = this.selectedGame.max_players || 6;
      const allPlayersAdded = playerCount >= maxPlayers;

      // If status is 'lobby', disable all buttons except Start and Add AI Player
      if (status === 'lobby')
      {
         // Start: only enabled when all players have been added
         startBtn.disabled = !allPlayersAdded;

         // All other buttons disabled in lobby
         pauseBtn.disabled = true;
         pauseBtn.textContent = 'Pause';
         freezeBtn.disabled = true;
         freezeBtn.textContent = 'Freeze';
         finishBtn.disabled = true;

         // Add AI Player: enabled in lobby if not at max players
         addAIBtn.disabled = allPlayersAdded;

         return;
      }

      // For non-lobby statuses, normal behavior
      // Start: disabled (only available in lobby)
      startBtn.disabled = true;

      // Pause/Unpause: only if status is 'running' or 'paused'
      pauseBtn.disabled = status !== 'running' && status !== 'paused';
      pauseBtn.textContent = status === 'paused' ? 'Unpause' : 'Pause';

      // Freeze/Unfreeze: can change from any status except 'finished'
      freezeBtn.disabled = status === 'finished';
      freezeBtn.textContent = status === 'frozen' ? 'Unfreeze' : 'Freeze';

      // Finish: can change from any status except 'finished'
      finishBtn.disabled = status === 'finished';

      // Add AI Player: disabled when not in lobby
      addAIBtn.disabled = true;
   }

   loadPlayers(gameId)
   {
      console.log('🔐 ManageGamesView: Loading players for game', gameId);
      Utils.requireChild(this.container, '.players-list-container').innerHTML = '<div class="players-loading">Loading players...</div>';

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Loading players...', 'info');

      eventBus.emit('system:manageGamePlayersRequest', new ApiRequest('system:manageGamePlayersRequest', {gameId}, this.abortControl.signal));
   }

   /**
    * Handle manage game players response
    * @param {ApiResponse} event - Manage game players response event
    */
   handleManageGamePlayersResponse(event)
   {
      console.log('🔐 ManageGamesView: Handling manage game players response', event);

      const playersContainer = Utils.requireChild(this.container, '.players-list-container');

      if (event.isSuccess() && event.data)
      {
         this.players = event.data.players || [];
         this.displayStatusMessage(`Loaded ${this.players.length} players`, 'success');
         this.renderPlayers();
         this.updateGameControlButtons();
      }
      else if (event.isAborted())
      {
         this.displayStatusMessage('Players loading aborted.', 'error');
         playersContainer.innerHTML = '<div class="players-placeholder">Select a game to view players</div>';
      }
      else
         playersContainer.innerHTML = `<div class="players-error">Error: ${Utils.escapeHtml(event.error?.message || event.data?.message || 'Failed to load players')}</div>`;

      this.abortControl = null;
   }

   renderPlayers()
   {
      const playersContainer = Utils.requireChild(this.container, '.players-list-container');

      if (this.players.length === 0)
      {
         playersContainer.innerHTML = '<div class="players-empty">No players in this game.</div>';
         return;
      }

      playersContainer.innerHTML = this.players.map(player => playerCardHTML(player, this.selectedPlayer?.id === player.id)).join('');
      playersContainer.querySelectorAll('.player-card').forEach(card => card.addEventListener('click', () => this.selectPlayer(card.getAttribute('data-player-id'))));
   }

   selectPlayer(playerId)
   {
      this.selectedPlayer = this.players.find(player => player.id === playerId);

      if (!this.selectedPlayer) 
        return;

      // Update UI
      this.container.querySelectorAll('.player-card').forEach(card => card.getAttribute('data-player-id') === playerId ? card.classList.add('selected') : card.classList.remove('selected'));
      this.updatePlayerControlButtons();
   }

   updatePlayerControlButtons()
   {
      if (!this.selectedPlayer)
      {
         Utils.requireChildren(this.container, '.player-controls .control-btn').forEach(btn => btn.disabled = true);
         return;
      }

      const playerStatus = this.selectedPlayer.status;
      const isActive = playerStatus === 'active';
      const isEjected = playerStatus === 'ejected';
      const isSuspended = playerStatus === 'suspended';

      const gameStatus = this.selectedGame.status;
      const isLobby = gameStatus === 'lobby';
      const isRunning = gameStatus === 'running';

      // End Turn: Only enabled when game is running and player is not ejected
      Utils.requireChild(this.container, '#end-turn-btn').disabled = !isRunning || isEjected;

      // Reset Status: Disabled if game is lobby or player is ejected or active
      Utils.requireChild(this.container, '#reset-status-btn').disabled = isLobby || isEjected || isActive;

      // Suspend: Disabled if game is lobby or player is ejected or suspended
      Utils.requireChild(this.container, '#suspend-btn').disabled = isLobby || isEjected || isSuspended;

      // Eject: Always enabled unless player is already ejected
      Utils.requireChild(this.container, '#eject-btn').disabled = isEjected;

      // Edit Meta: Disabled if player is ejected
      Utils.requireChild(this.container, '#edit-meta-btn').disabled = isEjected;
   }

   /**
    * Game control actions
    */
   startGame()
   {
      if (!this.selectedGame || this.selectedGame.status !== 'lobby') 
        return;

      // Store the gameId we're creating (generating map/placing players) for the response handler
      this.pendingCreateGameId = this.selectedGame.id;

      // Disable the start button to prevent multiple clicks
      const startBtn = this.container.querySelector('#start-game-btn');
      if (startBtn)
      {
         startBtn.disabled = true;
         startBtn.textContent = 'Creating Game...';
      }

      // Emit event to create the game (generate map, place players) via GameEventHandler
      eventBus.emit('game:createGame',
      {
         gameId: this.selectedGame.id
      });
   }

   /**
    * Handle game created event (response from GameEventHandler after map generation and player placement)
    * @param {Object} context - Event bus context
    * @param {Object} eventData - Event data with success status and details
    */
   handleGameCreated(context, eventData)
   {
      // Only handle if this is for the game we're creating
      if (!this.pendingCreateGameId) 
        return;

      // Check if this event is for our game (either by gameId in details or if it's a general success)
      const eventGameId = eventData.details?.gameId;
      if (eventGameId && eventGameId !== this.pendingCreateGameId)
      {
         // This event is for a different game, ignore it
         return;
      }

      if (eventData.success)
      {
         // Game created successfully (map generated, players placed), update the UI
         const gameId = this.pendingCreateGameId;
         this.pendingCreateGameId = null;

         // Update game status to 'running' via event
         this.updateGameStatus('running');
      }
      else
      {
         // Game creation failed
         this.pendingCreateGameId = null;

         // Re-enable the start button
         const startBtn = this.container.querySelector('#start-game-btn');
         if (startBtn)
         {
            startBtn.disabled = false;
            startBtn.textContent = 'Start';
         }

         // Show error message
         this.displayStatusMessage(`Error creating game: ${eventData.message || eventData.error || 'Failed to create game'}`, 'error');
      }
   }

   pauseUnpauseGame()
   {
      if (!this.selectedGame || !(this.selectedGame.status === 'running' || this.selectedGame.status === 'paused')) 
        return;

      this.updateGameStatus(this.selectedGame.status === 'paused' ? 'running' : 'paused');
   }

   freezeUnfreezeGame()
   {
      if (!this.selectedGame || !(this.selectedGame.status === 'running' || this.selectedGame.status === 'paused' || this.selectedGame.status === 'frozen')) 
        return;

      this.updateGameStatus(this.selectedGame.status === 'frozen' ? 'running' : 'frozen');
   }

   finishGame()
   {
      if (!this.selectedGame || this.selectedGame.status === 'finished') 
        return;

      if (!confirm('Are you sure you want to finish this game? This action cannot be undone.'))
        return;

      this.updateGameStatus('finished');
   }

   updateGameStatus(newStatus)
   {
      if (!this.selectedGame) 
         return;

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Updating game status...' + newStatus, 'info');

      eventBus.emit('system:updateGameStatusRequest', new ApiRequest('system:updateGameStatusRequest', {gameId: this.selectedGame.id, status: newStatus}, this.abortControl.signal));
   }

   /**
    * Handle update game status response
    * @param {ApiResponse} event - Update game status response event
    */
   handleUpdateGameStatusResponse(event)
   {
      console.log('🔐 ManageGamesView: Handling update game status response', event);

      if (event.isSuccess())
      {
         const updatedGame = event.data?.game;
         const gameId = updatedGame?.id;
         const newStatus = updatedGame?.status;
         
         if (!gameId || !newStatus)
         {
            this.displayStatusMessage('Invalid response: missing game ID or status', 'error');
            this.abortControl = null;
            return;
         }

         // Find and update the game in the games array
         const gameIndex = this.games.findIndex(game => game.id === gameId);
         if (gameIndex !== -1)
         {
            this.games[gameIndex].status = newStatus;
            this.updateGameControlButtons();
            this.renderGames();
            this.displayStatusMessage(`Game status updated to ${newStatus}`, 'success');
         }
         else
            this.displayStatusMessage('Game not found in list of loaded games', 'error');
      }
      else if (event.isAborted())
         this.displayStatusMessage('Update game status aborted.', 'error');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to update game status', 'error');

      this.abortControl = null;
   }

   /**
    * Player control actions
    */
   endPlayerTurn()
   {
      if (!this.selectedGame || !this.selectedPlayer) 
        return;

      if (this.selectedPlayer.status === 'ejected')
      {
         this.displayStatusMessage('Player is ejected and cannot end turn', 'error');
         return;
      }

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Ending player turn...', 'info');

      eventBus.emit('system:endPlayerTurnRequest', new ApiRequest('system:endPlayerTurnRequest', {gameId: this.selectedGame.id, playerId: this.selectedPlayer.id}, this.abortControl.signal));
   }

   /**
    * Handle end player turn response
    * @param {ApiResponse} event - End player turn response event
    */
   handleEndPlayerTurnResponse(event)
   {
      if (event.isSuccess())
      {
         this.displayStatusMessage('Player turn ended successfully', 'success');
         this.loadPlayers(this.selectedGame.id);
      }
      else if (event.isAborted())
         this.displayStatusMessage('End player turn aborted.', 'error');
      else
      {
         console.error('Error ending player turn:', event);
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to end player turn', 'error');
      }

      this.abortControl = null;
   }

   resetPlayerStatus()
   {
      if (!this.selectedGame || !this.selectedPlayer || this.selectedPlayer.status === 'ejected') 
        return;

      this.updatePlayerStatus('active');
   }

   suspendPlayer()
   {
      if (!this.selectedGame || !this.selectedPlayer || this.selectedPlayer.status === 'ejected') 
        return;

      this.updatePlayerStatus('suspended');
   }

   ejectPlayer()
   {
      if (!this.selectedGame || !this.selectedPlayer || this.selectedPlayer.status === 'ejected') 
        return;

      if (!confirm('Are you sure you want to eject this player? This action cannot be undone.'))
         return;

      this.updatePlayerStatus('ejected');
   }

   /**
    * Update player status
    */
   updatePlayerStatus(newStatus)
   {
      if (!this.selectedGame || !this.selectedPlayer) return;

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Updating player status...', 'info');

      eventBus.emit('system:updatePlayerStatusRequest', new ApiRequest('system:updatePlayerStatusRequest', {gameId: this.selectedGame.id, playerId: this.selectedPlayer.id, status: newStatus}, this.abortControl.signal));
   }

   /**
    * Handle update player status response
    * @param {ApiResponse} event - Update player status response event
    */
   handleUpdatePlayerStatusResponse(event)
   {
      if (event.isSuccess())
      {
         // Update selected player status
         if (this.selectedPlayer)
            this.selectedPlayer.status = event.data?.status || this.selectedPlayer.status;
         
         this.updatePlayerControlButtons();
         this.renderPlayers(); // Re-render to update status badge

         this.displayStatusMessage(`Player status updated to ${event.data?.status || 'success'}`, 'success');
      }
      else if (event.isAborted())
         this.displayStatusMessage('Update player status aborted.', 'error');
      else
      {
         console.error('Error updating player status:', event);
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to update player status', 'error');
      }

      this.abortControl = null;
   }

   /**
    * Show Add AI Player dialog
    */
   showAddAIPlayerDialog()
   {
      if (!this.selectedGame) return;

      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      this.displayStatusMessage('Loading AI list...', 'info');

      // Store dialog state for response handler
      this.pendingAIDialog = true;

      eventBus.emit('system:aiListRequest', new ApiRequest('system:aiListRequest', null, this.abortControl.signal));
   }

   /**
    * Handle AI list response
    * @param {ApiResponse} event - AI list response event
    */
   handleAIListResponse(event)
   {
      this.pendingAIDialog = false;
      this.abortControl = null;

      if (!event.isSuccess() || !event.data)
         return this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to load available AIs', 'error'); // void function call

      const availableAIs = event.data.success && event.data.ais ? event.data.ais : [];

      if (availableAIs.length === 0)
         return this.displayStatusMessage('No AI implementations are available.', 'warning'); // void function call

      this.createAIPlayerDialog(availableAIs);
   }

   /**
    * Create and show the AI player dialog
    * @param {Array} availableAIs - Array of available AI objects
    */
   createAIPlayerDialog(availableAIs)
   {

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

      dialog.innerHTML = addAIPlayerDialogHTML;

      document.body.appendChild(dialog);

      // Populate AI select
      const aiSelect = dialog.querySelector('#ai-select');
      availableAIs.forEach(ai =>
      {
         const option = document.createElement('option');
         option.value = ai.name;
         option.textContent = ai.name;
         aiSelect.appendChild(option);
      });

      const aiDescription = dialog.querySelector('#ai-description');
      const aiConfigContainer = dialog.querySelector('#ai-config-container');
      const playerNameInput = dialog.querySelector('#player-name-input');
      const countryNameInput = dialog.querySelector('#country-name-input');
      const addBtn = dialog.querySelector('.add-ai-player-btn');
      const errorDiv = dialog.querySelector('#ai-dialog-error');
      const formBuilder = new AIConfigFormBuilder();
      let currentForm = null;
      let selectedAI = null;

      // AI selection handler
      aiSelect.addEventListener('change', async (e) =>
      {
         const aiName = e.target.value;
         if (!aiName)
         {
            aiDescription.style.display = 'none';
            aiConfigContainer.style.display = 'none';
            addBtn.disabled = true;
            selectedAI = null;
            return;
         }

         selectedAI = availableAIs.find(ai => ai.name === aiName);
         if (!selectedAI) 
          return;

         // Show description
         if (selectedAI.description)
         {
            aiDescription.textContent = selectedAI.description;
            aiDescription.style.display = 'block';
         }
         else
            aiDescription.style.display = 'none';

         // Build config form
         if (selectedAI.schema && Object.keys(selectedAI.schema).length > 0)
         {
            currentForm = formBuilder.buildForm(selectedAI.schema, {}, aiConfigContainer); //build form from AI schema
            aiConfigContainer.style.display = 'block';
         }
         else
         {
            aiConfigContainer.innerHTML = '<p style="color: #888; font-size: 13px;">This AI has no configurable options.</p>';
            aiConfigContainer.style.display = 'block';
            currentForm = 
            {
               getData: () => ({}), //return empty object
               validate: () => []
            };
         }

         // Enable add button if required fields are filled
         updateAddButtonState();
      });

      playerNameInput.addEventListener('input', () => { updateAddButtonState(); });
      countryNameInput.addEventListener('input', () => { updateAddButtonState(); });

      // Update add button state
      function updateAddButtonState()
      {
         const hasPlayerName = playerNameInput.value.trim().length > 0;
         const hasCountryName = countryNameInput.value.trim().length > 0;
         const hasAI = selectedAI !== null;
         addBtn.disabled = !(hasPlayerName && hasCountryName && hasAI);
      }

      // Add AI player handler
      addBtn.addEventListener('click', () =>
      {
         if (addBtn.disabled) 
          return;

         const playerName = playerNameInput.value.trim();
         const countryName = countryNameInput.value.trim();

         if (!playerName)
          return this.displayStatusMessage('Player name is required', 'error'); //void function call

         if (!countryName)
          return this.displayStatusMessage('Country name is required', 'error'); //void function call

         if (!selectedAI)
          return this.displayStatusMessage('Please select an AI', 'error');

         // Validate form
         if (currentForm)
         {
            const errors = currentForm.validate();
            if (errors.length > 0)
              return this.displayStatusMessage(errors.join(', '), 'error'); //void function call
         }

         // Get AI config
         const aiConfig = currentForm?.getData() || {};

         // Disable button during request
         addBtn.disabled = true;
         addBtn.textContent = 'Adding...';

         // Store dialog reference for cleanup
         this.pendingAIDialogElement = dialog;

         if (this.abortControl)
            this.abortControl.abort();

         this.abortControl = new AbortController();

         this.displayStatusMessage('Adding AI player...', 'info');

         eventBus.emit('system:addAIPlayerRequest', new ApiRequest('system:addAIPlayerRequest', {
            gameId: this.selectedGame.id,
            aiName: selectedAI.name,
            playerName,
            countryName,
            aiConfig
         }, this.abortControl.signal));
      });

      // Close button handler
      const closeBtn = dialog.querySelector('.close-dialog-btn');
      closeBtn.addEventListener('click', () => {document.body.removeChild(dialog);});

      // Close on outside click
      dialog.addEventListener('click', (e) => {if (e.target === dialog) document.body.removeChild(dialog);});

      // Close on Escape key
      const escapeHandler = (e) =>
      {
         if (e.key === 'Escape')
         {
            document.body.removeChild(dialog);
            document.removeEventListener('keydown', escapeHandler);
         }
      };
      document.addEventListener('keydown', escapeHandler);
   }

   /**
    * Show Edit Meta dialog
    */
   showEditMetaDialog()
   {
      if (!this.selectedGame || !this.selectedPlayer) 
         return;

      if (this.dialog)
         throw new Error('ManageGamesView: Edit meta dialog is already open');

      const meta = this.selectedPlayer.meta;
      const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta || {}, null, 2);

      this.dialog = new Dialog(
      {
         title: 'Edit Player Meta',
         contentHTML: editMetaDialogHTML(metaStr),
         className: 'edit-meta-dialog',
         buttonText: 'Save Meta',
         onClose: () => { this.handleDialogClose(); }
      });

      this.statusComponent.mount(Utils.requireChild(this.dialog.getDialog(), '#meta-mount-point'));

      Utils.requireChild(this.dialog.getDialog(), '.save-dialog-btn').addEventListener('click', (e) =>
      {
         e.preventDefault();

         const metaInput = Utils.requireChild(this.dialog.getDialog(), '#player-meta-input');
         const metaStr = metaInput.value.trim();

         // Validate JSON
         let metaData;
         try
         {
            metaData = JSON.parse(metaStr);
         }
         catch (e)
         {
            this.displayStatusMessage('Error: Meta must be valid JSON', 'error');
            return;
         }

         if (this.abortControl)
            this.abortControl.abort();

         this.abortControl = new AbortController();

         this.displayStatusMessage('Updating player meta...', 'info');
         this.dialog.setDisabled(true);

         eventBus.emit('system:updatePlayerMetaRequest', new ApiRequest('system:updatePlayerMetaRequest', {
            gameId: this.selectedGame.id,
            playerId: this.selectedPlayer.id,
            meta: metaData
         }, this.abortControl.signal));
      });

      Utils.requireChild(this.dialog.getDialog(), '.cancel-dialog-btn').addEventListener('click', () => { this.abort('User cancelled meta edit.'); });

      this.dialog.show();
   }

   /**
    * Abort current operation and close dialog
    */
   abort(message)
   {
      this.abortControl?.abort(message);
      if (this.dialog)
         this.dialog.close();
   }

   /**
    * Handle dialog close
    */
   handleDialogClose()
   {
      this.dialog = null;

      if (this.abortControl && !this.abortControl.signal.aborted)
         this.abortControl.abort('Dialog closing... aborting ongoing requests');

      this.abortControl = null;

      this.statusComponent.mount(Utils.requireElement('.home-main-content'));
   }

   /**
    * Handle update player meta response
    * @param {ApiResponse} event - Update player meta response event
    */
   handleUpdatePlayerMetaResponse(event)
   {
      if (this.dialog)
         this.dialog.setDisabled(false);

      if (event.isSuccess())
      {
         // Update selected player meta
         if (this.selectedPlayer && event.data?.meta !== undefined)
            this.selectedPlayer.meta = event.data.meta;
         
         this.renderPlayers(); // Re-render to update meta preview

         if (this.dialog)
            this.dialog.close();

         this.displayStatusMessage('Player meta updated successfully', 'success');
      }
      else if (event.isAborted())
      {
         this.displayStatusMessage('Update player meta aborted.', 'error');
         if (this.dialog)
            this.dialog.close();
      }
      else
      {
         console.error('Error updating player meta:', event);
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to update player meta', 'error');
      }

      this.abortControl = null;
   }

   /**
    * Handle add AI player response
    * @param {ApiResponse} event - Add AI player response event
    */
   handleAddAIPlayerResponse(event)
   {
      const dialog = this.pendingAIDialogElement;
      const addBtn = dialog?.querySelector('.add-ai-player-btn');

      if (event.isSuccess())
      {
         // Close dialog
         if (dialog && dialog.parentNode)
            document.body.removeChild(dialog);

         this.pendingAIDialogElement = null;

         // Reload games and players
         this.loadGames(this.currentPage);

         if (this.selectedGame)
            this.selectGame(this.selectedGame.id);

         this.displayStatusMessage('AI player added successfully', 'success');
      }
      else if (event.isAborted())
      {
         if (addBtn)
         {
            addBtn.disabled = false;
            addBtn.textContent = 'Add AI Player';
         }
         this.displayStatusMessage('Add AI player aborted.', 'error');
      }
      else
      {
         console.error('Error adding AI player:', event);
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to add AI player', 'error');
         if (addBtn)
         {
            addBtn.disabled = false;
            addBtn.textContent = 'Add AI Player';
         }
      }

      this.abortControl = null;
   }

   changePage(delta)
   {
      console.log('🔐 ManageGamesView: Changing page to', this.currentPage, 'with delta', delta);
      const newPage = this.currentPage + delta;

      if (newPage >= 1 && newPage <= this.totalPages)
      {
        this.selectedGame = null;
        this.selectedPlayer = null;
        this.players = [];

        this.updateGameControlButtons();
        this.updatePlayerControlButtons();
        this.renderPlayers();
        this.loadGames(newPage);
      }
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

   getContainer()
   {
      if (!this.container)
         this.create();

      return this.container;
   }

   dispose()
   {
      // Abort any pending requests
      if (this.abortControl)
         this.abortControl.abort();

      // Remove event bus listeners
      eventBus.off('game:gameCreated', this.handleGameCreated);

      this.unregisterEventHandlers();

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
      this.selectedGame = null;
      this.selectedPlayer = null;
      this.games = [];
      this.players = [];
      this.pendingCreateGameId = null;
      this.abortControl = null;
      this.pendingAIDialogElement = null;
      this.dialog = null;
   }
}

const manageGamesHTML = `
<div class="view-header">
<h2>Manage Games</h2>
</div>
<div class="view-content">
<div class="manage-games-split-container">
  <!-- Left Panel: Games List -->
  <div class="manage-games-left-panel">
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
  </div>

  <!-- Right Panel: Management Controls -->
  <div class="manage-games-right-panel">
    <!-- Game Control Buttons -->
    <div class="manage-games-section manage-games-fixed-section">
      <h3>Game Controls</h3>
      <div class="game-controls">
        <button class="control-btn" id="start-game-btn" disabled>Start</button>
        <button class="control-btn" id="pause-unpause-btn" disabled>Pause</button>
        <button class="control-btn" id="freeze-unfreeze-btn" disabled>Freeze</button>
        <button class="control-btn" id="finish-game-btn" disabled>Finish</button>
        <button class="control-btn" id="add-ai-player-btn" disabled>Add AI Player</button>
      </div>
    </div>

    <!-- Player Control Buttons -->
    <div class="manage-games-section manage-games-fixed-section">
      <h3>Player Controls</h3>
      <div class="player-controls">
        <button class="control-btn" id="end-turn-btn" disabled>End Turn</button>
        <button class="control-btn" id="reset-status-btn" disabled>Reset Status</button>
        <button class="control-btn" id="suspend-btn" disabled>Suspend</button>
        <button class="control-btn" id="eject-btn" disabled>Eject</button>
        <button class="control-btn" id="edit-meta-btn" disabled>Edit Meta</button>
      </div>
    </div>

    <!-- Players List -->
    <div class="manage-games-section manage-games-scrollable-section">
      <h3>Players</h3>
      <div class="players-list-container">
        <div class="players-placeholder">Select a game to view players</div>
      </div>
    </div>
  </div>
</div>
</div>
`;

/**
 * HTML for the Add AI Player dialog
 */
const addAIPlayerDialogHTML = `
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
  <div class="player-name-group">
    <label for="player-name-input" style="display: block; margin-bottom: 8px; color: #00ff88;">Player Name:</label>
    <input type="text" id="player-name-input" class="player-name-input" placeholder="Enter unique player name" style="
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

/**
 * Generate HTML for a game card
 * @param {Object} game - Game object
 * @param {boolean} isSelected - Whether the game is selected
 * @returns {string} HTML string
 */
const gameCardHTML = (game, isSelected) => `
<div class="game-card ${isSelected ? 'selected' : ''}" data-game-id="${game.id}">
  <div class="game-card-header">
    <h4 class="game-title">${Utils.escapeHtml(game.title)}</h4>
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
      <span class="game-label">Players:</span>
      <span class="game-value">${game.player_count || 0} / ${game.max_players || 6}</span>
    </div>
  </div>
</div>
`;

/**
 * Generate HTML for a player card
 * @param {Object} player - Player object
 * @param {boolean} isSelected - Whether the player is selected
 * @returns {string} HTML string
 */
const playerCardHTML = (player, isSelected) =>
{
   const metaStr = typeof player.meta === 'string' ? player.meta : JSON.stringify(player.meta || {}, null, 2);
   return `
<div class="player-card ${isSelected ? 'selected' : ''}" data-player-id="${player.id}">
  <div class="player-card-header">
    <h4 class="player-name">${Utils.escapeHtml(player.name)}</h4>
    <span class="player-status-badge status-${player.status}">${player.status}</span>
  </div>
  <div class="player-card-body">
    <div class="player-info-row">
      <span class="player-label">Country:</span>
      <span class="player-value">${Utils.escapeHtml(player.country_name || 'N/A')}</span>
    </div>
    <div class="player-info-row">
      <span class="player-label">Status:</span>
      <span class="player-value">${Utils.escapeHtml(player.status || 'active')}</span>
    </div>
    <div class="player-info-row">
      <span class="player-label">Meta:</span>
      <span class="player-value meta-preview">${Utils.escapeHtml(metaStr.substring(0, 100))}${metaStr.length > 100 ? '...' : ''}</span>
    </div>
  </div>
</div>
`;
};

/**
 * HTML for the Edit Meta dialog
 * @param {string} initialMeta - Initial meta value as JSON string
 * @returns {string} HTML string
 */
const editMetaDialogHTML = (initialMeta) => 
`<fieldset>
  <div class="form-group" style="margin-bottom: 15px;">
    <label for="player-meta-input" style="display: block; margin-bottom: 5px; color: #00ff88;">Player Meta (JSON):</label>
    <textarea 
      id="player-meta-input" 
      class="meta-input" 
      placeholder="Enter valid JSON"
      rows="15"
      style="
        width: 100%;
        padding: 8px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid #00ff88;
        border-radius: 5px;
        color: white;
        font-size: 14px;
        font-family: monospace;
        box-sizing: border-box;
        resize: vertical;
      "
    >${Utils.escapeHtml(initialMeta || '{}')}</textarea>
    <small style="color: #888; font-size: 12px; display: block; margin-top: 5px;">Must be valid JSON format</small>
  </div>
</fieldset>
<div id="meta-mount-point"></div>
`;