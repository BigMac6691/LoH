import { MoveOrder, moveOrderStore } from '@loh/shared';
import { getShipDisplayName } from './utils/shipGrouping.js';
import { eventBus } from './eventBus.js';

/**
 * MoveDialog - A draggable dialog for managing fleet movement
 * Shows connected stars for movement selection and hierarchical ship tree
 */
export class MoveDialog
{
  constructor()
  {
    this.isVisible = false;
    this.currentStar = null;
    this.dialog = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.selectedDestination = null;
    this.currentPlayer = null;
    this.currentMoveOrder = null;
    this.selectedShipIds = new Set();
    this.starLookupFunction = null; // Function to look up stars by ID
    this.loadedOrders = []; // Track orders loaded from database
    
    this.createDialog();
    this.setupEventListeners();
  }

  /**
   * Set the star lookup function for getting connected stars
   * @param {Function} lookupFn - Function that takes a star ID and returns a Star object
   * @deprecated Use global MapModel instead
   */
  setStarLookupFunction(lookupFn) {
    this.starLookupFunction = lookupFn;
  }

  /**
   * Get star lookup function from global MapModel
   * @returns {Function|null} Star lookup function or null if no global MapModel
   */
  getStarLookupFunction() {
    if (window.globalMapModel && typeof window.globalMapModel.getStarById === 'function') {
      return (starId) => window.globalMapModel.getStarById(starId);
    }
    return null;
  }

  /**
   * Set up event listeners for order responses
   */
  setupEventListeners() {
    // Listen for order submission success
    eventBus.on('order:submitSuccess', this.handleOrderSubmitSuccess.bind(this));
    
    // Listen for order submission error
    eventBus.on('order:submitError', this.handleOrderSubmitError.bind(this));
    
    // Listen for order loading success
    eventBus.on('order:loadSuccess', this.handleOrderLoadSuccess.bind(this));
    
    // Listen for order loading error
    eventBus.on('order:loadError', this.handleOrderLoadError.bind(this));
    
    console.log('🚀 MoveDialog: Event listeners set up');
  }

  /**
   * Handle order submission success
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing order information
   */
  handleOrderSubmitSuccess(context, eventData) {
    console.log('🚀 MoveDialog: Order submitted successfully:', eventData);
    
    // Check if this is a move order for the current star
    if (eventData.details.orderType === 'move' && 
        eventData.details.payload?.sourceStarId === this.currentStar?.getId()) {
      
      // Update UI to reflect the saved order
      this.updateConnectedStarsList(); // Refresh rocket icons
      this.updateMoveButton();
      
      // Show confirmation
      const fromStar = this.currentStar.getName ? this.currentStar.getName() : `Star ${this.currentStar.id}`;
      const toStar = this.selectedDestination?.getName ? this.selectedDestination.getName() : `Star ${this.selectedDestination?.id}`;
      this.showMoveConfirmation(fromStar, toStar);
    }
  }

  /**
   * Handle order submission error
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing error information
   */
  handleOrderSubmitError(context, eventData) {
    console.error('🚀 MoveDialog: Order submission failed:', eventData);
    
    // Check if this is a move order for the current star
    if (eventData.details.orderType === 'move' && 
        eventData.details.payload?.sourceStarId === this.currentStar?.getId()) {
      
      // Show error message to user
      alert(`Failed to submit move order: ${eventData.error}`);
    }
  }

