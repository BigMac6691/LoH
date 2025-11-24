/**
 * CreateGameView - Create a new game interface
 */
import { DualSlider } from '../DualSlider.js';
import { RB } from '../utils/RequestBuilder.js';
import { MenuView } from './MenuView.js';

export class CreateGameView extends MenuView {
  constructor(statusComponent) {
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
  }

  /**
   * Create and return the create game view container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'create-game-view';
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Create Game</h2>
      </div>
      <div class="view-content">
        <form id="create-game-form" class="create-game-form">
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
        </form>
      </div>
    `;

    this.setupForm();
    return this.container;
  }

  /**
   * Setup form elements and event listeners
   */
  setupForm() {
    // Get form elements
    this.titleInput = this.container.querySelector('#game-title');
    this.descriptionInput = this.container.querySelector('#game-description');
    this.mapSizeSlider = this.container.querySelector('#map-size');
    this.mapSizeValue = this.container.querySelector('#map-size-value');
    this.maxPlayersSlider = this.container.querySelector('#max-players');
    this.maxPlayersValue = this.container.querySelector('#max-players-value');
    this.seedInput = this.container.querySelector('#game-seed');
    this.createBtn = this.container.querySelector('#create-game-btn');
    const form = this.container.querySelector('#create-game-form');
    const starDensityContainer = this.container.querySelector('#star-density-slider-container');

    // Set default seed (last 6 digits of current time in milliseconds)
    const now = Date.now();
    const seed = String(now).slice(-6);
    this.seedInput.value = seed;

    // Setup map size slider
    this.mapSizeSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.currentMapSize = value;
      this.mapSizeValue.textContent = value;
      
      // Update max players slider max value (mapSize * 2)
      const maxMaxPlayers = value * 2;
      this.maxPlayersSlider.max = maxMaxPlayers;
      
      // If current max players exceeds new max, adjust it
      if (parseInt(this.maxPlayersSlider.value) > maxMaxPlayers) {
        this.maxPlayersSlider.value = maxMaxPlayers;
        this.maxPlayersValue.textContent = maxMaxPlayers;
      }
    });

    // Setup max players slider
    this.maxPlayersSlider.addEventListener('input', (e) => {
      this.maxPlayersValue.textContent = e.target.value;
    });

    // Initialize star density dual slider
    this.starDensitySlider = new DualSlider(starDensityContainer, {
      min: 1,
      max: 9,
      minValue: 2,
      maxValue: 7,
      width: 280,
      height: 60,
      onChange: (values) => {
        // Optional: handle real-time changes if needed
        console.log('Star density changed:', values);
      }
    });

    // Setup form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateGame();
    });
  }

  /**
   * Handle create game form submission
   */
  async handleCreateGame() {
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
    if (!title) {
      this.displayStatusMessage('Title is required', 'error');
      return;
    }

    if (!description) {
      this.displayStatusMessage('Description is required', 'error');
      return;
    }

    if (!seed) {
      this.displayStatusMessage('Seed is required', 'error');
      return;
    }

    // Disable button during submission
    this.createBtn.disabled = true;
    this.createBtn.textContent = 'Creating...';

    try {
      const data = await RB.fetchPost('/api/games', {
        title,
        description,
        mapSize,
        densityMin,
        densityMax,
        maxPlayers,
        seed,
        status: 'lobby',
        params: {}
      });

      // Success - show message and reset form
      this.displayStatusMessage(`Game created successfully! Game ID: ${data.gameId}`, 'success');
      this.resetForm();

    } catch (error) {
      console.error('Error creating game:', error);
      this.displayStatusMessage(error.message || 'Failed to create game', 'error');
    } finally {
      // Re-enable button
      this.createBtn.disabled = false;
      this.createBtn.textContent = 'Create Game';
    }
  }

  /**
   * Reset form to default values
   */
  resetForm() {
    this.titleInput.value = '';
    this.descriptionInput.value = '';
    this.mapSizeSlider.value = 5;
    this.mapSizeValue.textContent = '5';
    this.currentMapSize = 5;
    this.maxPlayersSlider.max = 10;
    this.maxPlayersSlider.value = 2;
    this.maxPlayersValue.textContent = '2';
    
    // Reset star density slider
    this.starDensitySlider.setValues(2, 7);
    
    // Reset seed to new default
    const now = Date.now();
    const seed = String(now).slice(-6);
    this.seedInput.value = seed;
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
    this.starDensitySlider = null;
  }
}

