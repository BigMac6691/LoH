import { getShipDisplayName } from './utils/shipGrouping.js';
import { eventBus } from './eventBus.js';
import { DualSlider } from './DualSlider.js';

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
    this.loadedOrders = []; // Track orders loaded from database (deprecated)
    this.currentOrders = []; // Current move orders for the current star
    
    this.createDialog();
    this.setupEventListeners();
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
      
      // Update current orders with the returned orders from the server
      if (eventData.details.orders) {
        this.currentOrders = eventData.details.orders;
        console.log('🚀 MoveDialog: Updated currentOrders with server response:', this.currentOrders.length);
      }
      
      // Update UI to reflect the saved order
      this.updateConnectedStarsList(); // Refresh rocket icons
      this.updateMoveButton();
      
      // Show confirmation
      const fromStar = this.currentStar.getName();
      const toStar = this.selectedDestination.getName();
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
    if (eventData.details.sourceStarId === this.currentStar?.getId()) {
      
      // Store current orders (move orders only)
      this.currentOrders = eventData.details.orders || [];
      console.log('🚀 MoveDialog: Updated currentOrders:', this.currentOrders.length);
      
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

    // Damage threshold slider
    const damageThresholdContainer = document.createElement('div');
    damageThresholdContainer.className = 'damage-threshold-container';
    
    const damageThresholdLabel = document.createElement('label');
    damageThresholdLabel.textContent = 'Damage Threshold:';
    damageThresholdLabel.className = 'damage-threshold-label';
    
    const damageThresholdSlider = document.createElement('input');
    damageThresholdSlider.type = 'range';
    damageThresholdSlider.min = '0';
    damageThresholdSlider.max = '100';
    damageThresholdSlider.value = '100';
    damageThresholdSlider.className = 'damage-threshold-slider';
    damageThresholdSlider.addEventListener('input', () => {
      this.updateDamageThreshold(parseInt(damageThresholdSlider.value));
    });
    
    const damageThresholdValue = document.createElement('span');
    damageThresholdValue.textContent = '100%';
    damageThresholdValue.className = 'damage-threshold-value';
    
    damageThresholdContainer.appendChild(damageThresholdLabel);
    damageThresholdContainer.appendChild(damageThresholdSlider);
    damageThresholdContainer.appendChild(damageThresholdValue);
    section.appendChild(damageThresholdContainer);
    
    // Store references
    this.damageThresholdSlider = damageThresholdSlider;
    this.damageThresholdValue = damageThresholdValue;

    // Power range slider container
    const powerRangeContainer = document.createElement('div');
    powerRangeContainer.className = 'power-range-container';
    
    const powerRangeLabel = document.createElement('label');
    powerRangeLabel.textContent = 'Power Range:';
    powerRangeLabel.className = 'power-range-label';
    
    const powerRangeSliderContainer = document.createElement('div');
    powerRangeSliderContainer.className = 'power-range-slider-container';
    
    powerRangeContainer.appendChild(powerRangeLabel);
    powerRangeContainer.appendChild(powerRangeSliderContainer);
    section.appendChild(powerRangeContainer);
    
    // Store references
    this.powerRangeContainer = powerRangeContainer;
    this.powerRangeSliderContainer = powerRangeSliderContainer;

    // Ship list container
    this.shipTreeContainer = document.createElement('div');
    this.shipTreeContainer.className = 'ship-tree-container disabled';
    section.appendChild(this.shipTreeContainer);

    // Selection summary
    this.selectionSummary = document.createElement('div');
    this.selectionSummary.className = 'selection-summary';
    this.selectionSummary.textContent = 'No ships selected';
    section.appendChild(this.selectionSummary);

    // Quick select buttons
    const quickSelectContainer = document.createElement('div');
    quickSelectContainer.className = 'quick-select-container';
    
    const selectAllMobileBtn = document.createElement('button');
    selectAllMobileBtn.textContent = 'Select All Mobile';
    selectAllMobileBtn.className = 'quick-select-btn';
    selectAllMobileBtn.addEventListener('click', () => {
      this.selectAllMobileShips();
    });
    
    const clearSelectionBtn = document.createElement('button');
    clearSelectionBtn.textContent = 'Clear Selection';
    clearSelectionBtn.className = 'quick-select-btn';
    clearSelectionBtn.addEventListener('click', () => {
      this.clearShipSelection();
    });
    
    quickSelectContainer.appendChild(selectAllMobileBtn);
    quickSelectContainer.appendChild(clearSelectionBtn);
    section.appendChild(quickSelectContainer);

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

      // TODO: Add keyboard navigation for ship selection
      // Arrow keys, space, and enter could be used for accessibility
    });
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
    if (!star.getOwner()) {
      console.error('MoveDialog: Cannot open dialog for unowned star');
      return;
    }

    this.currentStar = star;
    
    // If no player is provided, use the star's owner as the current player
    if (!player && star.getOwner()) {
      this.currentPlayer = star.getOwner();
      console.log('🚀 MoveDialog: Using star owner as current player:', star.getOwner().id);
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
    
    // Reset damage threshold to 100% (show all ships)
    if (this.damageThresholdSlider) {
      this.damageThresholdSlider.value = '100';
      this.damageThresholdValue.textContent = '100%';
    }
    

    // Update star name
    const starName = star.getName();
    this.starNameElement.textContent = starName;

    // Update connected stars list (initially without rocket icons)
    this.updateConnectedStarsList();

    // Load orders from database for this star
    eventBus.emit('order:loadForStar', {
      success: true,
      details: {
        eventType: 'order:loadForStar',
        sourceStarId: this.currentStar.getId(),
        orderType: 'move'
      }
    });

    // Initialize power range slider
    this.initializePowerRangeSlider();

    // Update ship list
    this.updateShipList();

    // Reset move button
    this.updateMoveButton();

    console.log('🚀 MoveDialog: Opened for star:', starName, 'player:', this.currentPlayer.id);
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

      const starName = star.getName();
      const starNameElement = document.createElement('span');
      starNameElement.textContent = starName;
      
      // Use star's color (owner's color) or light gray if unowned
      const starColor = star.getColor();
      starNameElement.className = 'star-name';
      starNameElement.style.color = starColor;

      // Create right side container for owner and rocket icon
      const rightSide = document.createElement('div');
      rightSide.className = 'star-item-meta';

      // Show star owner if any
      const ownerElement = document.createElement('span');
      if (star.getOwner()) {
        ownerElement.textContent = `(${star.getOwner().name || 'Owned'})`;
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
          s.getName() === starNameElement.textContent
        );
        if (originalStar) {
          const starColor = originalStar.getColor();
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
          s.getName() === starNameElement.textContent
        );
        if (originalStar) {
          const starColor = originalStar.getColor();
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

    // Enable ship tree and update ship selection based on current orders
    this.enableShipTree();
    this.updateShipSelection();
    this.updateMoveButton();

    console.log(`🚀 MoveDialog: Selected destination: ${star.getName()}(${star.getId()})`);
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
   * Calculate power range from ships
   * @param {Array<Ship>} ships - Array of ships to analyze
   * @returns {Object} Object with min and max power values
   */
  calculatePowerRange(ships) {
    if (!ships || ships.length === 0) {
      return { min: 0, max: 100 };
    }
    
    const powers = ships.map(ship => ship.getPower());
    const minPower = Math.min(...powers);
    const maxPower = Math.max(...powers);
    
    return {
      min: Math.max(0, minPower),
      max: maxPower
    };
  }

  /**
   * Initialize the power range slider
   */
  initializePowerRangeSlider() {
    if (!this.currentStar || !this.powerRangeSliderContainer) return;
    
    // Get ships at this star
    const ships = this.currentStar.getShips();
    
    // Calculate power range
    const powerRange = this.calculatePowerRange(ships);
    
    // Destroy existing slider if it exists
    if (this.powerRangeSlider) {
      this.powerRangeSlider.destroy();
    }
    
    // Create new DualSlider
    this.powerRangeSlider = new DualSlider(this.powerRangeSliderContainer, {
      min: powerRange.min,
      max: powerRange.max,
      minValue: powerRange.min,
      maxValue: powerRange.max,
      step: 1,
      width: 300,
      height: 60,
      onChange: (values) => {
        this.updatePowerRange(values);
      }
    });
    
    console.log(`🚀 MoveDialog: Power range slider initialized with range ${powerRange.min}-${powerRange.max}`);
  }

  /**
   * Update the ship list
   */
  updateShipList() {
    if (!this.currentStar) return;

    // Get ships at this star
    const ships = this.currentStar.getShips();
    
    // Filter ships by damage threshold
    const damageFilteredShips = this.filterShipsByDamageThreshold(ships);
    
    // Filter ships by power range
    const filteredShips = this.filterShipsByPowerRange(damageFilteredShips);
    
    console.log('🚀 MoveDialog: Updating ship list', {
      totalShips: ships.length,
      damageFiltered: damageFilteredShips.length,
      powerFiltered: filteredShips.length,
      selectedShipIds: Array.from(this.selectedShipIds)
    });
    
    // Render the ship list
    this.renderShipList(filteredShips);
  }

  /**
   * Filter ships by damage threshold
   * @param {Array<Ship>} ships - Array of ships to filter
   * @returns {Array<Ship>} Filtered ships
   */
  filterShipsByDamageThreshold(ships) {
    const threshold = this.damageThresholdSlider ? parseInt(this.damageThresholdSlider.value) : 100;
    
    return ships.filter(ship => {
      const damagePercentage = ship.getDamagePercentage();
      return damagePercentage <= threshold;
    });
  }

  /**
   * Filter ships by power range
   * @param {Array<Ship>} ships - Array of ships to filter
   * @returns {Array<Ship>} Filtered ships
   */
  filterShipsByPowerRange(ships) {
    if (!this.powerRangeSlider) {
      return ships; // No filtering if slider not initialized
    }
    
    const values = this.powerRangeSlider.getValues();
    const minPower = values.min;
    const maxPower = values.max;
    
    return ships.filter(ship => {
      const power = ship.getPower();
      return power >= minPower && power <= maxPower;
    });
  }

  /**
   * Update damage threshold and refresh ship list
   * @param {number} threshold - Damage threshold percentage (0-100)
   */
  updateDamageThreshold(threshold) {
    // Update the display value
    if (this.damageThresholdValue) {
      this.damageThresholdValue.textContent = `${threshold}%`;
    }
    
    // Clear current selection if ships are filtered out
    const ships = this.currentStar.getShips();
    const filteredShips = this.filterShipsByDamageThreshold(ships);
    
    // Remove selections for ships that are no longer visible
    const visibleShipIds = new Set(filteredShips.map(ship => this.getShipId(ship)));
    const selectedShipIds = Array.from(this.selectedShipIds);
    
    selectedShipIds.forEach(shipId => {
      if (!visibleShipIds.has(shipId)) {
        this.selectedShipIds.delete(shipId);
      }
    });
    
    // Refresh the ship list
    this.updateShipList();
    this.updateSelectionSummary();
    this.updateMoveButton();
    
    console.log(`🚀 MoveDialog: Damage threshold updated to ${threshold}%, showing ${filteredShips.length} ships`);
  }

  /**
   * Update power range and refresh ship list
   * @param {Object} values - Object with min and max power values
   */
  updatePowerRange(values) {
    if (!values) return;
    
    const minPower = values.min;
    const maxPower = values.max;
    
    // Clear current selection if ships are filtered out
    const ships = this.currentStar.getShips();
    const damageFilteredShips = this.filterShipsByDamageThreshold(ships);
    const filteredShips = this.filterShipsByPowerRange(damageFilteredShips);
    
    // Remove selections for ships that are no longer visible
    const visibleShipIds = new Set(filteredShips.map(ship => this.getShipId(ship)));
    const selectedShipIds = Array.from(this.selectedShipIds);
    
    selectedShipIds.forEach(shipId => {
      if (!visibleShipIds.has(shipId)) {
        this.selectedShipIds.delete(shipId);
      }
    });
    
    // Refresh the ship list
    this.updateShipList();
    this.updateSelectionSummary();
    this.updateMoveButton();
    
    console.log(`🚀 MoveDialog: Power range updated to ${minPower}-${maxPower}, showing ${filteredShips.length} ships`);
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
      noShipsMessage.className = 'ship-list-empty';
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
      const powerA = a.getPower();
      const powerB = b.getPower();
      if (powerA !== powerB) return powerB - powerA;
      
      // Secondary: by damage (least damaged first)
      const damageA = a.getDamagePercentage();
      const damageB = b.getDamagePercentage();
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
    const power = ship.getPower();
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
   * Update ship selection based on current orders for selected destination
   */
  updateShipSelection() {
    if (!this.selectedDestination || !this.currentOrders.length) {
      // Clear selection if no destination or no orders
      this.selectedShipIds.clear();
      this.currentMoveOrder = null;
      this.updateShipList();
      this.updateMoveButton();
      return;
    }

    // Find move order for the selected destination
    const orderForDestination = this.currentOrders.find(order => 
      order.payload && order.payload.destinationStarId === this.selectedDestination.getId()
    );
    
    if (orderForDestination) {
      // Load the order data
      this.currentMoveOrder = orderForDestination;
      this.selectedShipIds = new Set(orderForDestination.payload.selectedShipIds || []);
      console.log(`🚀 MoveDialog: Updated ship selection for destination: ${this.selectedDestination.getName()}(${this.selectedDestination.getId()})`, {
        selectedShipIds: Array.from(this.selectedShipIds),
        orderPayload: orderForDestination.payload
      });
    } else {
      // Clear selection if no order for this destination
      this.selectedShipIds.clear();
      this.currentMoveOrder = null;
      console.log('🚀 MoveDialog: No order found for destination:', this.selectedDestination.getName());
    }
    
    // Re-render to show selections
    this.updateShipList();
    this.updateMoveButton();
  }

  /**
   * Check if there's an existing move order to a specific star
   */
  checkForExistingMoveOrder(destinationStar) {
    if (!this.currentPlayer || !this.currentStar) return false;
    
    // Check current orders for move orders to this destination
    const hasOrder = this.currentOrders.some(order => 
      order.payload && order.payload.destinationStarId === destinationStar.getId()
    );
    
    console.log(`🚀 MoveDialog: Checking for move order to ${destinationStar.getName()}(${destinationStar.getId()})`, {
      currentOrders: this.currentOrders,
      hasOrder: hasOrder
    });
    
    return hasOrder;
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
      if (this.selectedDestination && order.payload && order.payload.destinationStarId === this.selectedDestination.getId()) {
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
    return `ship-${ship.constructor.name}-${ship.getPower()}-${ship.getDamage()}`;
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
   * Select all mobile ships (less than 50% damage)
   */
  selectAllMobileShips() {
    if (!this.currentStar) return;
    
    const ships = this.currentStar.getShips();
    let selectedCount = 0;
    
    ships.forEach(ship => {
      const damagePercentage = ship.getDamagePercentage();
      if (damagePercentage < 50) {
        const shipId = this.getShipId(ship);
        this.selectedShipIds.add(shipId);
        selectedCount++;
      }
    });
    
    this.updateSelectionSummary();
    this.updateMoveButton();
    this.updateShipList();
    
    console.log(`🚀 MoveDialog: Selected ${selectedCount} mobile ships`);
  }

  /**
   * Clear all ship selections
   */
  clearShipSelection() {
    this.selectedShipIds.clear();
    this.updateSelectionSummary();
    this.updateMoveButton();
    this.updateShipList();
    
    console.log('🚀 MoveDialog: Cleared all ship selections');
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

    const ships = this.currentStar.getShips();
    let totalPower = 0;
    
    ships.forEach(ship => {
          const shipId = this.getShipId(ship);
          if (this.selectedShipIds.has(shipId)) {
            const power = ship.getPower();
            totalPower += power;
          }
    });

    return totalPower;
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

    const fromStar = this.currentStar.getName();
    const toStar = this.selectedDestination.getName();
    
    console.log(`🚀 MoveDialog: Cancelling move order from ${fromStar} to ${toStar}`);
    
      // Submit order cancellation to database
    if (this.currentPlayer) {
        const orderData = {
          action: 'cancel',
          sourceStarId: this.currentStar.getId(),
          destinationStarId: this.selectedDestination.getId(),
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

    const fromStar = this.currentStar.getName();
    const toStar = this.selectedDestination.getName();
    
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
    this.currentOrders = []; // Clear current orders
    this.dialog.style.display = 'none';
    
    // Reset damage threshold to 100% for next time
    if (this.damageThresholdSlider) {
      this.damageThresholdSlider.value = '100';
      this.damageThresholdValue.textContent = '100%';
    }
    
    // Clean up power range slider
    if (this.powerRangeSlider) {
      this.powerRangeSlider.destroy();
      this.powerRangeSlider = null;
    }
    
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