  /**
   * Handle order loading success
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing loaded orders
   */
  handleOrderLoadSuccess(context, eventData) {
    console.log('🚀 MoveDialog: Orders loaded successfully:', eventData);
    
    // Check if this is for the current star
    if (eventData.details.starId === this.currentStar?.getId()) {
      // Store loaded orders
      this.loadedOrders = eventData.details.orders || [];
      
      // Find move orders for the selected destination
      const moveOrders = this.loadedOrders.filter(order => order.order_type === 'move');
      
      if (this.selectedDestination) {
        const orderForDestination = moveOrders.find(order => 
          order.payload && order.payload.destinationStarId === this.selectedDestination.id
        );
        
        if (orderForDestination) {
          // Load the order data
          this.currentMoveOrder = orderForDestination;
          this.selectedShipIds = new Set(orderForDestination.payload.selectedShipIds || []);
          console.log('🚀 MoveDialog: Loaded order for destination:', this.selectedDestination.getName ? this.selectedDestination.getName() : `Star ${this.selectedDestination.id}`);
        } else {
          // Clear selection if no order for this destination
          this.selectedShipIds.clear();
          this.currentMoveOrder = null;
          console.log('🚀 MoveDialog: No order found for destination:', this.selectedDestination.getName ? this.selectedDestination.getName() : `Star ${this.selectedDestination.id}`);
        }
        
        // Re-render to show selections
        this.updateShipList();
        this.updateMoveButton();
      }
      
      // Update UI with loaded orders
      this.updateConnectedStarsList(); // Refresh rocket icons
    }
  }

  /**
   * Handle order loading error
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing error information
   */
  handleOrderLoadError(context, eventData) {
    console.error('🚀 MoveDialog: Order loading failed:', eventData);
  }

