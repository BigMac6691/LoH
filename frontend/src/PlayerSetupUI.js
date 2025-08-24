import { DEV_MODE } from './devScenarios.js';

/**
 * PlayerSetupUI - Handles the player setup interface
 */
export class PlayerSetupUI {
  constructor(playerManager, mapModel, onGameStart) {
    this.playerManager = playerManager;
    this.mapModel = mapModel;
    this.onGameStart = onGameStart;
    this.element = null;
    this.playerListElement = null;
    this.nameInput = null;
    this.colorSelect = null;
    this.addButton = null;
    this.startButton = null;
    
    this.init();
  }

  /**
   * Initialize the player setup UI
   */
  init() {
    this.createElements();
    this.setupEventListeners();
    this.updateDisplay();
  }

  /**
   * Create the DOM elements for the player setup UI
   */
  createElements() {
    // Create main container
    this.element = document.createElement('div');
    this.element.className = 'player-setup-panel';
    this.element.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00ff88;
      border-radius: 15px;
      padding: 30px;
      color: white;
      z-index: 2000;
      min-width: 400px;
      max-width: 600px;
      backdrop-filter: blur(10px);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Create header
    const header = document.createElement('h2');
    header.textContent = 'Player Setup';
    header.style.cssText = `
      margin: 0 0 20px 0;
      text-align: center;
      color: #00ff88;
      font-size: 28px;
    `;

    // Create player list
    this.playerListElement = document.createElement('div');
    this.playerListElement.className = 'player-list';
    this.playerListElement.style.cssText = `
      margin-bottom: 25px;
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
    `;

    // Create form container
    const formContainer = document.createElement('div');
    formContainer.className = 'player-form';
    formContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
      align-items: end;
      margin-bottom: 20px;
    `;

    // Create name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Player Name:';
    nameLabel.style.cssText = `
      color: #ccc;
      font-size: 14px;
      margin-bottom: 5px;
    `;

    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Enter player name';
    this.nameInput.style.cssText = `
      padding: 10px;
      border: 1px solid #333;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 16px;
      width: 100%;
      box-sizing: border-box;
    `;

    // Create color select
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color:';
    colorLabel.style.cssText = `
      color: #ccc;
      font-size: 14px;
      margin-bottom: 5px;
    `;

    this.colorSelect = document.createElement('select');
    this.colorSelect.style.cssText = `
      padding: 10px;
      border: 1px solid #333;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 16px;
      cursor: pointer;
    `;

    // Create add button
    this.addButton = document.createElement('button');
    this.addButton.textContent = 'Add Player';
    this.addButton.style.cssText = `
      padding: 10px 20px;
      background: linear-gradient(45deg, #00ff88, #00cc6a);
      border: none;
      border-radius: 5px;
      color: #000;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    `;

    // Create start button
    this.startButton = document.createElement('button');
    this.startButton.textContent = 'Start Game';
    this.startButton.style.cssText = `
      width: 100%;
      padding: 15px;
      background: linear-gradient(45deg, #ff6b6b, #ee5a52);
      border: none;
      border-radius: 5px;
      color: white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 10px;
    `;

    // Create info text
    const infoText = document.createElement('div');
    infoText.innerHTML = `
      <p class="info-text">
        Add at least 2 players to start the game.<br>
        Each player will be assigned to a random sector with stars.
      </p>
    `;

    // Assemble the form
    const nameContainer = document.createElement('div');
    nameContainer.appendChild(nameLabel);
    nameContainer.appendChild(this.nameInput);

    const colorContainer = document.createElement('div');
    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(this.colorSelect);

    formContainer.appendChild(nameContainer);
    formContainer.appendChild(colorContainer);
    formContainer.appendChild(this.addButton);

    // Assemble the component
    this.element.appendChild(header);
    this.element.appendChild(this.playerListElement);
    this.element.appendChild(formContainer);
    this.element.appendChild(infoText);
    this.element.appendChild(this.startButton);

    // Add to document
    document.body.appendChild(this.element);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Add player button
    this.addButton.addEventListener('click', () => {
      this.addPlayer();
    });

    // Enter key on name input
    this.nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addPlayer();
      }
    });

    // Start game button
    this.startButton.addEventListener('click', () => {
      this.startGame();
    });

    // Focus on name input when shown
    this.nameInput.focus();
  }

  /**
   * Add a new player
   */
  addPlayer() {
    const name = this.nameInput.value.trim();
    const color = this.colorSelect.value;

    if (!name) {
      this.showError('Please enter a player name');
      return;
    }

    const result = this.playerManager.addPlayer(name, color, this.mapModel);
    
    if (result.success) {
      this.nameInput.value = '';
      this.updateDisplay();
      this.nameInput.focus();
    } else {
      this.showError(result.error);
    }
  }

  /**
   * Start the game
   */
  startGame() {
    if (!this.playerManager.canStartGame(2)) {
      this.showError('Need at least 2 players to start the game');
      return;
    }

    this.hide();
    if (this.onGameStart) {
      this.onGameStart(this.playerManager.getPlayers());
    }
  }

  /**
   * Update the display
   */
  updateDisplay() {
    this.updatePlayerList();
    this.updateColorSelect();
    this.updateStartButton();
  }

  /**
   * Update the player list display
   */
  updatePlayerList() {
    this.playerListElement.innerHTML = '';
    
    const players = this.playerManager.getPlayers();
    
    if (players.length === 0) {
      const emptyText = document.createElement('div');
      emptyText.textContent = 'No players added yet';
      emptyText.style.cssText = `
        color: #666;
        text-align: center;
        padding: 20px;
        font-style: italic;
      `;
      this.playerListElement.appendChild(emptyText);
      return;
    }

    players.forEach(player => {
      const playerItem = document.createElement('div');
      playerItem.className = 'player-item';
      playerItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 5px;
        border-left: 4px solid ${player.color};
      `;

      const playerInfo = document.createElement('div');
      playerInfo.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
      `;

      const colorDot = document.createElement('div');
      colorDot.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${player.color};
        border: 2px solid white;
      `;

      const playerName = document.createElement('span');
      playerName.textContent = player.name;
      playerName.style.cssText = `
        font-weight: bold;
        color: white;
      `;

      const sectorInfo = document.createElement('span');
      sectorInfo.textContent = `Sector (${player.sector.row + 1}, ${player.sector.col + 1})`;
      sectorInfo.style.cssText = `
        color: #ccc;
        font-size: 12px;
      `;

      const removeButton = document.createElement('button');
      removeButton.textContent = '×';
      removeButton.style.cssText = `
        background: #ff6b6b;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        color: white;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.3s ease;
      `;

      removeButton.addEventListener('click', () => {
        this.playerManager.removePlayer(player.id);
        this.updateDisplay();
      });

      playerInfo.appendChild(colorDot);
      playerInfo.appendChild(playerName);
      playerInfo.appendChild(sectorInfo);
      
      playerItem.appendChild(playerInfo);
      playerItem.appendChild(removeButton);
      
      this.playerListElement.appendChild(playerItem);
    });
  }

  /**
   * Update the color select dropdown
   */
  updateColorSelect() {
    this.colorSelect.innerHTML = '';
    
    const availableColors = this.playerManager.getAvailableColors();
    
    if (availableColors.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No colors available';
      option.disabled = true;
      this.colorSelect.appendChild(option);
      return;
    }

    availableColors.forEach(color => {
      const option = document.createElement('option');
      option.value = color;
      option.textContent = this.getColorName(color);
      option.style.cssText = `
        background: ${color};
        color: ${this.isLightColor(color) ? '#000' : '#fff'};
      `;
      this.colorSelect.appendChild(option);
    });
  }

  /**
   * Update the start button state
   */
  updateStartButton() {
    const canStart = this.playerManager.canStartGame(2);
    this.startButton.disabled = !canStart;
    this.startButton.style.opacity = canStart ? '1' : '0.5';
    this.startButton.style.cursor = canStart ? 'pointer' : 'not-allowed';
  }

  /**
   * Get a human-readable name for a color
   * @param {string} color - Hex color
   * @returns {string} Color name
   */
  getColorName(color) {
    const colorNames = {
      '#FF6B6B': 'Red',
      '#4ECDC4': 'Teal',
      '#45B7D1': 'Blue',
      '#96CEB4': 'Green',
      '#FFEAA7': 'Yellow',
      '#DDA0DD': 'Plum',
      '#FFB347': 'Orange',
      '#98D8C8': 'Mint',
      '#F7DC6F': 'Gold',
      '#BB8FCE': 'Purple',
      '#85C1E9': 'Sky Blue',
      '#F8C471': 'Peach',
      '#82E0AA': 'Light Green',
      '#F1948A': 'Light Red'
    };
    
    return colorNames[color] || color;
  }

  /**
   * Check if a color is light (for text contrast)
   * @param {string} color - Hex color
   * @returns {boolean} True if light color
   */
  isLightColor(color) {
    const rgb = this.playerManager.hexToRgb(color);
    if (!rgb) return false;
    
    // Calculate luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5;
  }

  /**
   * Show an error message
   * @param {string} message - Error message
   */
  showError(message) {
    // Create temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 3000;
      font-family: 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: fadeInOut 3s ease-in-out;
    `;
    errorDiv.textContent = message;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        10% { opacity: 1; transform: translateX(-50%) translateY(0); }
        90% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(errorDiv);
    
    // Remove after animation
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 3000);
  }

  /**
   * Show the player setup UI
   */
  show() {
    // Suppress UI in dev mode
    if (DEV_MODE) {
      console.log('🔧 DEV MODE: Suppressing player setup UI');
      return;
    }
    
    this.element.style.display = 'block';
    this.updateDisplay();
    this.nameInput.focus();
  }

  /**
   * Hide the player setup UI
   */
  hide() {
    this.element.style.display = 'none';
  }

  /**
   * Destroy the UI and clean up
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 