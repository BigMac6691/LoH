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
import { ApiRequest, ApiEvent } from '../events/Events.js';
import { Dialog } from './Dialog.js';
import { PromptDialog } from './PromptDialog.js';

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
      this.isLoadingGames = false;
      this.targetPage = 1;
      this.userRole = localStorage.getItem('user_role');
      this.dialog = null; // we only allow one dialog at a time

      this.aiList = [];
      this.aiSelect = null;
      this.aiDescription = null;
      this.aiConfigContainer = null;
      this.aiAddBtn = null;
      this.selectedAI = null;
      this.currentAIConfigForm = null;
      this.aiFormBuilder = new AIConfigFormBuilder();

      // Register event handlers
      this.registerEventHandler('system:listGamesResponse', this.handleListGamesResponse.bind(this));
      this.registerEventHandler('system:listGamePlayersResponse', this.handleListGamePlayersResponse.bind(this));
      this.registerEventHandler('system:startGameResponse', this.handleStartGameResponse.bind(this));
      this.registerEventHandler('system:updateGameStatusResponse', this.handleUpdateGameStatusResponse.bind(this));
      this.registerEventHandler('system:substatusUpdated', this.handleSubstatusUpdated.bind(this));
      this.registerEventHandler('system:endPlayerTurnResponse', this.handleEndPlayerTurnResponse.bind(this));
      this.registerEventHandler('system:updatePlayerStatusResponse', this.handleUpdatePlayerStatusResponse.bind(this));
      this.registerEventHandler('system:updatePlayerMetaResponse', this.handleUpdatePlayerMetaResponse.bind(this));
      this.registerEventHandler('system:aiListResponse', this.handleAIListResponse.bind(this));
      this.registerEventHandler('system:addAIPlayerResponse', this.handleAddAIPlayerResponse.bind(this));

      const abortControl = this.requestManager.reset(`${this.constructor.name}:aiList`);

      eventBus.emit('system:aiListRequest', new ApiRequest('system:aiListRequest', null, abortControl.signal));
   }

   create()
   {
      this.container = document.createElement('div');
      this.container.className = 'manage-games-view';
      this.container.innerHTML = manageGamesHTML;

      this.setupEventListeners();
      this.loadGames(this.currentPage);

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
      console.log('🔐 ManageGamesView: Loading games', page);
      const message = `Loading page ${this.targetPage} of ${this.totalPages}...`;
      Utils.requireChild(this.container, '.games-list-container').innerHTML = `<div class="games-loading">${message}</div>`;
      this.displayStatusMessage(message, 'info');

      const abortContext = `${this.constructor.name}:loadGames`;
      const abortControl = this.requestManager.reset(abortContext);
      const request = new ApiRequest('system:listGamesRequest', {filter: 'manage', context: 'ManageGamesView', page, limit: 2}, abortControl.signal);
      
      this.requestManager.start(abortContext, request.transactionId);
      eventBus.emit('system:listGamesRequest', request);
   }

   /**
    * Handle list games response
    * @param {ApiResponse} event - List games response event
    */
   handleListGamesResponse(event)
   {
      if (event.data?.context !== 'ManageGamesView') // Only process responses for this component
         return;

      if (event.isSuccess() && event.data)
      {
         this.games = event.data.games || [];
         this.currentPage = event.data.pagination?.page || 1;
         this.totalPages = event.data.pagination?.totalPages || 1;

         this.displayStatusMessage(`Loaded ${this.games.length} games`, 'success');
      }
      else if (event.isAborted())
         this.displayStatusMessage('Games loading aborted.', 'warning');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to load games', 'error');

      const abortContext = `${this.constructor.name}:loadGames`;
      
      if(this.requestManager.isLatest(abortContext, event.transactionId))
      {
         this.isLoadingGames = false;
         this.targetPage = this.currentPage;

         this.updatePaginationControls();
         this.renderGames();
         this.updateGameControlButtons();
         this.renderPlayers();
         this.updatePlayerControlButtons();

         this.requestManager.complete(abortContext);
      }
      else
         console.warn('🔐 ManageGamesView: Request ID mismatch', abortContext, event.transactionId, this.requestManager.getLastTransactionId(abortContext));
   }

   renderGames()
   {
      console.error('🔐 ManageGamesView: Rendering games', this.games);
      const listContainer = Utils.requireChild(this.container, '.games-list-container');

      if (this.games.length === 0)
         listContainer.innerHTML = '<div class="games-empty">No games found.</div>';
      else
         listContainer.innerHTML = this.games.map(game => gameCardHTML(game, this.selectedGame?.id === game.id)).join('');

      // Add click handlers
      listContainer.querySelectorAll('.game-card').forEach(card => card.addEventListener('click', () => this.selectGame(card.getAttribute('data-game-id'))));
   }

   selectGame(gameId)
   {
      console.log('🔐 ManageGamesView: Selecting game', gameId);
      this.selectedGame = this.games.find(game => game.id === gameId);

      // Update selected game in UI
      this.container.querySelectorAll('.game-card')
         .forEach(card => card.getAttribute('data-game-id') === gameId ? card.classList.add('selected') : card.classList.remove('selected'));
      this.updateGameControlButtons();
      
      this.selectedPlayer = null;
      this.loadPlayers(gameId);
      this.updatePlayerControlButtons();
   }

   updateGameControlButtons()
   {
      this.container.querySelector('#start-game-btn').disabled = !this.canStartGame().allowed;
      this.container.querySelector('#finish-game-btn').disabled = !this.canFinishGame().allowed;
      this.container.querySelector('#add-ai-player-btn').disabled = !this.canAddAIPlayer().allowed;

      const pauseUnpause = this.canPauseUnpauseGame();
      const pauseBtn = this.container.querySelector('#pause-unpause-btn');
      pauseBtn.disabled = !pauseUnpause.allowed;
      pauseBtn.textContent = pauseUnpause.label;

      const freezeUnfreeze = this.canFreezeUnfreezeGame();
      const freezeBtn = this.container.querySelector('#freeze-unfreeze-btn');
      freezeBtn.disabled = !freezeUnfreeze.allowed;
      freezeBtn.textContent = freezeUnfreeze.label;
   }

   canStartGame()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(this.selectedGame.status !== 'lobby' && this.selectedGame.status !== 'error')
        message = 'Game status is not lobby or error';
      else if(this.selectedGame.player_count < this.selectedGame.max_players)
        message = 'Room for more players';

      return { allowed: message === '', message };
   }

   canPauseUnpauseGame()
   {
      let message = '';
      let label = 'Pause';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(this.selectedGame.status !== 'running' && this.selectedGame.status !== 'paused')
        message = 'Game is not running nor paused';
      else if(this.selectedGame.status === 'paused')
        label = 'Unpause';

      return { allowed: message === '', message, label };
   }

   canFreezeUnfreezeGame()
   {
      let message = '';
      let label = 'Freeze';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(this.selectedGame.status !== 'running' && this.selectedGame.status !== 'paused' && this.selectedGame.status !== 'frozen')
        message = 'Game is not running nor paused nor frozen';
      else if(this.selectedGame.status === 'frozen')
        label = 'Unfreeze';

      return { allowed: message === '', message, label };
   }

   canFinishGame()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(this.selectedGame.status === 'finished')
        message = 'Game is already finished';

      return { allowed: message === '', message };
   }

   canAddAIPlayer()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(this.aiList.length === 0)
        message = 'No AI implementations are available';
      else if(this.selectedGame.status !== 'lobby')
        message = 'Game is not in lobby';
      else if(this.selectedGame.player_count >= this.selectedGame.max_players)
        message = 'Game is full';

      return { allowed: message === '', message };
   }

   loadPlayers(gameId)
   {
      const abortContext = `${this.constructor.name}:loadPlayers:${gameId}`;
      const abortControl = this.requestManager.reset(abortContext);      

      Utils.requireChild(this.container, '.players-list-container').innerHTML = '<div class="players-loading">Loading players...</div>';
      this.displayStatusMessage('Loading players...', 'info');

      const request = new ApiRequest('system:listGamePlayersRequest', {gameId}, abortControl.signal);
      this.requestManager.start(abortContext, request.transactionId);
      eventBus.emit('system:listGamePlayersRequest', request);
   }

   /**
    * Handle list game players response
    * @param {ApiResponse} event - List game players response event
    */
   handleListGamePlayersResponse(event)
   {
      if (event.isSuccess() && event.data)
      {
         this.players = event.data.players || [];

         this.displayStatusMessage(`Loaded ${this.players.length} players`, 'success');
      }
      else if (event.isAborted())
         this.displayStatusMessage('Players loading aborted.', 'warning');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to load players', 'error');

      const abortContext = `${this.constructor.name}:loadPlayers:${this.selectedGame?.id}`;
      
      if(this.requestManager.isLatest(abortContext, event.transactionId))
      {
         this.renderPlayers();
         this.updatePlayerControlButtons();

         this.requestManager.complete(abortContext);
      }
      else
         console.warn('🔐 ManageGamesView: Request ID mismatch', abortContext, event.transactionId, this.requestManager.getLastTransactionId(abortContext));
   }

   renderPlayers()
   {
      console.log('🔐 ManageGamesView: Rendering players', this.selectedGame, this.players);
      const playersContainer = Utils.requireChild(this.container, '.players-list-container');

      if(!this.selectedGame)
        playersContainer.innerHTML = '<div class="players-empty">No game selected.</div>';
      else if (this.players.length === 0)
         playersContainer.innerHTML = '<div class="players-empty">No players in this game.</div>';
      else
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
      Utils.requireChild(this.container, '#end-turn-btn').disabled = !this.canEndPlayerTurn().allowed;
      Utils.requireChild(this.container, '#reset-status-btn').disabled = !this.canResetPlayerStatus().allowed;
      Utils.requireChild(this.container, '#suspend-btn').disabled = !this.canSuspendPlayer().allowed;
      Utils.requireChild(this.container, '#eject-btn').disabled = !this.canEjectPlayer().allowed;
      Utils.requireChild(this.container, '#edit-meta-btn').disabled = !this.canEditPlayerMeta().allowed;
   }

   canEndPlayerTurn()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(!this.selectedPlayer)
        message = 'No player selected';
      else if(this.selectedPlayer.status === 'ejected')
        message = 'Player is ejected';
      else if(this.selectedGame.status !== 'running')
        message = 'Game is not running';

      return { allowed: message === '', message };
   }

   canResetPlayerStatus()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(!this.selectedPlayer)
        message = 'No player selected';
      else if(this.selectedPlayer.status === 'ejected')
        message = 'Player is ejected';
      else if(this.selectedPlayer.status === 'active')
        message = 'Player is already active';
      else if(this.selectedGame.status !== 'running')
        message = 'Game is not running';

      return { allowed: message === '', message };
   }

   canSuspendPlayer()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(!this.selectedPlayer)
        message = 'No player selected';
      else if(this.selectedPlayer.status === 'ejected')
        message = 'Player is ejected';
      else if(this.selectedPlayer.status === 'suspended')
        message = 'Player is already suspended';
      else if(this.selectedGame.status !== 'running')
        message = 'Game is not running';

      return { allowed: message === '', message };
   }

   canEjectPlayer()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(!this.selectedPlayer)
        message = 'No player selected';
      else if(this.selectedPlayer.status === 'ejected')
        message = 'Player is ejected';

      return { allowed: message === '', message };
   }

   canEditPlayerMeta()
   {
      let message = '';

      if(!this.selectedGame)
        message = 'No game selected';
      else if(!this.selectedPlayer)
        message = 'No player selected';
      else if(this.selectedPlayer.status === 'ejected')
        message = 'Player is ejected';

      return { allowed: message === '', message };
   }

   startGame()
   {
      const { allowed, message } = this.canStartGame();
      
      if (allowed)
      {
        const abortControl = this.requestManager.reset(`${this.constructor.name}:startGame:${this.selectedGame.id}`);

        this.displayStatusMessage('Starting game...', 'info');

        eventBus.emit('system:startGameRequest', new ApiRequest('system:startGameRequest', {gameId: this.selectedGame.id}, abortControl.signal));
      }
      else
        this.displayStatusMessage(message, 'warning');
   }

   async pauseUnpauseGame()
   {
      const { allowed, message } = this.canPauseUnpauseGame();
      
      if (allowed)
      {
        if (this.selectedGame.status === 'paused')
          this.updateGameStatus(this.selectedGame.id, 'running');
      else
      {
          const dialog = new PromptDialog(
          {
            title: 'Pause Game',
            message: 'Please provide a reason for pausing this game:',
            placeholder: 'Enter pause reason...',
            okText: 'Pause',
            cancelText: 'Cancel'
         });
   
         const reason = await dialog.show();

         if (reason === null || reason.trim() === '')
            return this.displayStatusMessage('Pausing was cancelled', 'info');
         else
            this.updateGameStatus(this.selectedGame.id, 'paused', reason.trim());
        }
      }
      else
      {
         this.displayStatusMessage(message, 'warning');
         this.updateGameControlButtons();
         this.updatePlayerControlButtons();
      }
   }

   async freezeUnfreezeGame()
   {
      const { allowed, message } = this.canFreezeUnfreezeGame();
      
      if (allowed)
      {
         if (this.selectedGame.status === 'paused')
            this.updateGameStatus(this.selectedGame.id, 'running');
         else
         {
            const dialog = new PromptDialog(
            {
               title: 'Freeze Game',
               message: 'Please provide a reason for freezing this game:',
               placeholder: 'Enter freeze reason...',
               okText: 'Freeze',
               cancelText: 'Cancel'
            });

            const reason = await dialog.show();

            if (reason === null || reason.trim() === '')
               return this.displayStatusMessage('Freezing was cancelled', 'info');
            else
               this.updateGameStatus(this.selectedGame.id, 'frozen', reason.trim());
         }
      }
      else
      {
        this.displayStatusMessage(message, 'warning');
         this.updateGameControlButtons();
          this.updatePlayerControlButtons();
      }
   }

   finishGame()
   {
      const { allowed, message } = this.canFinishGame();
      
      if (allowed)
      {
        if (confirm('Are you sure you want to finish this game? This action cannot be undone.'))
          this.updateGameStatus(this.selectedGame.id, 'finished');
      }
      else
        this.displayStatusMessage(message, 'warning');
   }

   updateGameStatus(gameId, newStatus, statusReason = null)
   {
      const abortControl = this.requestManager.reset(`${this.constructor.name}:updateGameStatus:${gameId}`);

      this.displayStatusMessage(`Updating game status to ${newStatus}${statusReason ? ` (${statusReason})` : ''}...`, 'info');

      eventBus.emit('system:updateGameStatusRequest', new ApiRequest('system:updateGameStatusRequest', 
      {
         gameId: gameId, 
         status: newStatus,
         statusReason: statusReason
      }, abortControl.signal));
   }

   /**
    * Handle start game response
    * @param {ApiResponse} event - Start game response event
    */
   handleStartGameResponse(event)
   {
      if (event.isSuccess())
         this.displayStatusMessage('Game started successfully', 'success');
      else if (event.isAborted())
         this.displayStatusMessage('Start game aborted.', 'warning');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to start game', 'error');

      this.renderGames();
      this.updateGameControlButtons();
      this.renderPlayers();
      this.updatePlayerControlButtons();
   }

   /**
    * Handle substatus updated event (from WebSocket or eventBus)
    * @param {ApiEvent|Object} event - Substatus update event
    */
   handleSubstatusUpdated(event)
   {
      // Handle both ApiEvent and plain object formats
      const eventData = event?.data || event;
      const { gameId, status, substatus, statusReason } = eventData;

      if (!gameId)
         return this.displayStatusMessage('Invalid response for game substatus update: missing game ID', 'error');

      // Update the game in our list if we have it
      const gameIndex = this.games.findIndex(game => game.id === gameId);
      if (gameIndex !== -1)
      {
         this.games[gameIndex].status = status;
         this.games[gameIndex].substatus = substatus;
         this.games[gameIndex].status_reason = statusReason;
      }

      this.renderGames();
      this.updateGameControlButtons();
      this.renderPlayers();
      this.updatePlayerControlButtons();

      // Emit ui:statusMessage with substatus text
      if (substatus)
      {
         const substatusMessages = 
         {
            'generating_map': 'Generating map...',
            'placing_players': 'Placing players...',
            'creating_turn': 'Creating first turn...'
         };

         const message = substatusMessages[substatus] || `Game creation: ${substatus}`;

         this.displayStatusMessage(message, 'info');
      }
   }

   /**
    * Handle update game status response
    * @param {ApiResponse} event - Update game status response event
    */
   handleUpdateGameStatusResponse(event)
   {
      if (event.isSuccess())
      {
         const updatedGame = event.data?.game;
         const gameId = updatedGame?.id;
         const newStatus = updatedGame?.status;
         const substatus = updatedGame?.substatus;
         const statusReason = updatedGame?.status_reason;
         
         if (!gameId || !newStatus)
            return this.displayStatusMessage('Invalid response: missing game ID or status', 'error');

         // Find and update the game in the games array
         const gameIndex = this.games.findIndex(game => game.id === gameId);
         if (gameIndex !== -1)
         {
            this.games[gameIndex].status = newStatus;

            if (substatus !== undefined)
               this.games[gameIndex].substatus = substatus;

            if (statusReason !== undefined)
               this.games[gameIndex].status_reason = statusReason;
            
            // Post status message based on new status
            if (newStatus === 'creating')
               this.displayStatusMessage('Game creation started...', 'info');
            else if (newStatus === 'error')
               this.displayStatusMessage('Game creation failed. You can try starting again.', 'error');
            else
               this.displayStatusMessage(`Game status updated to ${newStatus}`, 'success');
         }
         else
            this.displayStatusMessage('Game not found in list of loaded games, status updated on database', 'warning');
      }
      else if (event.isAborted())
         this.displayStatusMessage('Update game status aborted.', 'warning');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to update game status', 'error');

      this.renderGames();
      this.updateGameControlButtons();
      this.renderPlayers();
      this.updatePlayerControlButtons();
   
   }

   async endPlayerTurn()
   {
      const { allowed, message } = this.canEndPlayerTurn();
      
      if (allowed)
      {
         const dialog = new PromptDialog(
         {
            title: 'End Player Turn',
            message: `Please provide a reason for ending ${this.selectedPlayer.name}'s turn:`,
            placeholder: 'Enter reason...',
            okText: 'End',
            cancelText: 'Cancel'
         });

         const reason = await dialog.show();

         if (reason === null || reason.trim() === '')
            return this.displayStatusMessage('Ending player turn was cancelled', 'info');

         const abortControl = this.requestManager.reset(`${this.constructor.name}:endPlayerTurn:${this.selectedGame.id}:${this.selectedPlayer.id}`);

         this.displayStatusMessage('Ending player turn...', 'info');

         eventBus.emit('system:endPlayerTurnRequest', new ApiRequest('system:endPlayerTurnRequest',
         {
            gameId: this.selectedGame.id,
            playerId: this.selectedPlayer.id,
            reason: reason.trim()
         }, abortControl.signal));
      }
      else
        this.displayStatusMessage(message, 'warning');
   }

   /**
    * Handle end player turn response
    * @param {ApiResponse} event - End player turn response event
    */
   handleEndPlayerTurnResponse(event)
   {
      console.log('🔐 ManageGamesView: Handling end player turn response', event);

      if (event.isSuccess())
      {
         this.displayStatusMessage('Player turn ended successfully', 'success');
         this.loadPlayers(this.selectedGame.id);
      }
      else if (event.isAborted())
         this.displayStatusMessage('End player turn aborted.', 'warning');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to end player turn', 'error');
   }

   resetPlayerStatus()
   {
      const { allowed, message } = this.canResetPlayerStatus();
      
      if (allowed)
          this.updatePlayerStatus(this.selectedGame.id, this.selectedPlayer.id, 'active');
      else
        this.displayStatusMessage(message, 'warning');

      this.updatePlayerControlButtons();
   }

   async suspendPlayer()
   {
      const { allowed, message } = this.canSuspendPlayer();
      
      if (allowed)
      {
         const dialog = new PromptDialog(
         {
            title: 'Suspend Player',
            message: `Please provide a reason for suspending ${this.selectedPlayer.name}:`,
            placeholder: 'Enter reason...',
            okText: 'Suspend',
            cancelText: 'Cancel'
         });

         const reason = await dialog.show();

         if (reason === null || reason.trim() === '')
            return this.displayStatusMessage('Suspending player was cancelled', 'info');

         this.updatePlayerStatus(this.selectedGame.id, this.selectedPlayer.id, 'suspended', reason.trim());
      }
      else
        this.displayStatusMessage(message, 'warning');

      this.updatePlayerControlButtons(); // always update the player control buttons regardless of the result
   }

   async ejectPlayer()
   {
      const { allowed, message } = this.canEjectPlayer();
      
      if (allowed)
      {
         const dialog = new PromptDialog(
         {
            title: 'Eject Player - CANNOT BE UNDONE',
            message: `Please provide a reason for ejecting ${this.selectedPlayer.name}:`,
            placeholder: 'Enter reason...',
            okText: 'Eject',
            cancelText: 'Cancel'
         });

         const reason = await dialog.show();

         if (reason === null || reason.trim() === '')
            return this.displayStatusMessage('Player ejection was cancelled', 'info');

         this.updatePlayerStatus(this.selectedGame.id, this.selectedPlayer.id, 'ejected', reason.trim());
      }
      else
        this.displayStatusMessage(message, 'warning');

      this.updatePlayerControlButtons(); // always update the player control buttons regardless of the result
   }

   updatePlayerStatus(gameId, playerId, newStatus, statusReason = null)
   {
      const abortControl = this.requestManager.reset(`${this.constructor.name}:updatePlayerStatus:${gameId}:${playerId}`);

      this.displayStatusMessage(`Updating player status to ${newStatus}${statusReason ? ` (${statusReason})` : ''}...`, 'info');

      const requestData = {gameId: gameId, playerId: playerId, status: newStatus, statusReason: statusReason?.trim()};
      eventBus.emit('system:updatePlayerStatusRequest', new ApiRequest('system:updatePlayerStatusRequest', requestData, abortControl.signal));
   }

   /**
    * Handle update player status response
    * @param {ApiResponse} event - Update player status response event
    */
   handleUpdatePlayerStatusResponse(event)
   {
      if (event.isSuccess())
      {
         if(this.selectedGame && this.selectedGame.id === event.data?.player?.game_id)
         {
            const playerIndex = this.players.findIndex(player => player.id === event.data?.player?.id);

            if (playerIndex !== -1)
            {
               this.players[playerIndex].status = event.data?.player?.status;
               this.players[playerIndex].status_reason = event.data?.player?.status_reason;

               this.renderPlayers();
               this.displayStatusMessage(`Player status updated to ${event.data?.player?.status}`, 'success');
            }
            else
               this.displayStatusMessage('Player not found in list of loaded players, player status updated on database', 'warning');
         }
         else
            this.displayStatusMessage('Game the player is in is not found in list of loaded games, player status updated on database', 'warning');
      }
      else if (event.isAborted())
         this.displayStatusMessage('Update player status aborted.', 'warning');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to update player status', 'error');

      this.renderGames();
      this.updateGameControlButtons();
      this.renderPlayers();
      this.updatePlayerControlButtons();   
   }

   /**
    * Handle AI list response
    * TODO add code to disable add AI player if there are no AI implementations available
    * @param {ApiResponse} event - AI list response event
    */
   handleAIListResponse(event)
   {
      console.log('🔐 ManageGamesView: Handling AI list response', event);

      if (!event.isSuccess() || !event.data)
         return this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to load available AIs', 'error'); // void function call

      this.aiList = event.data.success && event.data.ais ? event.data.ais : [];

      if (this.aiList.length === 0)
         this.displayStatusMessage('No AI implementations are available.', 'warning');
      else
         this.displayStatusMessage(`${this.aiList.length} AI implementations are available.`, 'success');

      this.updatePlayerControlButtons();   
   }

   showAddAIPlayerDialog()
   {
      const { allowed, message } = this.canAddAIPlayer();

      if (allowed)
      {
         this.dialog = new Dialog(
         {
            title: 'Add AI Player',
            contentHTML: addAIPlayerDialogHTML,
            styles: addAIPlayerDialogCSS,
            className: 'ai-player-dialog',
            buttonText: 'Add AI Player',
            onClose: () => { this.handleDialogClose(); }
         });

         this.aiSelect = Utils.requireChild(this.dialog.getDialog(), '#ai-select');
         this.aiDescription = Utils.requireChild(this.dialog.getDialog(), '#ai-description');
         this.aiConfigContainer = Utils.requireChild(this.dialog.getDialog(), '#ai-config-container');
         this.aiAddBtn = Utils.requireChild(this.dialog.getDialog(), '#save-dialog-btn');

         this.aiList.forEach(ai =>
         {
            const option = document.createElement('option');
            option.value = ai.name;
            option.textContent = ai.name;
            this.aiSelect.appendChild(option);
         });

         this.aiSelect.addEventListener('change', (e) => this.handleAISelection(e));
         this.aiAddBtn.addEventListener('click', () => this.handleAddAIPlayerClick(`${this.constructor.name}:addAIPlayer:${this.selectedGame.id}`));
         Utils.requireChild(this.dialog.getDialog(), '#player-name-input').addEventListener('input', () => this.updateAddAIPlayerButtonState());
         Utils.requireChild(this.dialog.getDialog(), '#country-name-input').addEventListener('input', () => this.updateAddAIPlayerButtonState());
         Utils.requireChild(this.dialog.getDialog(), '.cancel-dialog-btn').addEventListener('click', () => this.dialog.close());

         this.statusComponent.mount(Utils.requireChild(this.dialog.getDialog(), '#ai-config-mount-point'));

         this.dialog.show();
      }
      else
         this.displayStatusMessage(message, 'warning');
   }

   updateAddAIPlayerButtonState()
   {
      const hasPlayerName = Utils.requireChild(this.dialog.getDialog(), '#player-name-input').value.trim().length > 0;
      const hasCountryName = Utils.requireChild(this.dialog.getDialog(), '#country-name-input').value.trim().length > 0;
      const hasAI = this.selectedAI !== null;
      
      this.aiAddBtn.disabled = !(hasPlayerName && hasCountryName && hasAI);
   }

   handleAISelection(e)
   {
      const aiName = e.target.value;
      if (!aiName)
      {
         this.aiDescription.style.display = 'none';
         this.aiConfigContainer.style.display = 'none';
         this.aiAddBtn.disabled = true;
         this.selectedAI = null;

         return;
      }

      this.selectedAI = this.aiList.find(ai => ai.name === aiName);
      if (!this.selectedAI)
         return this.context.displayStatusMessage('Unable to find AI in list of registered AIs', 'error');

      this.aiDescription.textContent = this.selectedAI.description || 'No description available';
      this.aiDescription.style.display = 'block';

      // Build config form
      if (this.selectedAI.schema && Object.keys(this.selectedAI.schema).length > 0)
         this.currentAIConfigForm = this.aiFormBuilder.buildForm(this.selectedAI.schema, {}, this.aiConfigContainer);
      else
      {
         this.aiConfigContainer.innerHTML = '<p style="color: #888; font-size: 13px;">This AI has no configurable options.</p>';
         this.currentAIConfigForm = 
         {
            getData: () => ({}),
            validate: () => []
         };
      }

      this.aiConfigContainer.style.display = 'block';
      this.updateAddAIPlayerButtonState();
      this.dialog.recenter(); // Re-center the dialog after dynamic content is added
   }

   handleAddAIPlayerClick(abortContext)
   {
      if (this.aiAddBtn.disabled)
         return;

      const playerName = Utils.requireChild(this.dialog.getDialog(), '#player-name-input').value.trim();
      const countryName = Utils.requireChild(this.dialog.getDialog(), '#country-name-input').value.trim();

      if (!playerName)
         return this.displayStatusMessage('Player name is required', 'error');

      if (!countryName)
         return this.displayStatusMessage('Country name is required', 'error');

      if (!this.selectedAI)
         return this.displayStatusMessage('Please select an AI', 'error');

      // Validate form
      if (this.currentAIConfigForm)
      {
         const errors = this.currentAIConfigForm.validate();
         if (errors.length > 0)
            return this.displayStatusMessage(errors.join(', '), 'error');
      }

      const aiConfig = this.currentAIConfigForm?.getData() || {};
      const abortControl = this.requestManager.reset(abortContext);

      this.displayStatusMessage('Adding AI player...', 'info');
      this.dialog.setDisabled(true);

      eventBus.emit('system:addAIPlayerRequest', new ApiRequest('system:addAIPlayerRequest',
      {
         gameId: this.selectedGame.id,
         aiName: this.selectedAI.name,
         playerName,
         countryName,
         aiConfig
      }, abortControl.signal));
   }

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

      const abortContext = `${this.constructor.name}:updatePlayerMeta:${this.selectedGame.id}:${this.selectedPlayer.id}`;

      Utils.requireChild(this.dialog.getDialog(), '#save-dialog-btn').addEventListener('click', (e) => this.savePlayerMeta(e, abortContext));
      Utils.requireChild(this.dialog.getDialog(), '.cancel-dialog-btn').addEventListener('click', () => this.dialog.close());

      this.dialog.show();
   }

   savePlayerMeta(e, abortContext)
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
      catch (error)
      {
         return this.displayStatusMessage('Error: Meta must be valid JSON', 'error');
      }

      const abortControl = this.requestManager.reset(abortContext);

      this.displayStatusMessage('Updating player meta...', 'info');
      this.dialog.setDisabled(true);

      eventBus.emit('system:updatePlayerMetaRequest', new ApiRequest('system:updatePlayerMetaRequest',
      {
         gameId: this.selectedGame.id,
         playerId: this.selectedPlayer.id,
         meta: metaData
      }, abortControl.signal));
   }

   handleDialogClose()
   {
      this.dialog = null;
      this.statusComponent.mount(Utils.requireElement('.home-main-content'));
   }

   /**
    * Handle update player meta response
    * @param {ApiResponse} event - Update player meta response event
    */
   handleUpdatePlayerMetaResponse(event)
   {
      console.log('🔐 ManageGamesView: Handling update player meta response', event);

      if (this.dialog)
         this.dialog.setDisabled(false);

      if (event.isSuccess())
      {
         // Update selected player meta, should probably use the player from the event and try to find him in the players array
         if (this.selectedPlayer && event.data?.meta !== undefined)
            this.selectedPlayer.meta = event.data.meta;
         
         if (this.dialog)
            this.dialog.close();

         this.displayStatusMessage('Player meta updated successfully', 'success');
      }
      else if (event.isAborted())
      {
         this.displayStatusMessage('Update player meta aborted.', 'warning');

         if (this.dialog)
            this.dialog.close();
      }
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to update player meta', 'error');

      this.renderGames();
      this.updateGameControlButtons();
      this.renderPlayers();
      this.updatePlayerControlButtons();   
   }

   /**
    * Handle add AI player response
    * @param {ApiResponse} event - Add AI player response event
    */
   handleAddAIPlayerResponse(event)
   {
      console.log('🔐 ManageGamesView: Handling add AI player response', event);

      this.dialog.setDisabled(false);

      if (event.isSuccess())
      {
         this.dialog.close();

         // Reload games and players or maybe update the game and reload players before re-rendering both lists
         this.loadGames(this.currentPage);

         if (this.selectedGame) // not needed if we re-render
            this.selectGame(this.selectedGame.id);

         this.displayStatusMessage('AI player added successfully', 'success');
      }
      else if (event.isAborted())
         this.displayStatusMessage('Add AI player aborted.', 'warning');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to add AI player', 'error');

      this.renderGames();
      this.updateGameControlButtons();
      this.renderPlayers();
      this.updatePlayerControlButtons();
   }

   changePage(delta)
   {
      const newPage = this.targetPage + delta;
      this.targetPage = Utils.clamp(newPage, 1, this.totalPages);

      if (newPage === this.targetPage)
      {
         this.isLoadingGames = true;
         this.selectedGame = null;
         this.selectedPlayer = null;
         this.players = [];

         this.updatePaginationControls();
         this.updateGameControlButtons();
         this.updatePlayerControlButtons();
         this.renderPlayers();
         this.loadGames(newPage);
      }
      else
         console.warn('🔐 ManageGamesView: Page limit reached, request not sent.', delta, newPage, this.targetPage);
   }

   updatePaginationControls()
   {
      Utils.requireChild(this.container, '#prev-page-btn').disabled = this.targetPage <= 1;
      Utils.requireChild(this.container, '#next-page-btn').disabled = this.targetPage >= this.totalPages;
      Utils.requireChild(this.container, '#page-info').textContent = this.isLoadingGames ? 'Loading...' : `Page ${this.currentPage} of ${this.totalPages}`;
   }

   getContainer()
   {
      if (!this.container)
         this.create();

      return this.container;
   }

   dispose()
   {
      if (this.dialog) 
        this.dialog.close();
      
      this.unregisterEventHandlers();

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
      this.selectedGame = null;
      this.selectedPlayer = null;
      this.games = [];
      this.players = [];
      this.dialog = null;

      this.aiList = [];
      this.aiSelect = null;
      this.aiDescription = null;
      this.aiConfigContainer = null;
      this.aiAddBtn = null;
      this.selectedAI = null;
      this.currentAIConfigForm = null;
      this.aiFormBuilder = null;
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
    <button id="prev-page-btn" disabled>Previous</button>
    <span class="pagination-info" id="page-info">Page 1 of 1</span>
    <button id="next-page-btn" disabled>Next</button>
      </div>
  </div>
</div>

  <!-- Right Panel: Management Controls -->
  <div class="manage-games-right-panel">
    <!-- Game Control Buttons -->
    <div class="manage-games-section manage-games-fixed-section">
  <h3>Game Controls</h3>
  <div class="game-controls">
    <button id="start-game-btn" disabled>Start</button>
    <button id="pause-unpause-btn" disabled>Pause</button>
    <button id="freeze-unfreeze-btn" disabled>Freeze</button>
    <button id="finish-game-btn" disabled>Finish</button>
    <button id="add-ai-player-btn" disabled>Add AI Player</button>
  </div>
</div>

<!-- Player Control Buttons -->
    <div class="manage-games-section manage-games-fixed-section">
  <h3>Player Controls</h3>
  <div class="player-controls">
    <button id="end-turn-btn" disabled>End Turn</button>
    <button id="reset-status-btn" disabled>Reset Status</button>
    <button id="suspend-btn" disabled>Suspend</button>
    <button id="eject-btn" disabled>Eject</button>
    <button id="edit-meta-btn" disabled>Edit Meta</button>
  </div>
</div>

    <!-- Players List -->
    <div class="manage-games-section manage-games-scrollable-section">
      <h3>Players</h3>
      <div class="players-list-container">
        <div class="players-placeholder">No game selected.</div>
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
<fieldset>
      <div class="ai-dialog-content">
        <div class="ai-selection-group">
          <label for="ai-select" style="display: block; margin-bottom: 8px; color: #00ff88;">Select AI:</label>
    <select id="ai-select" class="ai-select">
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
</fieldset>
<div id="ai-config-mount-point"></div>
`;

/**
 * Generate HTML for a game card
 * @param {Object} game - Game object
 * @param {boolean} isSelected - Whether the game is selected
 * @returns {string} HTML string
 */
const gameCardHTML = (game, isSelected) => {
   const substatusHTML = (game.substatus) 
      ? `<div class="game-info-row">
           <span class="game-label">Substatus:</span>
           <span class="game-value">${Utils.escapeHtml(game.substatus)}</span>
         </div>`
      : '';
   
   const statusReasonHTML = (game.status_reason)
      ? `<div class="game-info-row">
           <span class="game-label">Status Reason:</span>
           <span class="game-value">${Utils.escapeHtml(game.status_reason)}</span>
         </div>`
      : '';

   return `
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
    ${substatusHTML}
    ${statusReasonHTML}
  </div>
</div>
`;
};

/**
 * Generate HTML for a player card
 * @param {Object} player - Player object
 * @param {boolean} isSelected - Whether the player is selected
 * @returns {string} HTML string
 */
const playerCardHTML = (player, isSelected) =>
{
   const metaStr = typeof player.meta === 'string' ? player.meta : JSON.stringify(player.meta || {}, null, 2);
   const isAI = player.type === 'ai';
   const nameDisplay = isAI ? `${player.name} (AI)` : player.name;
   
   const statusReasonHTML = (player.status_reason)
      ? `<div class="player-info-row">
           <span class="player-label">Status Reason:</span>
           <span class="player-value">${Utils.escapeHtml(player.status_reason)}</span>
         </div>`
      : '';

   return `
<div class="player-card ${isSelected ? 'selected' : ''}" data-player-id="${player.id}">
  <div class="player-card-header">
    <h4 class="player-name">${Utils.escapeHtml(nameDisplay)}</h4>
    <span class="player-status-badge status-${player.status}">${Utils.escapeHtml(player.status)}</span>
  </div>
  <div class="player-card-body">
    <div class="player-info-row">
      <span class="player-label">Country:</span>
      <span class="player-value">${Utils.escapeHtml(player.country_name || 'N/A')}</span>
    </div>
    ${statusReasonHTML}
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

const addAIPlayerDialogCSS = `
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