  createDialog()
  {
    this.dialog = document.createElement('div');
    this.dialog.className = 'move-dialog dialog-base';

    // Header for dragging
    const header = document.createElement('div');
    header.className = 'dialog-header';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Fleet Manager';
    title.className = 'dialog-title';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'dialog-close-btn';
    
    closeBtn.addEventListener('click', () =>
    {
      this.hide();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Star name
    this.starNameElement = document.createElement('div');
    this.starNameElement.className = 'star-name-display';

    // Content container
    const content = document.createElement('div');
    content.className = 'dialog-content';

    // Left panel - Connected stars
    const leftPanel = document.createElement('div');
    leftPanel.className = 'dialog-panel';
    this.createConnectedStarsSection(leftPanel);

    // Right panel - Ship tree
    const rightPanel = document.createElement('div');
    rightPanel.className = 'dialog-panel';
    this.createShipTreeSection(rightPanel);

    content.appendChild(leftPanel);
    content.appendChild(rightPanel);

    this.dialog.appendChild(header);
    this.dialog.appendChild(this.starNameElement);
    this.dialog.appendChild(content);

    // Setup drag handlers
    this.setupDragHandlers(header);

    // Setup keyboard handlers
    this.setupKeyboardHandlers();

    document.body.appendChild(this.dialog);
  }

  /**
   * Create the ship tree section
   */
  createShipTreeSection(container)
  {
    const section = document.createElement('div');
    section.className = 'dialog-section';

    // Section title
    const title = document.createElement('h3');
    title.textContent = 'Fleet Selection';
    title.className = 'dialog-section-title';
    section.appendChild(title);

    // Ship tree container
    this.shipTreeContainer = document.createElement('div');
    this.shipTreeContainer.className = 'tree-container disabled';
    section.appendChild(this.shipTreeContainer);

    // Selection summary
    this.selectionSummary = document.createElement('div');
    this.selectionSummary.className = 'selection-summary';
    this.selectionSummary.textContent = 'No ships selected';
    section.appendChild(this.selectionSummary);

    container.appendChild(section);
  }

  /**
   * Create the connected stars selection section
   */
  createConnectedStarsSection(container)
  {
    const section = document.createElement('div');
    section.className = 'dialog-section';

    // Section title
    const title = document.createElement('h3');
    title.textContent = 'Connected Stars';
    title.className = 'dialog-section-title';
    section.appendChild(title);

    // Stars list container
    this.starsListContainer = document.createElement('div');
    this.starsListContainer.className = 'list-container';
    section.appendChild(this.starsListContainer);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'dialog-btn-container';

    // Submit button
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit Order';
    submitButton.className = 'dialog-btn';
    
    this.moveButton = submitButton;
    
    submitButton.addEventListener('click', () =>
    {
      this.moveFleet();
    });

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel Order';
    cancelButton.className = 'dialog-btn dialog-btn-danger';
    
    this.cancelButton = cancelButton;
    
    cancelButton.addEventListener('click', () =>
    {
      this.cancelOrder();
    });
    
    buttonContainer.appendChild(submitButton);
    buttonContainer.appendChild(cancelButton);
    section.appendChild(buttonContainer);
    container.appendChild(section);
  }

  /**
   * Setup drag handlers for the dialog
   */
  setupDragHandlers(dragHandle) {
    dragHandle.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const rect = this.dialog.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      
      // Keep dialog within viewport bounds
      const maxX = window.innerWidth - this.dialog.offsetWidth;
      const maxY = window.innerHeight - this.dialog.offsetHeight;
      
      const clampedX = Math.max(0, Math.min(x, maxX));
      const clampedY = Math.max(0, Math.min(y, maxY));
      
      this.dialog.style.left = clampedX + 'px';
      this.dialog.style.top = clampedY + 'px';
      this.dialog.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  /**
   * Setup keyboard handlers for accessibility
   */
  setupKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      // Handle arrow keys for navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateTree(e.key === 'ArrowDown' ? 1 : -1);
      }
      
      // Handle space for selection toggle
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        this.toggleCurrentSelection();
      }
      
      // Handle enter for expand/collapse
      if (e.key === 'Enter' && e.target === document.body) {
        e.preventDefault();
        this.toggleCurrentExpansion();
      }
    });
  }

  /**
   * Navigate the tree with arrow keys
   */
  navigateTree(direction) {
    // TODO: Implement tree navigation
    // This would require tracking the currently focused element
    console.log('🚀 MoveDialog: Tree navigation', direction);
  }

  /**
   * Toggle current selection
   */
  toggleCurrentSelection() {
    // TODO: Implement selection toggle for focused element
    console.log('🚀 MoveDialog: Toggle current selection');
  }

  /**
   * Toggle current expansion
   */
  toggleCurrentExpansion() {
    // TODO: Implement expansion toggle for focused element
    console.log('🚀 MoveDialog: Toggle current expansion');
  }

  /**
   * Show the dialog for a specific star
   */
  show(star, player = null) {
    if (!star) {
      console.error('MoveDialog: No star provided');
      return;
    }

    // Ensure the star has an owner (only owned stars can have fleets)
    if (!star.owner) {
      console.error('MoveDialog: Cannot open dialog for unowned star');
      return;
    }

    this.currentStar = star;
    
    // If no player is provided, use the star's owner as the current player
    if (!player && star.owner) {
      this.currentPlayer = star.owner;
      console.log('🚀 MoveDialog: Using star owner as current player:', star.owner.id);
    } else {
      this.currentPlayer = player;
    }
    
    // Clear all state when opening dialog
    this.selectedDestination = null;
    this.selectedShipIds.clear();
    this.currentMoveOrder = null;
    this.loadedOrders = []; // Clear loaded orders
    this.isVisible = true;
    this.dialog.style.display = 'block';

    // Update star name
    const starName = star.getName ? star.getName() : `Star ${star.id}`;
    this.starNameElement.textContent = starName;

    // Load orders from database for this star
    eventBus.emit('order:loadForStar', {
      success: true,
      details: {
        eventType: 'order:loadForStar',
        starId: this.currentStar.getId(),
        orderType: 'move'
      }
    });

    // Update connected stars list
    this.updateConnectedStarsList();

    // Update ship list
    this.updateShipList();

    // Reset move button
    this.updateMoveButton();

    console.log('🚀 MoveDialog: Opened for star:', starName, 'player:', this.currentPlayer?.id);
  }

  /**
   * Update the connected stars list
   */
  updateConnectedStarsList() {
    if (!this.currentStar) return;

    // Clear existing list
    this.starsListContainer.innerHTML = '';

    // Get connected star IDs and look up the actual star objects
    const connectedStarIds = this.currentStar.getConnectedStarIds ? this.currentStar.getConnectedStarIds() : [];
    const lookupFunction = this.getStarLookupFunction();
    const connectedStars = connectedStarIds
      .map(starId => lookupFunction ? lookupFunction(starId) : null)
      .filter(star => star !== null);

    if (connectedStars.length === 0) {
      const noStarsMessage = document.createElement('div');
      noStarsMessage.textContent = 'No connected stars available';
      noStarsMessage.className = 'star-list-empty';
      this.starsListContainer.appendChild(noStarsMessage);
      return;
    }

    // Create star selection items
    connectedStars.forEach(star => {
      const starItem = document.createElement('div');
      starItem.className = 'star-item';

      // Check if there's an existing move order to this star
      const hasMoveOrder = this.checkForExistingMoveOrder(star);

      const starName = star.getName ? star.getName() : `Star ${star.id}`;
      const starNameElement = document.createElement('span');
      starNameElement.textContent = starName;
      
      // Use star's color (owner's color) or light gray if unowned
      const starColor = star.color || '#CCCCCC';
      starNameElement.className = 'star-name';
      starNameElement.style.color = starColor;

      // Create right side container for owner and rocket icon
      const rightSide = document.createElement('div');
      rightSide.className = 'star-item-meta';

      // Show star owner if any
      const ownerElement = document.createElement('span');
      if (star.owner) {
        ownerElement.textContent = `(${star.owner.name || 'Owned'})`;
      }
      ownerElement.className = 'star-owner';

      // Add rocket icon if there's an existing move order
      if (hasMoveOrder) {
        const rocketIcon = document.createElement('span');
        rocketIcon.textContent = '🚀';
        rocketIcon.className = 'star-icon';
        rocketIcon.title = 'Has existing move order';
        rightSide.appendChild(rocketIcon);
      }

      rightSide.appendChild(ownerElement);
      starItem.appendChild(starNameElement);
      starItem.appendChild(rightSide);

      // Hover effects
      starItem.addEventListener('mouseenter', () => {
        if (this.selectedDestination !== star) {
          starItem.style.background = 'var(--bg-light)';
        }
      });

      starItem.addEventListener('mouseleave', () => {
        if (this.selectedDestination !== star) {
          starItem.style.background = 'transparent';
        }
      });

      // Click handler
      starItem.addEventListener('click', () => {
        this.selectDestination(star, starItem);
      });

      this.starsListContainer.appendChild(starItem);
    });
  }

     /**
    * Clear destination selection
    */
   clearDestinationSelection() {
     // Clear previous selection
     const previousSelected = this.starsListContainer.querySelector('.selected');
     if (previousSelected) {
       previousSelected.classList.remove('selected');
       previousSelected.style.background = 'transparent';
       previousSelected.style.border = 'none';
       
       // Restore original star name color
       const starNameElement = previousSelected.querySelector('span:first-child');
       if (starNameElement) {
         const connectedStarIds = this.currentStar.getConnectedStarIds ? this.currentStar.getConnectedStarIds() : [];
         const lookupFunction = this.getStarLookupFunction();
         const connectedStars = connectedStarIds
           .map(starId => lookupFunction ? lookupFunction(starId) : null)
           .filter(star => star !== null);
         const originalStar = connectedStars.find(s => 
           (s.getName ? s.getName() : `Star ${s.id}`) === starNameElement.textContent
         );
         if (originalStar) {
           const starColor = originalStar.color || '#CCCCCC';
           starNameElement.style.color = starColor;
         }
       }
     }
     
     this.selectedDestination = null;
     
     // Disable ship tree
    if (this.shipTreeContainer) {
      this.shipTreeContainer.classList.add('disabled');
    }
   }

   /**
    * Select a destination star
    */
   selectDestination(star, element) {
    // Clear previous selection
    const previousSelected = this.starsListContainer.querySelector('.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
      previousSelected.style.background = 'transparent';
      previousSelected.style.border = 'none';
      
      // Restore original star name color
      const starNameElement = previousSelected.querySelector('span:first-child');
      if (starNameElement) {
        const connectedStarIds = this.currentStar.getConnectedStarIds ? this.currentStar.getConnectedStarIds() : [];
        const lookupFunction = this.getStarLookupFunction();
        const connectedStars = connectedStarIds
          .map(starId => lookupFunction ? lookupFunction(starId) : null)
          .filter(star => star !== null);
        const originalStar = connectedStars.find(s => 
          (s.getName ? s.getName() : `Star ${s.id}`) === starNameElement.textContent
        );
        if (originalStar) {
          const starColor = originalStar.color || '#CCCCCC';
          starNameElement.style.color = starColor;
        }
      }
    }

    // Select new destination
    this.selectedDestination = star;
    element.classList.add('selected');
    
    // Change star name to black for better contrast on green background
    const starNameElement = element.querySelector('span:first-child');
    if (starNameElement) {
      starNameElement.style.color = '#000';
    }

    // Enable ship tree and load previous selection for this destination
    this.enableShipTree();
    this.loadPreviousSelectionForDestination(star);
    this.updateMoveButton();

    console.log('🚀 MoveDialog: Selected destination:', star.getName ? star.getName() : `Star ${star.id}`);
  }

  /**
   * Enable ship tree when destination is selected
   */
  enableShipTree() {
    if (this.shipTreeContainer) {
      this.shipTreeContainer.classList.remove('disabled');
    }
  }

  /**
   * Update the ship list
   */
  updateShipList() {
    if (!this.currentStar) return;

    // Get ships at this star
    const ships = this.currentStar.getShips ? this.currentStar.getShips() : [];
    
    // Render the ship list
    this.renderShipList(ships);
  }

  /**
   * Render the ship list
   */
  renderShipList(ships) {
    if (!this.shipTreeContainer) return;

    this.shipTreeContainer.innerHTML = '';

    if (ships.length === 0) {
      const noShipsMessage = document.createElement('div');
      noShipsMessage.textContent = 'No ships available at this star';
      noShipsMessage.className = 'ship-tree-empty';
      this.shipTreeContainer.appendChild(noShipsMessage);
      return;
    }

    // Sort ships by damage (least damaged first) then power (highest first)
    const sortedShips = this.sortShips(ships);

    // Render each ship
    sortedShips.forEach(ship => {
      const shipElement = this.createShipElement(ship);
      this.shipTreeContainer.appendChild(shipElement);
    });

    // Update selection summary
    this.updateSelectionSummary();
  }

  /**
   * Sort ships by power (highest first) then damage (least damaged first)
   */
  sortShips(ships) {
    return ships.sort((a, b) => {
      // Primary: by power (highest power first)
      const powerA = a.getPower ? a.getPower() : a.power || 0;
      const powerB = b.getPower ? b.getPower() : b.power || 0;
      if (powerA !== powerB) return powerB - powerA;
      
      // Secondary: by damage (least damaged first)
      const damageA = a.getDamagePercentage ? a.getDamagePercentage() : 0;
      const damageB = b.getDamagePercentage ? b.getDamagePercentage() : 0;
      return damageA - damageB;
    });
  }

  /**
   * Create a ship element for the list
   */
  createShipElement(ship) {
    const shipElement = document.createElement('div');
    shipElement.className = 'ship-item';
    
    const shipId = this.getShipId(ship);
    const isSelected = this.selectedShipIds.has(shipId);
    const canMove = ship.canMove();
    const damagePercentage = ship.getDamagePercentage();
    const healthPercentage = 100 - damagePercentage;

    console.log('Ship health debug:', {
      shipId: ship.id,
      power: ship.getPower(),
      damage: ship.getDamage(),
      damagePercentage: damagePercentage,
      healthPercentage: healthPercentage,
      canMove: canMove
    });
    
    // Add color coding based on health
    if (healthPercentage > 50) {
      shipElement.classList.add('ship-health-good');
    } else if (healthPercentage > 0) {
      shipElement.classList.add('ship-health-warning');
    } else {
      shipElement.classList.add('ship-health-critical');
    }
    
    // Add selection state
    if (isSelected) {
      shipElement.classList.add('selected');
    }
    
    // Add disabled state for immobile ships
    if (!canMove) {
      shipElement.classList.add('disabled');
    }
    
    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isSelected;
    checkbox.disabled = !canMove;
    checkbox.addEventListener('change', () => {
      this.toggleShipSelection(ship);
    });
    
    // Create ship info
    const shipInfo = document.createElement('div');
    shipInfo.className = 'ship-info';
    
    // Ship name and power badge
    const shipName = document.createElement('span');
    shipName.className = 'ship-name';
    shipName.textContent = getShipDisplayName(ship);
    
    const powerBadge = document.createElement('span');
    powerBadge.className = 'power-badge';
    const power = ship.getPower ? ship.getPower() : ship.power || 0;
    powerBadge.textContent = `P${power}`;
    
    // Health bar
    const healthBar = document.createElement('div');
    healthBar.className = 'health-bar';
    const healthFill = document.createElement('div');
    healthFill.className = 'health-fill';
    
    // Set width - use actual percentage, but ensure minimum visibility for very low health
    let fillWidth = healthPercentage;
    if (healthPercentage > 0 && healthPercentage < 2) {
      fillWidth = 2; // Minimum 2% width for visibility when health is very low
    }
    healthFill.style.width = `${fillWidth}%`;
    
    // Set health bar color based on health percentage
    if (healthPercentage > 50) {
      healthFill.style.background = '#00ff88';
    } else if (healthPercentage > 0) {
      healthFill.style.background = '#ffaa00';
    } else {
      healthFill.style.background = '#ff4444';
    }
    
    healthBar.appendChild(healthFill);
    
    // Health percentage text
    const healthText = document.createElement('span');
    healthText.className = 'health-text';
    healthText.textContent = `${Math.round(healthPercentage)}%`;
    
    shipInfo.appendChild(shipName);
    shipInfo.appendChild(powerBadge);
    shipInfo.appendChild(healthBar);
    shipInfo.appendChild(healthText);
    
    shipElement.appendChild(checkbox);
    shipElement.appendChild(shipInfo);
    
    return shipElement;
  }

  /**
   * Check if there's an existing move order to a specific star
   */
  checkForExistingMoveOrder(destinationStar) {
    if (!this.currentPlayer || !this.currentStar) return false;
    
    // Check loaded orders for move orders to this destination
    const moveOrders = this.loadedOrders.filter(order => order.order_type === 'move');
    return moveOrders.some(order => 
      order.payload && order.payload.destinationStarId === destinationStar.id
    );
  }

  /**
   * Calculate which ships are available for selection (not already assigned to other destinations)
   */
  calculateAvailableShips() {
    if (!this.currentPlayer || !this.currentStar) return new Set();
    
    // Get all move orders for this origin star
    const moveOrders = this.loadedOrders.filter(order => order.order_type === 'move');
    
    // Collect all ship IDs that are already assigned to other destinations
    const assignedShipIds = new Set();
    moveOrders.forEach(order => {
      // Don't include ships from the current destination (if any)
      if (this.selectedDestination && order.payload && order.payload.destinationStarId === this.selectedDestination.id) {
        return;
      }
      if (order.payload && order.payload.selectedShipIds) {
        order.payload.selectedShipIds.forEach(shipId => {
          assignedShipIds.add(shipId);
        });
      }
    });
    
    return assignedShipIds;
  }

  /**
   * Get consistent ship ID
   */
  getShipId(ship) {
    if (ship.id !== undefined) return ship.id;
    if (ship.getId) return ship.getId();
    // Fallback to object reference for consistency
    return `ship-${ship.constructor.name}-${ship.power || 0}-${ship.damage || 0}`;
  }



  /**
   * Toggle ship selection
   */
  toggleShipSelection(ship) {
    const shipId = this.getShipId(ship);
    if (this.selectedShipIds.has(shipId)) {
      this.selectedShipIds.delete(shipId);
    } else {
      this.selectedShipIds.add(shipId);
    }
    
    this.updateSelectionSummary();
    this.updateMoveButton();
    // Re-render the list to update selection counts
    this.updateShipList();
  }

  /**
   * Update selection summary
   */
  updateSelectionSummary() {
    if (!this.selectionSummary) return;

    const selectedCount = this.selectedShipIds.size;
    const totalPower = this.calculateSelectedPower();

    if (selectedCount === 0) {
      this.selectionSummary.textContent = 'No ships selected';
    } else {
      this.selectionSummary.textContent = `${selectedCount} ships selected (${totalPower} power)`;
    }
  }

  /**
   * Calculate total power of selected ships
   */
  calculateSelectedPower() {
    if (!this.currentStar) return 0;

    const ships = this.currentStar.getShips ? this.currentStar.getShips() : [];
    let totalPower = 0;
    
    ships.forEach(ship => {
      const shipId = this.getShipId(ship);
      if (this.selectedShipIds.has(shipId)) {
        const power = ship.getPower ? ship.getPower() : ship.power || 0;
        totalPower += power;
      }
    });

    return totalPower;
  }


  /**
   * Load previous selection for a specific destination
   */
  loadPreviousSelectionForDestination(destinationStar) {
    if (!this.currentPlayer || !this.currentStar) return;

    // Request orders from database for this star
    eventBus.emit('order:loadForStar', {
      success: true,
      details: {
        eventType: 'order:loadForStar',
        starId: this.currentStar.getId(),
        orderType: 'move'
      }
    });
    
    // For now, clear selection - we'll update when orders are loaded
    this.selectedShipIds.clear();
    this.currentMoveOrder = null;
    this.updateShipList();
    console.log('🚀 MoveDialog: Requesting orders from database for destination:', destinationStar.getName ? destinationStar.getName() : `Star ${destinationStar.id}`);
  }

  /**
   * Load previous selection (legacy method - kept for compatibility)
   */
  loadPreviousSelection() {
    if (!this.currentPlayer || !this.currentStar) return;

    // Request orders from database for this star
    eventBus.emit('order:loadForStar', {
      success: true,
      details: {
        eventType: 'order:loadForStar',
        starId: this.currentStar.getId(),
        orderType: 'move'
      }
    });
    
    // For now, clear selection - we'll update when orders are loaded
    this.selectedShipIds.clear();
    this.currentMoveOrder = null;
    this.updateShipList();
  }

  /**
   * Check if dialog can be submitted
   */
  canSubmit() {
    return this.selectedDestination && this.selectedShipIds.size > 0;
  }

  /**
   * Check if dialog can be cancelled (has existing order for this destination)
   */
  canCancel() {
    return this.selectedDestination && this.currentMoveOrder !== null;
  }

  /**
   * Update the button states
   */
  updateMoveButton() {
    // Update submit button
    if (this.canSubmit()) {
      this.moveButton.classList.remove('btn-disabled');
      this.moveButton.classList.add('btn-enabled');
    } else {
      this.moveButton.classList.remove('btn-enabled');
      this.moveButton.classList.add('btn-disabled');
    }

    // Update cancel button
    if (this.canCancel()) {
      this.cancelButton.classList.remove('btn-disabled');
      this.cancelButton.classList.add('btn-enabled');
    } else {
      this.cancelButton.classList.remove('btn-enabled');
      this.cancelButton.classList.add('btn-disabled');
    }
  }

  /**
   * Cancel the move order for the selected destination
   */
  cancelOrder() {
    if (!this.canCancel()) {
      console.warn('MoveDialog: Cannot cancel - no existing order for this destination');
      return;
    }

    const fromStar = this.currentStar.getName ? this.currentStar.getName() : `Star ${this.currentStar.id}`;
    const toStar = this.selectedDestination.getName ? this.selectedDestination.getName() : `Star ${this.selectedDestination.id}`;
    
    console.log(`🚀 MoveDialog: Cancelling move order from ${fromStar} to ${toStar}`);
    
      // Submit order cancellation to database
      if (this.currentPlayer) {
        const orderData = {
          action: 'cancel',
          sourceStarId: this.currentStar.getId(),
          destinationStarId: this.selectedDestination.id,
          selectedShipIds: Array.from(this.selectedShipIds)
        };

        console.log('🚀 MoveDialog: Submitting order cancellation via event system');

        // Emit order submission event for cancellation
        eventBus.emit('order:submit', {
          success: true,
          details: {
            eventType: 'order:submit',
            orderType: 'move',
            payload: orderData
          }
        });
      }
    
    // Clear current selection
    this.selectedShipIds.clear();
    this.currentMoveOrder = null;
    
         // Update UI
     this.updateMoveButton();
     this.updateShipList();
     this.updateConnectedStarsList(); // Refresh rocket icons
     
     // Show confirmation
     this.showCancelConfirmation(fromStar, toStar);
  }

  /**
   * Submit the move order for the selected destination
   */
  moveFleet() {
    if (!this.canSubmit()) {
      console.warn('MoveDialog: Cannot submit - missing destination or ship selection');
      return;
    }

    const fromStar = this.currentStar.getName ? this.currentStar.getName() : `Star ${this.currentStar.id}`;
    const toStar = this.selectedDestination.getName ? this.selectedDestination.getName() : `Star ${this.selectedDestination.id}`;
    
    console.log(`🚀 MoveDialog: Submitting move order from ${fromStar} to ${toStar}`);
    
    // Prepare order data for database submission
    const orderData = {
      action: 'move',
      sourceStarId: this.currentStar.getId(),
      destinationStarId: this.selectedDestination.getId(),
      selectedShipIds: Array.from(this.selectedShipIds)
    };

    console.log('🚀 MoveDialog: Submitting move order via event system', orderData);

    // Emit order submission event
    eventBus.emit('order:submit', {
      success: true,
      details: {
        eventType: 'order:submit',
        orderType: 'move',
        payload: orderData
      }
    });
    
         // Show confirmation and refresh UI
     this.showMoveConfirmation(fromStar, toStar);
     this.updateConnectedStarsList(); // Refresh rocket icons
     
     // Clear destination selection and ship selection after successful submit
     this.clearDestinationSelection();
     this.selectedShipIds.clear();
     this.currentMoveOrder = null;
     this.updateMoveButton();
     this.updateShipList();
  }

  /**
   * Show move confirmation feedback
   */
  showMoveConfirmation(fromStar, toStar) {
    const confirmation = document.createElement('div');
    confirmation.textContent = `Move order submitted: ${fromStar} → ${toStar}`;
    confirmation.className = 'confirmation-message-move';

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(confirmation);

    // Remove after 3 seconds
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.parentNode.removeChild(confirmation);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 3000);
  }

  /**
   * Show cancel confirmation feedback
   */
  showCancelConfirmation(fromStar, toStar) {
    const confirmation = document.createElement('div');
    confirmation.textContent = `Move order cancelled: ${fromStar} → ${toStar}`;
    confirmation.className = 'confirmation-message-move';

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(confirmation);

    // Remove after 3 seconds
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.parentNode.removeChild(confirmation);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 3000);
  }

  /**
   * Hide the dialog
   */
  hide() {
    this.isVisible = false;
    this.currentStar = null;
    this.currentPlayer = null;
    this.currentMoveOrder = null;
    this.selectedDestination = null;
    this.selectedShipIds.clear();
    this.dialog.style.display = 'none';
    console.log('🚀 MoveDialog: Closed');
  }

  /**
   * Check if the dialog is currently open
   */
  isOpen() {
    return this.isVisible;
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
  }
}