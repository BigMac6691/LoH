/**
 * CreateGameView - Create a new game interface
 */
import { DualSlider } from '../DualSlider.js';
import { MenuView } from './MenuView.js';
import { Utils } from '../utils/Utils.js';
import { eventBus } from '../eventBus.js';
import { ApiRequest } from '../events/Events.js';

export class CreateGameView extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
      this.titleInput = null;
      this.descriptionInput = null;
      this.mapSizeSlider = null;
      this.mapSizeValue = null;
      this.starDensitySlider = null;
      this.maxPlayersSlider = null;
      this.maxPlayersValue = null;
      this.seedInput = null;
      this.createBtn = null;
      this.currentMapSize = 5;
      this.abortControl = null;

      this.registerEventHandler('system:createGameResponse', this.handleCreateGameResponse.bind(this));
   }

   create()
   {
      this.container = document.createElement('div');
      this.container.className = 'create-game-view';
      this.container.innerHTML = createHTML;
      
      this.setupForm();
      return this.container;
   }

   setupForm()
   {
      // Get form elements
      this.titleInput = Utils.requireChild(this.container, '#game-title');
      this.descriptionInput = Utils.requireChild(this.container, '#game-description');
      this.mapSizeSlider = Utils.requireChild(this.container, '#map-size');
      this.mapSizeValue = Utils.requireChild(this.container, '#map-size-value');
      this.maxPlayersSlider = Utils.requireChild(this.container, '#max-players');
      this.maxPlayersValue = Utils.requireChild(this.container, '#max-players-value');
      this.seedInput = Utils.requireChild(this.container, '#game-seed');
      this.createBtn = Utils.requireChild(this.container, '#create-game-btn');
      const form = Utils.requireChild(this.container, '#create-game-form');
      const starDensityContainer = Utils.requireChild(this.container, '#star-density-slider-container');

      this.seedInput.value = this.generateSeed();

      this.mapSizeSlider.addEventListener('input', (e) =>
      {
         const value = parseInt(e.target.value);
         this.currentMapSize = value;
         this.mapSizeValue.textContent = value;

         // Update max players slider max value (mapSize * 2)
         const maxMaxPlayers = value * 2;
         this.maxPlayersSlider.max = maxMaxPlayers;

         // If current max players exceeds new max, adjust it
         if (parseInt(this.maxPlayersSlider.value) > maxMaxPlayers)
         {
            this.maxPlayersSlider.value = maxMaxPlayers;
            this.maxPlayersValue.textContent = maxMaxPlayers;
         }
      });

      this.maxPlayersSlider.addEventListener('input', (e) => {this.maxPlayersValue.textContent = e.target.value;});

      this.starDensitySlider = new DualSlider(starDensityContainer, {min: 1, max: 9, minValue: 2, maxValue: 7, width: 280, height: 40, onChange: (values) => {console.log('Star density changed:', values);}});

      // Setup form submission
      form.addEventListener('submit', (e) =>
      {
         e.preventDefault();
         this.handleCreateGame();
      });
   }

   generateSeed()
   {
      return String(Date.now()).slice(-6);
   }

   /**
    * Set the disabled state of the form (fieldset and dual slider)
    * @param {boolean} disabled - Whether the form should be disabled
    */
   setFormDisabled(disabled)
   {
      Utils.requireChild(this.container, 'fieldset').disabled = disabled;
      this.starDensitySlider.setDisabled(disabled);
   }

   handleCreateGame()
   {
      // Get form values
      const title = this.titleInput.value.trim();
      const description = this.descriptionInput.value.trim();
      const mapSize = parseInt(this.mapSizeSlider.value);
      const maxPlayers = parseInt(this.maxPlayersSlider.value);
      const seed = this.seedInput.value.trim();

      // Get star density values from dual slider
      const densityValues = this.starDensitySlider.getValues();
      const densityMin = densityValues.min;
      const densityMax = densityValues.max;

      // Validate inputs
      if (!title)
         return this.displayStatusMessage('Title is required', 'error'); // void function

      if (!description)
         return this.displayStatusMessage('Description is required', 'error'); // void function

      if (!seed)
         return this.displayStatusMessage('Seed is required', 'error'); // void function

      // Abort any pending create request
      if (this.abortControl)
         this.abortControl.abort();

      this.abortControl = new AbortController();

      // Disable form during submission
      this.setFormDisabled(true);
      this.displayStatusMessage('Creating game...', 'info');

      setTimeout(() => {
         eventBus.emit('system:createGameRequest', new ApiRequest('system:createGameRequest', {seed, mapSize, densityMin, densityMax, title, description, maxPlayers}, this.abortControl.signal));
      }, 10000);
   }

   /**
    * Handle create game response
    * @param {ApiResponse} event - Create game response event
    */
   handleCreateGameResponse(event)
   {
      console.log('🔐 CreateGameView: Handling create game response', event);

      // Re-enable form
      this.setFormDisabled(false);
      this.createBtn.disabled = false;
      this.createBtn.textContent = 'Create Game';

      if (event.isSuccess())
      {
         const gameId = event.data?.gameId || 'Unknown';
         this.displayStatusMessage(`Game created successfully! Game ID: ${gameId}`, 'success');
         this.resetForm();
      }
      else if (event.isAborted())
         this.displayStatusMessage('Create game aborted.', 'error');
      else
         this.displayStatusMessage(event.error?.message || event.data?.message || 'Failed to create game', 'error');

      this.abortControl = null;
   }

   resetForm()
   {
      this.titleInput.value = '';
      this.descriptionInput.value = '';
      this.mapSizeSlider.value = 5;
      this.mapSizeValue.textContent = '5';
      this.currentMapSize = 5;
      this.maxPlayersSlider.max = 10;
      this.maxPlayersSlider.value = 2;
      this.maxPlayersValue.textContent = '2';
      this.starDensitySlider.setValues(2, 7);
      this.seedInput.value = this.generateSeed();
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

      this.unregisterEventHandlers();

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
      this.starDensitySlider = null;
      this.abortControl = null;
   }
}

const createHTML = `
<div class="view-header">
        <h2>Create Game</h2>
      </div>
      <div class="view-content">
        <form id="create-game-form" class="create-game-form">
          <fieldset>
            <!-- Title -->
            <div class="form-group">
              <label for="game-title">Title</label>
              <input type="text" id="game-title" name="title" required placeholder="Enter game title" />
            </div>

            <!-- Description -->
            <div class="form-group">
              <label for="game-description">Description</label>
              <textarea id="game-description" name="description" required placeholder="Enter game description" rows="3"></textarea>
            </div>

            <!-- Map Size -->
            <div class="form-group">
              <label for="map-size">Map Size: <span id="map-size-value">5</span></label>
              <input type="range" id="map-size" name="mapSize" min="2" max="9" value="5" />
            </div>

            <!-- Star Density -->
            <div class="form-group">
              <label>Star Density Range</label>
              <div id="star-density-slider-container"></div>
            </div>

            <!-- Max Players -->
            <div class="form-group">
              <label for="max-players">Max Players: <span id="max-players-value">2</span></label>
              <input type="range" id="max-players" name="maxPlayers" min="1" max="10" value="2" />
            </div>

            <!-- Seed -->
            <div class="form-group">
              <label for="game-seed">Seed</label>
              <input type="text" id="game-seed" name="seed" required placeholder="Enter seed" />
            </div>

            <!-- Create Button -->
            <div class="form-actions">
              <button type="submit" id="create-game-btn" class="create-btn">Create Game</button>
            </div>
          </fieldset>
        </form>
      </div>`;