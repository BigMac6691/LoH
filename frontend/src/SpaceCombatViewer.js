import { BaseDialog } from './BaseDialog.js';
import { SpaceCombat } from '@loh/shared';

/**
 * SpaceCombatViewer - Displays and visualizes combat events from SpaceCombat
 * Has three main sections: graphical representation, textual log, and playback controls
 */
export class SpaceCombatViewer extends BaseDialog
{
  constructor()
  {
    super(); // Call BaseDialog constructor
    
    this.currentCombatEvent = null; // Combat event from turn_event table
    this.combat = null; // SpaceCombat instance for replay
    this.eventHistory = []; // Store all events for playback
    this.isPlaying = false; // Playback state
    this.isPaused = false; // Pause state
    this.currentEventIndex = 0; // Current position in event history
    this.playbackSpeed = 1; // Playback speed multiplier
    this.playbackTimer = null; // Timer for automated playback
    
    // Ship tracking for graphical display
    this.shipsByPlayer = new Map(); // playerId -> array of ship display objects
    this.playerColors = new Map(); // playerId -> color
    
    // Create the panel
    this.createPanel();
    
    // Setup event listeners (will be attached when combat starts)
    this.setupEventListeners();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Create the combat viewer panel with three sections
   */
  createPanel()
  {
    // Create main container
    this.dialog = document.createElement('div');
    this.dialog.id = 'combat-viewer-panel';
    this.dialog.tabIndex = -1; // Make focusable for keyboard shortcuts
    this.dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 900px;
      max-width: 95vw;
      height: 700px;
      max-height: 90vh;
      background: rgba(20, 20, 40, 0.95);
      border: 2px solid #ff6b6b;
      border-radius: 12px;
      box-shadow: 0 0 30px rgba(255, 107, 107, 0.3);
      backdrop-filter: blur(15px);
      z-index: 2001;
      display: none;
      flex-direction: column;
      font-family: 'Courier New', monospace;
      color: #ffffff;
    `;

    // Create header
    this.header = document.createElement('div');
    this.header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      border-bottom: 1px solid #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
      border-radius: 10px 10px 0 0;
      cursor: move;
    `;

    this.title = document.createElement('h3');
    this.title.textContent = 'Combat Viewer';
    this.title.style.cssText = `
      margin: 0;
      color: #ff6b6b;
      font-size: 18px;
      font-weight: bold;
    `;

    this.closeButton = document.createElement('button');
    this.closeButton.innerHTML = '✕';
    this.closeButton.style.cssText = `
      background: none;
      border: none;
      color: #ff6b6b;
      font-size: 20px;
      cursor: pointer;
      padding: 5px;
      border-radius: 3px;
      transition: background 0.2s;
    `;

    this.closeButton.addEventListener('mouseenter', () => {
      this.closeButton.style.background = 'rgba(255, 0, 0, 0.3)';
    });

    this.closeButton.addEventListener('mouseleave', () => {
      this.closeButton.style.background = 'none';
    });

    this.closeButton.addEventListener('click', () => this.hide());

    this.header.appendChild(this.title);
    this.header.appendChild(this.closeButton);

    // Create content area with three sections
    this.content = document.createElement('div');
    this.content.style.cssText = `
      flex: 1;
      padding: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 15px;
    `;

    // Section 1: Graphical representation (top)
    this.graphicalSection = document.createElement('div');
    this.graphicalSection.id = 'combat-graphical-section';
    this.graphicalSection.style.cssText = `
      height: 200px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 8px;
      padding: 15px;
      overflow-y: auto;
      overflow-x: hidden;
    `;
    
    this.graphicalContainer = document.createElement('div');
    this.graphicalContainer.id = 'combat-graphical-container';
    this.graphicalContainer.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    
    // Round indicator
    this.roundIndicator = document.createElement('div');
    this.roundIndicator.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #ff6b6b;
      margin-bottom: 5px;
    `;
    this.roundIndicator.textContent = 'Round 0';
    
    // Ship groups container
    this.shipGroupsContainer = document.createElement('div');
    this.shipGroupsContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      align-items: flex-start;
    `;
    
    this.graphicalContainer.appendChild(this.roundIndicator);
    this.graphicalContainer.appendChild(this.shipGroupsContainer);
    this.graphicalSection.appendChild(this.graphicalContainer);

    // Section 2: Textual representation (middle, scrollable)
    this.textualSection = document.createElement('div');
    this.textualSection.id = 'combat-textual-section';
    this.textualSection.style.cssText = `
      flex: 1;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 8px;
      padding: 15px;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
    `;
    
    this.textualLog = document.createElement('div');
    this.textualLog.id = 'combat-textual-log';
    this.textualLog.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.6;
      color: #ffffff;
    `;
    this.textualSection.appendChild(this.textualLog);

    // Section 3: Playback controls (bottom)
    this.controlsSection = document.createElement('div');
    this.controlsSection.id = 'combat-controls-section';
    this.controlsSection.style.cssText = `
      height: 60px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 8px;
      padding: 10px 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    `;

    // Playback control buttons
    this.playButton = this.createControlButton('▶ Play (Space)', () => this.play());
    this.pauseButton = this.createControlButton('⏸ Pause (Space)', () => this.pause());
    this.stepButton = this.createControlButton('⏭ Step (→)', () => this.step());
    this.replayButton = this.createControlButton('↻ Replay (R)', () => this.replay());
    
    this.controlsSection.appendChild(this.playButton);
    this.controlsSection.appendChild(this.pauseButton);
    this.controlsSection.appendChild(this.stepButton);
    this.controlsSection.appendChild(this.replayButton);

    // Speed control
    const speedLabel = document.createElement('span');
    speedLabel.textContent = 'Speed:';
    speedLabel.style.cssText = `
      margin-left: 20px;
      margin-right: 5px;
      font-size: 12px;
      color: #ccc;
    `;
    
    this.speedSlider = document.createElement('input');
    this.speedSlider.type = 'range';
    this.speedSlider.min = '0.5';
    this.speedSlider.max = '4';
    this.speedSlider.step = '0.5';
    this.speedSlider.value = '1';
    this.speedSlider.style.cssText = `
      width: 100px;
      margin-right: 10px;
    `;
    this.speedSlider.addEventListener('input', (e) => {
      this.playbackSpeed = parseFloat(e.target.value);
      this.speedValue.textContent = `${this.playbackSpeed}x`;
    });
    
    this.speedValue = document.createElement('span');
    this.speedValue.textContent = '1x';
    this.speedValue.style.cssText = `
      font-size: 12px;
      color: #ff6b6b;
      min-width: 30px;
      display: inline-block;
    `;
    
    // Progress indicator
    this.progressIndicator = document.createElement('div');
    this.progressIndicator.textContent = '0 / 0';
    this.progressIndicator.style.cssText = `
      margin-left: 20px;
      padding: 8px 15px;
      background: rgba(255, 107, 107, 0.2);
      border-radius: 4px;
      font-size: 12px;
      color: #ff6b6b;
    `;
    
    // Status indicator
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.textContent = 'Ready';
    this.statusIndicator.style.cssText = `
      margin-left: 20px;
      padding: 8px 15px;
      background: rgba(255, 107, 107, 0.2);
      border-radius: 4px;
      font-size: 12px;
      color: #ff6b6b;
    `;
    
    this.controlsSection.appendChild(speedLabel);
    this.controlsSection.appendChild(this.speedSlider);
    this.controlsSection.appendChild(this.speedValue);
    this.controlsSection.appendChild(this.progressIndicator);
    this.controlsSection.appendChild(this.statusIndicator);

    // Assemble the panel
    this.dialog.appendChild(this.header);
    this.dialog.appendChild(this.content);
    this.content.appendChild(this.graphicalSection);
    this.content.appendChild(this.textualSection);
    this.content.appendChild(this.controlsSection);

    // Add to DOM
    document.body.appendChild(this.dialog);

    // Setup drag functionality
    this.setupDragHandlers(this.header);
  }

  /**
   * Create a control button
   */
  createControlButton(text, onClick)
  {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      padding: 8px 15px;
      background: rgba(255, 107, 107, 0.2);
      border: 1px solid rgba(255, 107, 107, 0.5);
      border-radius: 4px;
      color: #ff6b6b;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 107, 107, 0.4)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 107, 107, 0.2)';
    });
    
    button.addEventListener('click', onClick);
    
    return button;
  }

  /**
   * Setup event listeners for SpaceCombat events
   */
  setupEventListeners()
  {
    // These will be attached when we create a SpaceCombat instance
    // For now, just initialize the handler references
    this.eventHandlers = {
      'combat:start': (event) => this.onCombatStart(event),
      'combat:roundStart': (event) => this.onRoundStart(event),
      'combat:attack': (event) => this.onAttack(event),
      'combat:damage': (event) => this.onDamage(event),
      'combat:shipDestroyed': (event) => this.onShipDestroyed(event),
      'combat:roundEnd': (event) => this.onRoundEnd(event),
      'combat:end': (event) => this.onCombatEnd(event)
    };
  }
  
  /**
   * Setup keyboard shortcuts for playback controls
   */
  setupKeyboardShortcuts()
  {
    this.keyboardHandler = (e) => {
      // Only handle keys when the panel is visible
      if (!this.dialog || this.dialog.style.display === 'none' || this.dialog.style.display === '') return;
      
      // Don't handle shortcuts if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch (e.key) {
        case ' ': // Spacebar - Play/Pause toggle
          e.preventDefault();
          if (this.isPlaying && !this.isPaused) {
            this.pause();
          } else {
            this.play();
          }
          break;
        case 'ArrowRight': // Right arrow - Step forward
          e.preventDefault();
          this.step();
          break;
        case 'r':
        case 'R': // R - Replay
          e.preventDefault();
          this.replay();
          break;
        case 'ArrowLeft': // Left arrow - Step backward (future feature)
          e.preventDefault();
          // TODO: Implement step backward
          break;
      }
    };
    
    document.addEventListener('keydown', this.keyboardHandler);
  }
  
  /**
   * Clean up keyboard listeners on dispose
   */
  dispose()
  {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }
    super.dispose();
  }

  /**
   * Show the panel with combat event details and replay combat
   * @param {Object} event - The combat event object from turn_event table
   */
  show(event)
  {
    this.currentCombatEvent = event;
    this.eventHistory = [];
    this.currentEventIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.textualLog.innerHTML = '';
    this.graphicalContainer.innerHTML = '';
    this.shipsByPlayer.clear();
    this.playerColors.clear();
    
    // Clear any existing playback timer
    if (this.playbackTimer)
    {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    
    this.updateStatus('Initializing...');
    this.updateProgress();
    
    super.show();
    this.dialog.style.display = 'flex';
    
    // Focus the dialog to enable keyboard shortcuts
    this.dialog.focus();
    
    // If we have initialShipStates and battleSeed, we can replay
    if (event.details && event.details.initialShipStates && event.details.battleSeed)
    {
      this.replayCombat(event.details);
    }
    else
    {
      this.addLogEntry('⚠️ Cannot replay: Missing initialShipStates or battleSeed', 'error');
      this.updateStatus('Cannot replay');
    }
  }

  /**
   * Replay combat from saved event data
   */
  replayCombat(combatDetails)
  {
    const { starId, battleSeed, initialShipStates } = combatDetails;
    const turnId = this.currentCombatEvent.turn_id; // Get from the event record
    
    console.log('🎬 SpaceCombatViewer: Starting replay', { starId, turnId, battleSeed, shipCount: initialShipStates.length });
    
    // Generate player colors
    const playerIds = [...new Set(initialShipStates.map(s => s.owner_player))];
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe'];
    playerIds.forEach((playerId, index) => {
      this.playerColors.set(playerId, colors[index % colors.length]);
    });
    
    // Create SpaceCombat instance for replay
    this.combat = new SpaceCombat(starId, turnId, battleSeed, initialShipStates);
    
    // Attach event listeners that store events in history
    this.combat.on('combat:start', (event) => {
      this.eventHistory.push({ type: 'combat:start', data: event });
      if (!this.isPlaying) this.onCombatStart(event);
    });
    
    this.combat.on('combat:roundStart', (event) => {
      this.eventHistory.push({ type: 'combat:roundStart', data: event });
      if (!this.isPlaying) this.onRoundStart(event);
    });
    
    this.combat.on('combat:attack', (event) => {
      this.eventHistory.push({ type: 'combat:attack', data: event });
      if (!this.isPlaying) this.onAttack(event);
    });
    
    this.combat.on('combat:damage', (event) => {
      this.eventHistory.push({ type: 'combat:damage', data: event });
      if (!this.isPlaying) this.onDamage(event);
    });
    
    this.combat.on('combat:shipDestroyed', (event) => {
      this.eventHistory.push({ type: 'combat:shipDestroyed', data: event });
      if (!this.isPlaying) this.onShipDestroyed(event);
    });
    
    this.combat.on('combat:roundEnd', (event) => {
      this.eventHistory.push({ type: 'combat:roundEnd', data: event });
      if (!this.isPlaying) this.onRoundEnd(event);
    });
    
    this.combat.on('combat:end', (event) => {
      this.eventHistory.push({ type: 'combat:end', data: event });
      if (!this.isPlaying) this.onCombatEnd(event);
    });
    
    // Resolve combat (this will emit all events and our handlers will process them)
    this.combat.resolve();
    
    this.updateProgress();
  }

  // Event handlers (will display events as they arrive)
  onCombatStart(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:start', event);
    
    // Initialize graphical display with initial ships
    this.initializeGraphicalDisplay(event);
    
    // Textual log
    this.addLogEntry(`⚔️ COMBAT STARTED`, 'header');
    const starName = window.globalMapModel?.getStarById(event.starId)?.getName() || event.starId;
    this.addLogEntry(`   Location: ${starName}`, 'info');
    this.addLogEntry(`   Battle Seed: ${event.battleSeed}`, 'info');
    this.addLogEntry(`   Players: ${event.playerIds.length}`, 'info');
    this.addLogEntry(`   Total Ships: ${event.initialShipStates.length}`, 'info');
    
    // Ship breakdown by player
    const shipsByPlayer = new Map();
    event.initialShipStates.forEach(ship => {
      if (!shipsByPlayer.has(ship.owner_player)) {
        shipsByPlayer.set(ship.owner_player, []);
      }
      shipsByPlayer.get(ship.owner_player).push(ship);
    });
    
    shipsByPlayer.forEach((ships, playerId) => {
      const playerName = window.globalPlayers?.get(playerId)?.name || playerId;
      this.addLogEntry(`   ${playerName}: ${ships.length} ship(s)`, 'player');
    });
    
    this.updateStatus('Combat started');
  }
  
  /**
   * Initialize graphical display with ships
   */
  initializeGraphicalDisplay(event)
  {
    this.graphicalContainer.innerHTML = '';
    
    // Round indicator
    this.roundIndicator = document.createElement('div');
    this.roundIndicator.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #ff6b6b;
      margin-bottom: 10px;
    `;
    this.roundIndicator.textContent = 'Round 0 - Initial Setup';
    
    // Ship groups container
    this.shipGroupsContainer = document.createElement('div');
    this.shipGroupsContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      align-items: flex-start;
    `;
    
    this.graphicalContainer.appendChild(this.roundIndicator);
    this.graphicalContainer.appendChild(this.shipGroupsContainer);
    
    // Group ships by player
    const shipsByPlayer = new Map();
    event.initialShipStates.forEach(ship => {
      if (!shipsByPlayer.has(ship.owner_player)) {
        shipsByPlayer.set(ship.owner_player, []);
      }
      shipsByPlayer.get(ship.owner_player).push(ship);
    });
    
    // Create player groups
    shipsByPlayer.forEach((ships, playerId) => {
      this.createPlayerShipGroup(playerId, ships);
    });
  }
  
  /**
   * Create a visual group for a player's ships
   */
  createPlayerShipGroup(playerId, ships)
  {
    const playerName = window.globalPlayers?.get(playerId)?.name || `Player ${playerId.slice(-4)}`;
    const playerColor = this.playerColors.get(playerId) || '#ffffff';
    
    const group = document.createElement('div');
    group.style.cssText = `
      border: 2px solid ${playerColor};
      border-radius: 8px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.3);
      min-width: 200px;
    `;
    
    const label = document.createElement('div');
    label.textContent = playerName;
    label.style.cssText = `
      font-weight: bold;
      color: ${playerColor};
      margin-bottom: 8px;
      font-size: 12px;
    `;
    group.appendChild(label);
    
    const shipsContainer = document.createElement('div');
    shipsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 5px;
    `;
    
    ships.forEach(ship => {
      const shipDisplay = this.createShipDisplay(ship, playerColor);
      shipsContainer.appendChild(shipDisplay);
    });
    
    group.appendChild(shipsContainer);
    this.shipGroupsContainer.appendChild(group);
    
    // Store reference
    if (!this.shipsByPlayer.has(playerId)) {
      this.shipsByPlayer.set(playerId, new Map());
    }
    ships.forEach(ship => {
      this.shipsByPlayer.get(playerId).set(ship.id, { element: group, ship: ship });
    });
  }
  
