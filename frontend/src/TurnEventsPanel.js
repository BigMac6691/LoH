import { BaseDialog } from './BaseDialog.js';
import { eventBus } from './eventBus.js';
import { SpaceCombatViewer } from './SpaceCombatViewer.js';
import { RB, ApiError } from './utils/RequestBuilder.js';

/**
 * TurnEventsPanel - A draggable panel for displaying turn events
 * Shows events for the current player in the current turn
 */
export class TurnEventsPanel extends BaseDialog
{
  constructor()
  {
    super(); // Call BaseDialog constructor

    console.log('📝 TurnEventsPanel: Constructor');
    
    this.currentGame = null;
    this.currentTurn = null;
    this.currentPlayer = null;
    this.events = [];
    this.isLoading = false;
    this.combatDetailsPanel = null;
    
    // Create the panel
    this.createPanel();
  }

  /**
   * Create the turn events panel
   */
  createPanel()
  {
    // Create main container
    this.dialog = document.createElement('div');
    this.dialog.id = 'turn-events-panel';
    this.dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-width: 90vw;
      height: 500px;
      max-height: 80vh;
      background: rgba(20, 20, 40, 0.95);
      border: 2px solid #00ff88;
      border-radius: 12px;
      box-shadow: 0 0 30px rgba(0, 255, 136, 0.3);
      backdrop-filter: blur(15px);
      z-index: 2000;
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
      border-bottom: 1px solid #00ff88;
      background: rgba(0, 255, 136, 0.1);
      border-radius: 10px 10px 0 0;
      cursor: move;
    `;

    this.title = document.createElement('h3');
    this.title.textContent = 'Previous Turn Events';
    this.title.style.cssText = `
      margin: 0;
      color: #00ff88;
      font-size: 18px;
      font-weight: bold;
    `;

    this.closeButton = document.createElement('button');
    this.closeButton.innerHTML = '✕';
    this.closeButton.style.cssText = `
      background: none;
      border: none;
      color: #00ff88;
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

    // Create content area
    this.content = document.createElement('div');
    this.content.style.cssText = `
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    // Create loading indicator
    this.loadingDiv = document.createElement('div');
    this.loadingDiv.textContent = 'Loading events...';
    this.loadingDiv.style.cssText = `
      text-align: center;
      color: #00ff88;
      font-size: 16px;
      padding: 20px;
    `;

    // Create events container
    this.eventsContainer = document.createElement('div');
    this.eventsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Create no events message
    this.noEventsDiv = document.createElement('div');
    this.noEventsDiv.textContent = 'No events found for the previous turn.';
    this.noEventsDiv.style.cssText = `
      text-align: center;
      color: #888;
      font-style: italic;
      padding: 20px;
    `;

    // Assemble the panel
    this.dialog.appendChild(this.header);
    this.dialog.appendChild(this.content);
    this.content.appendChild(this.loadingDiv);
    this.content.appendChild(this.eventsContainer);
    this.content.appendChild(this.noEventsDiv);

    // Add to DOM
    document.body.appendChild(this.dialog);

    // Setup drag functionality
    this.setupDragHandlers(this.header);
  }

  /**
   * Show the panel and load events
   */
  async show()
  {
    console.log('📝 TurnEventsPanel: Showing panel');

    if (!this.currentGame || !this.currentTurn || !this.currentPlayer)
    {
      console.warn('📝 TurnEventsPanel: Cannot show - missing game, turn, or player data', this.currentGame, this.currentTurn, this.currentPlayer);
      return;
    }

    super.show();
    this.dialog.style.display = 'flex';
    this.loadEvents();
  }

  /**
   * Load turn events for the current player from the previous turn
   */
  async loadEvents()
  {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try
    {
      // Get the previous turn ID (current turn number - 1)
      const previousTurnNumber = this.currentTurn.number - 1;
      
      if (previousTurnNumber < 1)
      {
        // No previous turn exists
        this.events = [];
        this.displayEvents();
        return;
      }

      // Get the previous turn ID by fetching turns for the game
      const previousTurnId = await this.getPreviousTurnId(previousTurnNumber);
      
      if (!previousTurnId)
      {
        // Previous turn not found
        this.events = [];
        this.displayEvents();
        return;
      }

      const result = await RB.fetchGet(
        `/api/turn-events/${this.currentGame.id}/${previousTurnId}/player/${eventBus.getContext().playerId}` // Use playerId, not user (user is user_id)
      );

      if (result.success)
      {
        this.events = result.events || [];
        this.displayEvents();
      }
      else
      {
        throw new Error(result.message || 'Failed to load events');
      }
    }
    catch (error)
    {
      console.error('📝 TurnEventsPanel: Error loading events:', error);
      this.showError(`Failed to load events: ${error.message}`);
    }
    finally
    {
      this.isLoading = false;
    }
  }

  /**
   * Get the previous turn ID by turn number
   */
  async getPreviousTurnId(turnNumber)
  {
    try
    {
      const result = await RB.fetchGet(`/api/games/${this.currentGame.id}/turns`);
      
      if (result.success && result.turns)
      {
        const previousTurn = result.turns.find(turn => turn.number === turnNumber);
        return previousTurn ? previousTurn.id : null;
      }
      
      return null;
    }
    catch (error)
    {
      console.error('📝 TurnEventsPanel: Error getting previous turn ID:', error);
      return null;
    }
  }

  /**
   * Show loading state
   */
  showLoading()
  {
    this.loadingDiv.style.display = 'block';
    this.eventsContainer.style.display = 'none';
    this.noEventsDiv.style.display = 'none';
  }

  /**
   * Show error message
   */
  showError(message)
  {
    this.loadingDiv.textContent = message;
    this.loadingDiv.style.color = '#ff4444';
    this.loadingDiv.style.display = 'block';
    this.eventsContainer.style.display = 'none';
    this.noEventsDiv.style.display = 'none';
  }

  /**
   * Display the loaded events
   */
  displayEvents()
  {
    this.loadingDiv.style.display = 'none';

    if (this.events.length === 0)
    {
      this.noEventsDiv.style.display = 'block';
      this.eventsContainer.style.display = 'none';
      return;
    }

    this.noEventsDiv.style.display = 'none';
    this.eventsContainer.style.display = 'flex';
    this.eventsContainer.innerHTML = '';

    // Group events by type for better organization
    const eventsByType = this.groupEventsByType(this.events);

    for (const [eventType, events] of Object.entries(eventsByType))
    {
      const typeSection = this.createEventTypeSection(eventType, events);
      this.eventsContainer.appendChild(typeSection);
    }
  }

  /**
   * Group events by type
   */
  groupEventsByType(events)
  {
    const grouped = {};
    for (const event of events)
    {
      if (!grouped[event.kind])
      {
        grouped[event.kind] = [];
      }
      grouped[event.kind].push(event);
    }
    return grouped;
  }

  /**
   * Create a section for events of a specific type
   */
  createEventTypeSection(eventType, events)
  {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 8px;
      overflow: hidden;
    `;

    // Section header
    const header = document.createElement('div');
    header.style.cssText = `
      background: rgba(0, 255, 136, 0.2);
      padding: 10px 15px;
      font-weight: bold;
      color: #00ff88;
      border-bottom: 1px solid rgba(0, 255, 136, 0.3);
    `;
    header.textContent = this.getEventTypeDisplayName(eventType);

    // Events list
    const eventsList = document.createElement('div');
    eventsList.style.cssText = `
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    for (const event of events)
    {
      const eventElement = this.createEventElement(event);
      eventsList.appendChild(eventElement);
    }

    section.appendChild(header);
    section.appendChild(eventsList);

    return section;
  }

  /**
   * Get display name for event type
   */
  getEventTypeDisplayName(eventType)
  {
    const typeNames = {
      'move': '🚀 Ship Movements',
      'combat': '⚔️ Battles',
      'star_capture': '⭐ Star Captures',
      'build.ships': '🏗️ Ship Production',
      'build.industry': '🏭 Industry Expansion',
      'build.research': '🔬 Technology Research',
      'turn_completion': '🔄 Turn Completion',
      'victory': '🏆 Victory',
      'defeat': '💀 Defeat'
    };
    return typeNames[eventType] || eventType;
  }

  /**
   * Create an individual event element
   */
  createEventElement(event)
  {
    const eventDiv = document.createElement('div');
    eventDiv.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #00ff88;
      font-size: 14px;
      line-height: 1.4;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    `;

    const details = event.details;
    let content = '';

    console.log(details);

    // Helper function to prepend "Auto " if from standing order
    const getAutoPrefix = (details) => {
      return details.fromStandingOrder ? 'Auto ' : '';
    };

    switch (event.kind)
    {
      case 'move':
        content = `${getAutoPrefix(details)}Moved ${details.shipsMoved} ship${details.shipsMoved !== 1 ? 's' : ''} from ${window.globalMapModel.getStarById(details.sourceStarId).getName()} to ${window.globalMapModel.getStarById(details.destinationStarId).getName()}`;
        break;
      case 'combat':
        const winnerName = window.globalPlayers?.get(details.winner)?.name || details.winner || 'None';
        content = `Battle at ${window.globalMapModel.getStarById(details.starId).getName()} won by ${winnerName}`;
        break;
      case 'star_capture':
        const previousOwnerName = window.globalPlayers?.get(details.previousOwner)?.name || details.previousOwner || 'None';
        content = `Captured ${window.globalMapModel.getStarById(details.starId).getName()} from ${previousOwnerName}`;
        break;
      case 'build.ships':
        content = `${getAutoPrefix(details)}Built ${details.shipsBuilt} ship${details.shipsBuilt !== 1 ? 's' : ''} (cost: ${details.totalCost}) at ${window.globalMapModel.getStarById(details.starId).getName()}`;
        break;
      case 'build.industry':
        content = `${getAutoPrefix(details)}Expanded industry: ${details.previousIndustry} → ${details.newIndustry} (spent: ${details.expansionSpent}) at ${window.globalMapModel.getStarById(details.starId).getName()}`;
        break;
      case 'build.research':
        content = `${getAutoPrefix(details)}Researched technology: ${details.previousTechnology} → ${details.newTechnology} (spent: ${details.researchSpent}) at ${window.globalMapModel.getStarById(details.starId).getName()}`;
        break;
      case 'turn_completion':
        content = details.message || 'Turn completed';
        break;
      case 'victory':
        content = '🏆 YOU WON! All opponents have been defeated!';
        eventDiv.style.borderLeftColor = '#ffd700';
        eventDiv.style.background = 'rgba(255, 215, 0, 0.2)';
        break;
      case 'defeat':
        content = '💀 YOU LOST! You no longer control any stars.';
        eventDiv.style.borderLeftColor = '#ff4444';
        eventDiv.style.background = 'rgba(255, 68, 68, 0.2)';
        break;
      default:
        content = JSON.stringify(details);
    }

    const contentSpan = document.createElement('span');
    contentSpan.textContent = content;
    contentSpan.style.flex = '1';
    eventDiv.appendChild(contentSpan);

    // Add details link for combat events
    if (event.kind === 'combat')
    {
      const detailsLink = document.createElement('a');
      detailsLink.textContent = 'details';
      detailsLink.href = '#';
      detailsLink.style.cssText = `
        color: #00ff88;
        text-decoration: none;
        font-size: 12px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      `;
      
      detailsLink.addEventListener('mouseenter', () => {
        detailsLink.style.background = 'rgba(0, 255, 136, 0.2)';
      });
      
      detailsLink.addEventListener('mouseleave', () => {
        detailsLink.style.background = 'none';
      });
      
      detailsLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showCombatDetails(event);
      });
      
      eventDiv.appendChild(detailsLink);
    }

    return eventDiv;
  }

  /**
   * Show combat details panel
   * @param {Object} event - The combat event object
   */
  showCombatDetails(event)
  {
    if (!this.combatDetailsPanel)
    {
      this.combatDetailsPanel = new SpaceCombatViewer();
    }
    this.combatDetailsPanel.show(event);
  }
}
