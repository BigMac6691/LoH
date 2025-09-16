import { MoveOrder, moveOrderStore } from '@loh/shared';
import { groupShipsByPowerAndDamage, getShipDisplayName, getShipHealthPercentage, canShipMove } from './utils/shipGrouping.js';
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
    this.expandedNodes = new Set();
    this.shipTreeData = null;
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
        this.renderShipTree();
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
    this.expandedNodes.clear();
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

    // Update ship tree
    this.updateShipTree();

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
   * Update the ship tree
   */
  updateShipTree() {
    if (!this.currentStar) return;

    // Get ships at this star
    const ships = this.currentStar.getShips ? this.currentStar.getShips() : [];
    
    // Group ships by power and damage
    this.shipTreeData = groupShipsByPowerAndDamage(ships);
    
    // Render the tree (without loading previous selection)
    this.renderShipTree();
  }

  /**
   * Render the ship tree
   */
  renderShipTree() {
    if (!this.shipTreeContainer || !this.shipTreeData) return;

    this.shipTreeContainer.innerHTML = '';

    if (this.shipTreeData.totalShips === 0) {
      const noShipsMessage = document.createElement('div');
      noShipsMessage.textContent = 'No ships available at this star';
      noShipsMessage.className = 'ship-tree-empty';
      this.shipTreeContainer.appendChild(noShipsMessage);
      return;
    }

    // Render power groups
    this.shipTreeData.powerGroups.forEach(powerGroup => {
      this.renderPowerGroup(powerGroup);
    });

    // Update selection summary
    this.updateSelectionSummary();
  }

  /**
   * Render a power group
   */
  renderPowerGroup(powerGroup) {
    const groupElement = document.createElement('div');
    groupElement.className = 'power-group';

    // Power group header
    const header = document.createElement('div');
    header.className = 'power-group-header';

         const selectedCount = this.calculatePowerGroupSelectionCount(powerGroup);
     const availableCount = this.calculatePowerGroupAvailableCount(powerGroup);
     const immobileCount = this.calculatePowerGroupImmobileCount(powerGroup);
     
     // Add checkbox for "select all" in this power group
     const checkbox = document.createElement('input');
     checkbox.type = 'checkbox';
     // Checkbox styles are handled by CSS
     
     // Set checkbox state - checked if all available ships (excluding damaged immobile) are selected, unchecked otherwise
     checkbox.checked = selectedCount > 0 && selectedCount === availableCount;
    
         // Add checkbox click handler
     checkbox.addEventListener('change', (e) => {
       e.stopPropagation(); // Prevent header click
       this.togglePowerGroupSelection(powerGroup, checkbox.checked);
     });
     
     // Also prevent click event from bubbling
     checkbox.addEventListener('click', (e) => {
      console.log('🚀 MoveDialog: Checkbox clicked');
       e.stopPropagation();
     });
    
    const headerText = document.createElement('span');
    headerText.className = 'power-group-title';
    headerText.innerHTML = `Power ${powerGroup.power} (${selectedCount}/${availableCount}/<span style="color: #ff4444;">${immobileCount}</span> ships)`;

    const expandIcon = document.createElement('span');
    expandIcon.textContent = '▼';
    expandIcon.className = 'power-group-expand-icon';

    header.appendChild(checkbox);
    header.appendChild(headerText);
    header.appendChild(expandIcon);

    // Content container
    const content = document.createElement('div');
    content.className = 'power-group-content';

    // Render categories
    this.renderCategory(content, 'undamaged', powerGroup.categories.undamaged);
    this.renderCategory(content, 'damagedMobile', powerGroup.categories.damagedMobile);
    this.renderCategory(content, 'damagedImmobile', powerGroup.categories.damagedImmobile);

    groupElement.appendChild(header);
    groupElement.appendChild(content);

    // Handle expand/collapse
    const groupKey = `power-${powerGroup.power}`;
    const isExpanded = this.expandedNodes.has(groupKey);
    
    if (isExpanded) {
      content.classList.add('expanded');
      expandIcon.style.transform = 'rotate(180deg)';
    }

    header.addEventListener('click', () => {
      const isCurrentlyExpanded = content.classList.contains('expanded');
      
      if (isCurrentlyExpanded) {
        content.classList.remove('expanded');
        expandIcon.style.transform = 'rotate(0deg)';
        this.expandedNodes.delete(groupKey);
      } else {
        content.classList.add('expanded');
        expandIcon.style.transform = 'rotate(180deg)';
        this.expandedNodes.add(groupKey);
      }
    });

    this.shipTreeContainer.appendChild(groupElement);
  }

  /**
   * Render a category within a power group
   */
  renderCategory(container, categoryType, category) {
    if (category.count === 0) return;

    const categoryElement = document.createElement('div');
    categoryElement.className = 'category';

    // Category header
    const header = document.createElement('div');
    header.className = 'category-header';

    const categoryName = this.getCategoryDisplayName(categoryType);
    const selectedCount = this.calculateCategorySelectionCount(category);
    const availableCount = this.calculateCategoryAvailableCount(category);
    const totalCount = category.ships.length;
    
    // Add checkbox for "select all" in this category
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    // Checkbox styles are handled by CSS
    
    // Disable checkbox for damaged immobile ships
    if (categoryType === 'damagedImmobile') {
      checkbox.disabled = true;
      // Disabled checkbox styles are handled by CSS
    }
    
         // Set checkbox state - checked if all available ships (excluding damaged immobile) are selected, unchecked otherwise
     checkbox.checked = selectedCount > 0 && selectedCount === availableCount;
    
         // Add checkbox click handler
     checkbox.addEventListener('change', (e) => {
       e.stopPropagation(); // Prevent header click
       if (categoryType !== 'damagedImmobile') {
         this.toggleCategorySelection(category, categoryType, checkbox.checked);
       }
     });
     
     // Also prevent click event from bubbling
     checkbox.addEventListener('click', (e) => {
       e.stopPropagation();
     });
    
    const headerText = document.createElement('span');
    if (categoryType === 'damagedImmobile') {
      headerText.innerHTML = `${categoryName} (${selectedCount}/${availableCount}/<span style="color: #ff4444;">${totalCount}</span>)`;
    } else {
      headerText.textContent = `${categoryName} (${selectedCount}/${availableCount})`;
    }
    headerText.className = 'category-title';
    if (selectedCount > 0) {
      headerText.classList.add('selected');
    }

    const expandIcon = document.createElement('span');
    expandIcon.textContent = '▶';
    expandIcon.className = 'category-expand-icon';

    header.appendChild(checkbox);
    header.appendChild(headerText);
    header.appendChild(expandIcon);

    // Ships container
    const shipsContainer = document.createElement('div');
    shipsContainer.className = 'ships-container';

    // Render ships
    category.ships.forEach(ship => {
      this.renderShipItem(shipsContainer, ship, categoryType);
    });

    categoryElement.appendChild(header);
    categoryElement.appendChild(shipsContainer);

    // Handle expand/collapse
    const categoryKey = `category-${categoryType}`;
    const isExpanded = this.expandedNodes.has(categoryKey);
    
    if (isExpanded) {
      shipsContainer.classList.add('expanded');
      expandIcon.style.transform = 'rotate(90deg)';
    }

    header.addEventListener('click', () => {
      const isCurrentlyExpanded = shipsContainer.classList.contains('expanded');
      
      if (isCurrentlyExpanded) {
        shipsContainer.classList.remove('expanded');
        expandIcon.style.transform = 'rotate(0deg)';
        this.expandedNodes.delete(categoryKey);
      } else {
        shipsContainer.classList.add('expanded');
        expandIcon.style.transform = 'rotate(90deg)';
        this.expandedNodes.add(categoryKey);
      }
    });

    container.appendChild(categoryElement);
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
   * Render a ship item
   */
  renderShipItem(container, ship, categoryType) {
    const shipElement = document.createElement('div');
    shipElement.className = 'ship-item';

    const shipId = this.getShipId(ship);
    const isSelected = this.selectedShipIds.has(shipId);
    const canMove = categoryType !== 'damagedImmobile';
    
    // Check if ship is available (not assigned to other destinations)
    const assignedShipIds = this.calculateAvailableShips();
    const isAvailable = !assignedShipIds.has(shipId);

    if (isSelected) {
      shipElement.classList.add('selected');
    } else if (!canMove || !isAvailable) {
      shipElement.classList.add('disabled');
    }

    // Ship name
    const shipName = document.createElement('span');
    shipName.textContent = getShipDisplayName(ship);
    shipName.className = 'ship-name';

    // Ship health (for damaged ships)
    const healthInfo = document.createElement('span');
    if (categoryType !== 'undamaged') {
      const healthPercentage = getShipHealthPercentage(ship);
      healthInfo.textContent = `${Math.round(healthPercentage)}%`;
      
      healthInfo.className = 'ship-health';
      if (isSelected) {
        healthInfo.classList.add('selected');
      } else {
        if (healthPercentage > 50) {
          healthInfo.classList.add('healthy');
        } else if (healthPercentage > 25) {
          healthInfo.classList.add('warning');
        } else {
          healthInfo.classList.add('critical');
        }
      }
    }

    shipElement.appendChild(shipName);
    shipElement.appendChild(healthInfo);

    // Click handler
    if (canMove && isAvailable) {
      shipElement.addEventListener('click', () => {
        this.toggleShipSelection(shipId);
      });
    }

    container.appendChild(shipElement);
  }

  /**
   * Get category display name
   */
  getCategoryDisplayName(categoryType) {
    switch (categoryType) {
      case 'undamaged': return 'Undamaged';
      case 'damagedMobile': return 'Damaged Mobile';
      case 'damagedImmobile': return 'Damaged Immobile';
      default: return 'Unknown';
    }
  }

  /**
   * Get category color
   */
  getCategoryColor(categoryType) {
    switch (categoryType) {
      case 'undamaged': return '#00ff88';
      case 'damagedMobile': return '#ffaa00';
      case 'damagedImmobile': return '#ff4444';
      default: return '#ccc';
    }
  }

  /**
   * Toggle ship selection
   */
  toggleShipSelection(shipId) {
    if (this.selectedShipIds.has(shipId)) {
      this.selectedShipIds.delete(shipId);
    } else {
      this.selectedShipIds.add(shipId);
    }
    
    this.updateSelectionSummary();
    this.updateMoveButton();
    // Re-render the tree to update selection counts in headers
    this.renderShipTree();
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
    if (!this.shipTreeData) return 0;

    let totalPower = 0;
    this.shipTreeData.powerGroups.forEach(powerGroup => {
      ['undamaged', 'damagedMobile', 'damagedImmobile'].forEach(categoryType => {
        const category = powerGroup.categories[categoryType];
        category.ships.forEach(ship => {
          const shipId = this.getShipId(ship);
          if (this.selectedShipIds.has(shipId)) {
            const power = ship.getPower ? ship.getPower() : ship.power || 0;
            totalPower += power;
          }
        });
      });
    });

    return totalPower;
  }

  /**
   * Calculate selection count for a power group
   */
  calculatePowerGroupSelectionCount(powerGroup) {
    let selectedCount = 0;
    ['undamaged', 'damagedMobile'].forEach(categoryType => {
      const category = powerGroup.categories[categoryType];
      category.ships.forEach(ship => {
        const shipId = this.getShipId(ship);
        if (this.selectedShipIds.has(shipId)) {
          selectedCount++;
        }
      });
    });
    return selectedCount;
  }

  /**
   * Calculate available count for a power group (total minus assigned to other destinations)
   */
  calculatePowerGroupAvailableCount(powerGroup) {
    const assignedShipIds = this.calculateAvailableShips();
    let availableCount = 0;
    
    ['undamaged', 'damagedMobile'].forEach(categoryType => {
      const category = powerGroup.categories[categoryType];
      category.ships.forEach(ship => {
        const shipId = this.getShipId(ship);
        if (!assignedShipIds.has(shipId)) {
          availableCount++;
        }
      });
    });
    return availableCount;
  }

  /**
   * Calculate immobile count for a power group
   */
  calculatePowerGroupImmobileCount(powerGroup) {
    let immobileCount = 0;
    const category = powerGroup.categories['damagedImmobile'];
    if (category) {
      immobileCount = category.ships.length;
    }
    return immobileCount;
  }

  /**
   * Calculate immobile count for a category
   */
  calculateCategoryImmobileCount(category) {
    return category.ships.length;
  }

  /**
   * Calculate selection count for a category
   */
  calculateCategorySelectionCount(category) {
    let selectedCount = 0;
    category.ships.forEach(ship => {
      const shipId = this.getShipId(ship);
      if (this.selectedShipIds.has(shipId)) {
        selectedCount++;
      }
    });
    return selectedCount;
  }

  /**
   * Calculate available count for a category (total minus assigned to other destinations)
   */
  calculateCategoryAvailableCount(category) {
    const assignedShipIds = this.calculateAvailableShips();
    let availableCount = 0;
    
    category.ships.forEach(ship => {
      const shipId = this.getShipId(ship);
      if (!assignedShipIds.has(shipId)) {
        availableCount++;
      }
    });
    return availableCount;
  }

  /**
   * Toggle selection for all ships in a power group
   */
  togglePowerGroupSelection(powerGroup, select) {
    console.log('🚀 MoveDialog: Toggling power group selection:', powerGroup, select);
    const assignedShipIds = this.calculateAvailableShips();
    
    ['undamaged', 'damagedMobile'].forEach(categoryType => {
      const category = powerGroup.categories[categoryType];
      category.ships.forEach(ship => {
        const shipId = this.getShipId(ship);
        // Only select/deselect available ships
        if (!assignedShipIds.has(shipId)) {
          if (select) {
            this.selectedShipIds.add(shipId);
          } else {
            this.selectedShipIds.delete(shipId);
          }
        }
      });
    });
    
    this.updateSelectionSummary();
    this.updateMoveButton();
    this.renderShipTree();
  }

  /**
   * Toggle selection for all ships in a category
   */
  toggleCategorySelection(category, categoryType, select) {
    // Don't allow selection of damaged immobile ships
    if (categoryType === 'damagedImmobile') {
      return;
    }
    
    const assignedShipIds = this.calculateAvailableShips();
    
    category.ships.forEach(ship => {
      const shipId = this.getShipId(ship);
      // Only select/deselect available ships
      if (!assignedShipIds.has(shipId)) {
        if (select) {
          this.selectedShipIds.add(shipId);
        } else {
          this.selectedShipIds.delete(shipId);
        }
      }
    });
    
    this.updateSelectionSummary();
    this.updateMoveButton();
    this.renderShipTree();
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
    this.renderShipTree();
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
    this.renderShipTree();
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
     this.renderShipTree();
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
     this.renderShipTree();
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
    this.expandedNodes.clear();
    this.shipTreeData = null;
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