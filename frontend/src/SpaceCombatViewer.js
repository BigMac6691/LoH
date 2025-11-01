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
    
    // Create the panel
    this.createPanel();
    
    // Setup event listeners (will be attached when combat starts)
    this.setupEventListeners();
  }

  /**
   * Create the combat viewer panel with three sections
   */
  createPanel()
  {
    // Create main container
    this.dialog = document.createElement('div');
    this.dialog.id = 'combat-viewer-panel';
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
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    this.graphicalContainer = document.createElement('div');
    this.graphicalContainer.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
    `;
    
    const graphicalPlaceholder = document.createElement('div');
    graphicalPlaceholder.textContent = 'Graphical Combat Visualization';
    graphicalPlaceholder.style.cssText = `
      color: #888;
      text-align: center;
      font-size: 14px;
      font-style: italic;
    `;
    this.graphicalContainer.appendChild(graphicalPlaceholder);
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
      font-size: 12px;
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
    this.playButton = this.createControlButton('▶ Play', () => this.play());
    this.pauseButton = this.createControlButton('⏸ Pause', () => this.pause());
    this.stepButton = this.createControlButton('⏭ Step', () => this.step());
    this.replayButton = this.createControlButton('↻ Replay', () => this.replay());
    
    this.controlsSection.appendChild(this.playButton);
    this.controlsSection.appendChild(this.pauseButton);
    this.controlsSection.appendChild(this.stepButton);
    this.controlsSection.appendChild(this.replayButton);

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
   * Show the panel with combat event details and replay combat
   * @param {Object} event - The combat event object from turn_event table
   */
  show(event)
  {
    this.currentCombatEvent = event;
    this.eventHistory = [];
    this.textualLog.innerHTML = '';
    this.updateStatus('Initializing...');
    
    super.show();
    this.dialog.style.display = 'flex';
    
    // If we have initialShipStates and battleSeed, we can replay
    if (event.details && event.details.initialShipStates && event.details.battleSeed)
    {
      this.replayCombat(event.details);
    }
    else
    {
      this.addLogEntry('⚠️ Cannot replay: Missing initialShipStates or battleSeed');
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
    
    // Create SpaceCombat instance for replay
    this.combat = new SpaceCombat(starId, turnId, battleSeed, initialShipStates);
    
    // Attach event listeners
    for (const [eventName, handler] of Object.entries(this.eventHandlers))
    {
      this.combat.on(eventName, handler);
    }
    
    // Resolve combat (this will emit all events and our handlers will process them)
    this.combat.resolve();
  }

  // Event handlers (will display events as they arrive - debug mode for now)
  onCombatStart(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:start', event);
    this.addLogEntry(`⚔️ Combat Started at Star ${event.starId}`);
    this.addLogEntry(`   Battle Seed: ${event.battleSeed}`);
    this.addLogEntry(`   Players: ${event.playerIds.length}, Ships: ${event.initialShipStates.length}`);
    this.updateStatus('Combat started');
  }

  onRoundStart(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:roundStart', event);
    this.addLogEntry(`\n🔴 Round ${event.round} begins`);
    const activeShips = event.shipStates.filter(s => !s.destroyed);
    this.addLogEntry(`   Active ships: ${activeShips.length}`);
  }

  onAttack(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:attack', event);
    const hitMiss = event.isHit ? 'HITS' : 'MISSES';
    const damage = event.isHit ? ` for ${event.damage.toFixed(2)} damage` : '';
    this.addLogEntry(`   Ship ${event.attacker.id} (${event.attacker.owner_player}) ${hitMiss} Ship ${event.defender.id} (${event.defender.owner_player})${damage}`);
  }

  onDamage(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:damage', event);
    if (event.destroyed)
    {
      this.addLogEntry(`   💥 Ship ${event.shipId} DESTROYED!`);
    }
  }

  onShipDestroyed(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:shipDestroyed', event);
    // Already logged in onDamage, but keep for consistency
  }

  onRoundEnd(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:roundEnd', event);
    this.addLogEntry(`   Round ${event.round} ended - ${event.shipsLostThisRound} ship(s) destroyed, ${event.attacksThisRound} attack(s)`);
  }

  onCombatEnd(event)
  {
    console.log('🎬 SpaceCombatViewer: combat:end', event);
    const winnerText = event.winner ? `Player ${event.winner}` : 'None (mutual destruction)';
    this.addLogEntry(`\n🏁 Combat Ended after ${event.rounds} rounds`);
    this.addLogEntry(`   Winner: ${winnerText}`);
    this.addLogEntry(`   Remaining ships: ${event.remainingShips}`);
    this.addLogEntry(`   Ships lost:`, event.shipsLostByPlayer);
    this.updateStatus(`Complete - ${event.rounds} rounds`);
  }

  /**
   * Add an entry to the textual log
   */
  addLogEntry(text, data = null)
  {
    const entry = document.createElement('div');
    entry.style.cssText = `
      margin-bottom: 4px;
      padding: 2px 0;
    `;
    entry.textContent = data ? `${text} ${JSON.stringify(data)}` : text;
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
   * Playback control methods (stubs for now)
   */
  play()
  {
    console.log('🎬 SpaceCombatViewer: Play');
    this.updateStatus('Playing...');
    // TODO: Implement playback from event history
  }

  pause()
  {
    console.log('🎬 SpaceCombatViewer: Pause');
    this.updateStatus('Paused');
    // TODO: Implement pause
  }

  step()
  {
    console.log('🎬 SpaceCombatViewer: Step');
    this.updateStatus('Stepping...');
    // TODO: Implement step forward
  }

  replay()
  {
    console.log('🎬 SpaceCombatViewer: Replay');
    if (this.currentCombatEvent && this.currentCombatEvent.details)
    {
      this.textualLog.innerHTML = '';
      this.eventHistory = [];
      this.replayCombat(this.currentCombatEvent.details);
    }
  }
}