  /**
   * Create a ship display element
   */
  createShipDisplay(ship, color)
  {
    const shipDiv = document.createElement('div');
    shipDiv.id = `ship-${ship.id}`;
    shipDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px;
      border-left: 3px solid ${color};
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
    `;
    
    const shipId = document.createElement('span');
    shipId.textContent = `Ship ${ship.id.slice(-4)}`;
    shipId.style.cssText = `
      font-size: 10px;
      color: #ccc;
      min-width: 60px;
    `;
    
    const hpBar = document.createElement('div');
    hpBar.style.cssText = `
      flex: 1;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    `;
    
    const hpFill = document.createElement('div');
    hpFill.id = `ship-hp-${ship.id}`;
    const hpPercent = Math.min(100, (ship.hp / ship.power) * 100);
    hpFill.style.cssText = `
      height: 100%;
      width: ${hpPercent}%;
      background: ${hpPercent > 50 ? '#4ecdc4' : hpPercent > 25 ? '#f9ca24' : '#ff6b6b'};
      transition: width 0.3s, background 0.3s;
    `;
    
    hpBar.appendChild(hpFill);
    
    const hpText = document.createElement('span');
    hpText.id = `ship-hp-text-${ship.id}`;
    hpText.textContent = `${ship.hp.toFixed(1)}/${ship.power}`;
    hpText.style.cssText = `
      font-size: 9px;
      color: #888;
      min-width: 50px;
      text-align: right;
    `;
    
    shipDiv.appendChild(shipId);
    shipDiv.appendChild(hpBar);
    shipDiv.appendChild(hpText);
    
    return shipDiv;
  }

  onRoundStart(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:roundStart', event);
    
    // Update round indicator
    if (this.roundIndicator) {
      this.roundIndicator.textContent = `Round ${event.round}`;
    }
    
    // Update graphical display with current ship states
    this.updateGraphicalDisplay(event.shipStates);
    
    // Textual log
    this.addLogEntry(`\n🔴 ROUND ${event.round}`, 'round-header');
    const activeShips = event.shipStates.filter(s => !s.destroyed);
    this.addLogEntry(`   Active ships: ${activeShips.length}`, 'info');
  }
  
  /**
   * Update graphical display with current ship states
   */
  updateGraphicalDisplay(shipStates)
  {
    shipStates.forEach(ship => {
      // Find the ship in our display
      let found = false;
      for (const [playerId, ships] of this.shipsByPlayer.entries()) {
        if (ships.has(ship.id)) {
          found = true;
          this.updateShipDisplay(ship);
          break;
        }
      }
      
      // If ship not found (shouldn't happen), log it
      if (!found) {
        console.warn('🎬 SpaceCombatViewer: Ship not found in display:', ship.id);
      }
    });
  }
  
  /**
   * Update a single ship's display
   */
  updateShipDisplay(ship)
  {
    const hpFill = document.getElementById(`ship-hp-${ship.id}`);
    const hpText = document.getElementById(`ship-hp-text-${ship.id}`);
    const shipDiv = document.getElementById(`ship-${ship.id}`);
    
    if (!hpFill || !hpText) return;
    
    if (ship.destroyed) {
      // Hide destroyed ship
      if (shipDiv) {
        shipDiv.style.opacity = '0.3';
        shipDiv.style.textDecoration = 'line-through';
      }
      hpFill.style.width = '0%';
      hpFill.style.background = '#666';
      hpText.textContent = 'DESTROYED';
    } else {
      const hpPercent = Math.min(100, (ship.hp / ship.power) * 100);
      hpFill.style.width = `${hpPercent}%`;
      hpFill.style.background = hpPercent > 50 ? '#4ecdc4' : hpPercent > 25 ? '#f9ca24' : '#ff6b6b';
      hpText.textContent = `${ship.hp.toFixed(1)}/${ship.power}`;
      
      if (shipDiv) {
        shipDiv.style.opacity = '1';
        shipDiv.style.textDecoration = 'none';
      }
    }
  }

  onAttack(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:attack', event);
    
    const attackerName = this.getPlayerName(event.attacker.owner_player);
    const defenderName = this.getPlayerName(event.defender.owner_player);
    const attackerShortId = event.attacker.id.slice(-4);
    const defenderShortId = event.defender.id.slice(-4);
    
    if (event.isHit) {
      this.addLogEntry(
        `   ⚔️ ${attackerName}'s Ship ${attackerShortId} → HITS → ${defenderName}'s Ship ${defenderShortId} (${event.damage.toFixed(2)} damage)`,
        'hit'
      );
    } else {
      this.addLogEntry(
        `   ⚔️ ${attackerName}'s Ship ${attackerShortId} → MISSES → ${defenderName}'s Ship ${defenderShortId}`,
        'miss'
      );
    }
  }
  
  /**
   * Get player name by ID
   */
  getPlayerName(playerId)
  {
    return window.globalPlayers?.get(playerId)?.name || `Player ${playerId.slice(-4)}`;
  }

  onDamage(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:damage', event);
    
    // Update graphical display
    // Find ship in current state and update it
    for (const [playerId, ships] of this.shipsByPlayer.entries()) {
      if (ships.has(event.shipId)) {
        const shipInfo = ships.get(event.shipId);
        if (shipInfo && shipInfo.ship) {
          shipInfo.ship.hp = event.hpAfter;
          shipInfo.ship.destroyed = event.destroyed;
          this.updateShipDisplay(shipInfo.ship);
        }
        break;
      }
    }
    
    if (event.destroyed) {
      const playerName = this.getPlayerName(event.ownerId);
      this.addLogEntry(`   💥 ${playerName}'s Ship ${event.shipId.slice(-4)} DESTROYED!`, 'destroyed');
    }
  }

  onShipDestroyed(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:shipDestroyed', event);
    // Visual update already handled in onDamage
  }

  onRoundEnd(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:roundEnd', event);
    this.addLogEntry(
      `   Round ${event.round} summary: ${event.shipsLostThisRound} ship(s) destroyed, ${event.attacksThisRound} attack(s)`,
      'round-summary'
    );
  }

  onCombatEnd(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:end', event);
    
    const winnerName = event.winner ? this.getPlayerName(event.winner) : 'None (mutual destruction)';
    this.addLogEntry(`\n🏁 COMBAT ENDED`, 'header');
    this.addLogEntry(`   Total Rounds: ${event.rounds}`, 'info');
    this.addLogEntry(`   Winner: ${winnerName}`, event.winner ? 'winner' : 'info');
    this.addLogEntry(`   Remaining Ships: ${event.remainingShips}`, 'info');
    
    // Ships lost breakdown
    if (Object.keys(event.shipsLostByPlayer).length > 0) {
      this.addLogEntry(`   Ships Lost:`, 'info');
      for (const [playerId, lost] of Object.entries(event.shipsLostByPlayer)) {
        if (lost > 0) {
          const playerName = this.getPlayerName(playerId);
          this.addLogEntry(`     ${playerName}: ${lost} ship(s)`, 'player');
        }
      }
    }
    
    this.updateStatus(`Complete - ${event.rounds} rounds`);
    this.updateProgress();
  }

  /**
   * Add an entry to the textual log with styling
   */
  addLogEntry(text, type = 'normal')
  {
    const entry = document.createElement('div');
    entry.style.cssText = `
      margin-bottom: 3px;
      padding: 3px 5px;
    `;
    
    // Apply type-based styling
    switch (type) {
      case 'header':
        entry.style.cssText += `
          font-weight: bold;
          font-size: 13px;
          color: #ff6b6b;
          margin-top: 8px;
          margin-bottom: 4px;
        `;
        break;
      case 'round-header':
        entry.style.cssText += `
          font-weight: bold;
          font-size: 12px;
          color: #f9ca24;
          margin-top: 6px;
          margin-bottom: 4px;
        `;
        break;
      case 'hit':
        entry.style.cssText += `
          color: #4ecdc4;
          margin-left: 10px;
        `;
        break;
      case 'miss':
        entry.style.cssText += `
          color: #888;
          margin-left: 10px;
          font-style: italic;
        `;
        break;
      case 'destroyed':
        entry.style.cssText += `
          color: #ff6b6b;
          font-weight: bold;
          margin-left: 10px;
        `;
        break;
      case 'winner':
        entry.style.cssText += `
          color: #4ecdc4;
          font-weight: bold;
        `;
        break;
      case 'info':
        entry.style.cssText += `
          color: #ccc;
          margin-left: 10px;
        `;
        break;
      case 'player':
        entry.style.cssText += `
          color: #f9ca24;
          margin-left: 15px;
        `;
        break;
      case 'round-summary':
        entry.style.cssText += `
          color: #888;
          font-style: italic;
          margin-left: 10px;
          margin-bottom: 6px;
        `;
        break;
      case 'error':
        entry.style.cssText += `
          color: #ff6b6b;
          font-weight: bold;
        `;
        break;
      default:
        entry.style.cssText += `
          color: #ffffff;
        `;
    }
    
    entry.textContent = text;
    this.textualLog.appendChild(entry);
    
    // Auto-scroll to bottom
    this.textualSection.scrollTop = this.textualSection.scrollHeight;
  }

  /**
   * Update status indicator
   */
  updateStatus(status)
  {
    this.statusIndicator.textContent = status;
  }
  
  /**
   * Update progress indicator
   */
  updateProgress()
  {
    const total = this.eventHistory.length;
    this.progressIndicator.textContent = `${this.currentEventIndex} / ${total}`;
  }

  /**
   * Playback control methods
   */
  play()
  {
    console.log('🎬 SpaceCombatViewer: Play');
    
    if (this.currentEventIndex >= this.eventHistory.length) {
      // Already at end, restart
      this.currentEventIndex = 0;
      this.clearDisplay();
      this.isPaused = false;
    }
    
    this.isPlaying = true;
    this.isPaused = false;
    this.updateStatus('Playing...');
    this.processNextEvent();
  }
  
  /**
   * Process next event in playback
   */
  processNextEvent()
  {
    if (!this.isPlaying || this.isPaused) return;
    
    if (this.currentEventIndex >= this.eventHistory.length) {
      // Reached end
      this.isPlaying = false;
      this.updateStatus('Complete');
      return;
    }
    
    const eventRecord = this.eventHistory[this.currentEventIndex];
    const handler = this.eventHandlers[eventRecord.type];
    
    if (handler) {
      handler(eventRecord.data);
    }
    
    this.currentEventIndex++;
    this.updateProgress();
    
    // Schedule next event based on playback speed
    // Base delay is ~33ms (3x faster than original 100ms)
    const baseDelay = 500; // Base delay between events (3x faster)
    const delay = baseDelay / this.playbackSpeed;
    
    this.playbackTimer = setTimeout(() => {
      this.processNextEvent();
    }, delay);
  }

  pause()
  {
    console.log('🎬 SpaceCombatViewer: Pause');
    this.isPaused = true;
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.updateStatus('Paused');
  }

  step()
  {
    console.log('🎬 SpaceCombatViewer: Step');
    
    // Stop any ongoing playback
    this.pause();
    
    if (this.currentEventIndex >= this.eventHistory.length) {
      this.updateStatus('At end');
      return;
    }
    
    const eventRecord = this.eventHistory[this.currentEventIndex];
    const handler = this.eventHandlers[eventRecord.type];
    
    if (handler) {
      handler(eventRecord.data);
    }
    
    this.currentEventIndex++;
    this.updateProgress();
    this.updateStatus(`Stepped to ${this.currentEventIndex} / ${this.eventHistory.length}`);
  }

  replay()
  {
    console.log('🎬 SpaceCombatViewer: Replay');
    this.pause();
    this.currentEventIndex = 0;
    this.clearDisplay();
    
    if (this.currentCombatEvent && this.currentCombatEvent.details) {
      // Clear event history and replay
      this.eventHistory = [];
      this.updateProgress();
      
      // Temporarily set isPlaying to true so events are stored but not immediately displayed
      this.isPlaying = true;
      this.replayCombat(this.currentCombatEvent.details);
      // After replay, set back to false and ready to play
      this.isPlaying = false;
      this.updateStatus('Ready to play');
    }
  }
  
  /**
   * Clear display for replay
   */
  clearDisplay()
  {
    this.textualLog.innerHTML = '';
    this.graphicalContainer.innerHTML = '';
    this.shipsByPlayer.clear();
  }
}
