import { MoveOrder, moveOrderStore } from '@loh/shared';
import { groupShipsByPowerAndDamage, getShipDisplayName, getShipHealthPercentage, canShipMove } from './utils/shipGrouping.js';

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
    
    this.createDialog();
  }

  createDialog()
  {
    this.dialog = document.createElement('div');
    this.dialog.className = 'move-dialog dialog-base';
    this.dialog.style.width = '800px';

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
    this.isVisible = true;
    this.dialog.style.display = 'block';

    // Update star name
    const starName = star.getName ? star.getName() : `Star ${star.id}`;
    this.starNameElement.textContent = starName;

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

    // Get connected stars
    const connectedStars = this.currentStar.getConnectedStars ? this.currentStar.getConnectedStars() : [];

    if (connectedStars.length === 0) {
      const noStarsMessage = document.createElement('div');
      noStarsMessage.textContent = 'No connected stars available';
      noStarsMessage.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #888;
        font-style: italic;
      `;
      this.starsListContainer.appendChild(noStarsMessage);
      return;
    }

    // Create star selection items
    connectedStars.forEach(star => {
      const starItem = document.createElement('div');
      starItem.className = 'star-item';
      starItem.style.cssText = `
        padding: 12px 15px;
        border-bottom: 1px solid #444;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      // Check if there's an existing move order to this star
      const hasMoveOrder = this.checkForExistingMoveOrder(star);

      const starName = star.getName ? star.getName() : `Star ${star.id}`;
      const starNameElement = document.createElement('span');
      starNameElement.textContent = starName;
      
      // Use star's color (owner's color) or light gray if unowned
      const starColor = star.color || '#CCCCCC';
      starNameElement.style.cssText = `
        color: ${starColor};
        font-weight: bold;
      `;

      // Create right side container for owner and rocket icon
      const rightSide = document.createElement('div');
      rightSide.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      // Show star owner if any
      const ownerElement = document.createElement('span');
      if (star.owner) {
        ownerElement.textContent = `(${star.owner.name || 'Owned'})`;
      }
      ownerElement.style.cssText = `
        font-size: 12px;
        color: #888;
      `;

      // Add rocket icon if there's an existing move order
      if (hasMoveOrder) {
        const rocketIcon = document.createElement('span');
        rocketIcon.textContent = '🚀';
        rocketIcon.style.cssText = `
          font-size: 14px;
          color: #00ff88;
        `;
        rocketIcon.title = 'Has existing move order';
        rightSide.appendChild(rocketIcon);
      }

      rightSide.appendChild(ownerElement);
      starItem.appendChild(starNameElement);
      starItem.appendChild(rightSide);

      // Hover effects
      starItem.addEventListener('mouseenter', () => {
        if (this.selectedDestination !== star) {
          starItem.style.background = '#444';
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
         const originalStar = this.currentStar.getConnectedStars().find(s => 
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
       this.shipTreeContainer.style.opacity = '0.5';
       this.shipTreeContainer.style.pointerEvents = 'none';
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
        const originalStar = this.currentStar.getConnectedStars().find(s => 
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
    element.style.background = '#00ff88';
    element.style.border = '1px solid #00ff88';
    
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
      this.shipTreeContainer.style.opacity = '1';
      this.shipTreeContainer.style.pointerEvents = 'auto';
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
      noShipsMessage.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #888;
        font-style: italic;
      `;
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
    groupElement.style.cssText = `
      margin-bottom: 10px;
      border: 1px solid #555;
      border-radius: 4px;
      background: #3a3a3a;
    `;

    // Power group header
    const header = document.createElement('div');
    header.className = 'power-group-header';
    header.style.cssText = `
      padding: 8px 12px;
      background: #444;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 4px 4px 0 0;
    `;

         const selectedCount = this.calculatePowerGroupSelectionCount(powerGroup);
     const availableCount = this.calculatePowerGroupAvailableCount(powerGroup);
     const immobileCount = this.calculatePowerGroupImmobileCount(powerGroup);
     
     // Add checkbox for "select all" in this power group
     const checkbox = document.createElement('input');
     checkbox.type = 'checkbox';
     checkbox.style.cssText = `
       margin-right: 8px;
       cursor: pointer;
     `;
     
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
    headerText.innerHTML = `Power ${powerGroup.power} (${selectedCount}/${availableCount}/<span style="color: #ff4444;">${immobileCount}</span> ships)`;
    headerText.style.cssText = `
      font-weight: bold;
      color: ${selectedCount > 0 ? '#00ff88' : '#00ff88'};
      flex: 1;
    `;

    const expandIcon = document.createElement('span');
    expandIcon.textContent = '▼';
    expandIcon.style.cssText = `
      font-size: 12px;
      transition: transform 0.2s;
    `;

    header.appendChild(checkbox);
    header.appendChild(headerText);
    header.appendChild(expandIcon);

    // Content container
    const content = document.createElement('div');
    content.className = 'power-group-content';
    content.style.cssText = `
      padding: 8px;
      display: none;
    `;

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
      content.style.display = 'block';
      expandIcon.style.transform = 'rotate(180deg)';
    }

    header.addEventListener('click', () => {
      const isCurrentlyExpanded = content.style.display !== 'none';
      
      if (isCurrentlyExpanded) {
        content.style.display = 'none';
        expandIcon.style.transform = 'rotate(0deg)';
        this.expandedNodes.delete(groupKey);
      } else {
        content.style.display = 'block';
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
    categoryElement.style.cssText = `
      margin-bottom: 8px;
    `;

    // Category header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.style.cssText = `
      padding: 6px 8px;
      background: #555;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 3px;
      margin-bottom: 4px;
    `;

    const categoryName = this.getCategoryDisplayName(categoryType);
    const selectedCount = this.calculateCategorySelectionCount(category);
    const availableCount = this.calculateCategoryAvailableCount(category);
    const totalCount = category.ships.length;
    
    // Add checkbox for "select all" in this category
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.cssText = `
      margin-right: 6px;
      cursor: pointer;
      transform: scale(0.8);
    `;
    
    // Disable checkbox for damaged immobile ships
    if (categoryType === 'damagedImmobile') {
      checkbox.disabled = true;
      checkbox.style.cssText = `
        margin-right: 6px;
        cursor: not-allowed;
        transform: scale(0.8);
        opacity: 0.5;
      `;
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
    headerText.style.cssText = `
      font-size: 13px;
      color: ${selectedCount > 0 ? '#00ff88' : this.getCategoryColor(categoryType)};
      flex: 1;
    `;

    const expandIcon = document.createElement('span');
    expandIcon.textContent = '▶';
    expandIcon.style.cssText = `
      font-size: 10px;
      transition: transform 0.2s;
    `;

    header.appendChild(checkbox);
    header.appendChild(headerText);
    header.appendChild(expandIcon);

    // Ships container
    const shipsContainer = document.createElement('div');
    shipsContainer.className = 'ships-container';
    shipsContainer.style.cssText = `
      padding-left: 15px;
      display: none;
    `;

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
      shipsContainer.style.display = 'block';
      expandIcon.style.transform = 'rotate(90deg)';
    }

    header.addEventListener('click', () => {
      const isCurrentlyExpanded = shipsContainer.style.display !== 'none';
      
      if (isCurrentlyExpanded) {
        shipsContainer.style.display = 'none';
        expandIcon.style.transform = 'rotate(0deg)';
        this.expandedNodes.delete(categoryKey);
      } else {
        shipsContainer.style.display = 'block';
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
    
    const playerId = this.currentPlayer.id;
    const originStarId = this.currentStar.id;
    const destStarId = destinationStar.id;
    
    return moveOrderStore.hasOrder(playerId, originStarId, destStarId);
  }

  /**
   * Calculate which ships are available for selection (not already assigned to other destinations)
   */
  calculateAvailableShips() {
    if (!this.currentPlayer || !this.currentStar) return new Set();
    
    const playerId = this.currentPlayer.id;
    const originStarId = this.currentStar.id;
    
    // Get all existing move orders for this origin star
    const existingOrders = moveOrderStore.getOrdersForOriginStar(playerId, originStarId);
    
    // Collect all ship IDs that are already assigned to other destinations
    const assignedShipIds = new Set();
    existingOrders.forEach(order => {
      // Don't include ships from the current destination (if any)
      if (this.selectedDestination && order.getDestStarId() === this.selectedDestination.id) {
        return;
      }
      order.getSelectedShipIds().forEach(shipId => {
        assignedShipIds.add(shipId);
      });
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
    shipElement.style.cssText = `
      padding: 4px 8px;
      margin: 2px 0;
      border-radius: 3px;
      cursor: pointer;
      transition: background-color 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const shipId = this.getShipId(ship);
    const isSelected = this.selectedShipIds.has(shipId);
    const canMove = categoryType !== 'damagedImmobile';
    
    // Check if ship is available (not assigned to other destinations)
    const assignedShipIds = this.calculateAvailableShips();
    const isAvailable = !assignedShipIds.has(shipId);

    if (isSelected) {
      shipElement.style.background = '#00ff88';
      shipElement.style.color = '#000';
      shipElement.style.border = '1px solid #00cc6a';
      shipElement.style.fontWeight = 'bold';
    } else if (!canMove || !isAvailable) {
      shipElement.style.background = '#666';
      shipElement.style.color = '#999';
      shipElement.style.cursor = 'not-allowed';
    } else {
      shipElement.style.background = 'transparent';
      shipElement.style.color = '#fff';
    }

    // Ship name
    const shipName = document.createElement('span');
    shipName.textContent = getShipDisplayName(ship);
    shipName.style.cssText = `
      font-size: 12px;
    `;

    // Ship health (for damaged ships)
    const healthInfo = document.createElement('span');
    if (categoryType !== 'undamaged') {
      const healthPercentage = getShipHealthPercentage(ship);
      healthInfo.textContent = `${Math.round(healthPercentage)}%`;
      
      // Ensure proper contrast for selected ships
      if (isSelected) {
        healthInfo.style.cssText = `
          font-size: 11px;
          color: #000;
          font-weight: bold;
        `;
      } else {
        healthInfo.style.cssText = `
          font-size: 11px;
          color: ${healthPercentage > 50 ? '#00ff88' : healthPercentage > 25 ? '#ffaa00' : '#ff4444'};
        `;
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

    const playerId = this.currentPlayer.id;
    const originStarId = this.currentStar.id;
    const destStarId = destinationStar.id;
    
    const previousOrder = moveOrderStore.getOrder(playerId, originStarId, destStarId);
    if (previousOrder) {
      this.currentMoveOrder = previousOrder;
      this.selectedShipIds = new Set(previousOrder.getSelectedShipIds());
      
      // Re-render to show selections
      this.renderShipTree();
      console.log('🚀 MoveDialog: Loaded previous selection for destination:', destinationStar.getName ? destinationStar.getName() : `Star ${destinationStar.id}`);
    } else {
      // Clear any existing selection if no previous order for this destination
      this.selectedShipIds.clear();
      this.currentMoveOrder = null;
      this.renderShipTree();
      console.log('🚀 MoveDialog: No previous selection found for destination:', destinationStar.getName ? destinationStar.getName() : `Star ${destinationStar.id}`);
    }
  }

  /**
   * Load previous selection (legacy method - kept for compatibility)
   */
  loadPreviousSelection() {
    if (!this.currentPlayer || !this.currentStar) return;

    const playerId = this.currentPlayer.id;
    const originStarId = this.currentStar.id;
    
    const previousOrder = moveOrderStore.getOrder(playerId, originStarId);
    if (previousOrder) {
      this.currentMoveOrder = previousOrder;
      this.selectedShipIds = new Set(previousOrder.getSelectedShipIds());
      
      // Re-render to show selections
      this.renderShipTree();
    }
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
      this.moveButton.style.opacity = '1';
      this.moveButton.style.pointerEvents = 'auto';
    } else {
      this.moveButton.style.opacity = '0.5';
      this.moveButton.style.pointerEvents = 'none';
    }

    // Update cancel button
    if (this.canCancel()) {
      this.cancelButton.style.opacity = '1';
      this.cancelButton.style.pointerEvents = 'auto';
    } else {
      this.cancelButton.style.opacity = '0.5';
      this.cancelButton.style.pointerEvents = 'none';
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
    
    // Remove the move order from store
    if (this.currentPlayer) {
      const playerId = this.currentPlayer.id;
      const originStarId = this.currentStar.id;
      const destStarId = this.selectedDestination.id;
      
      const removed = moveOrderStore.removeOrder(playerId, originStarId, destStarId);
      if (removed) {
        console.log('🚀 MoveDialog: Removed move order from store');
      } else {
        console.warn('🚀 MoveDialog: Failed to remove move order from store');
      }
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
    
    // Create MoveOrder
    const moveOrder = new MoveOrder({
      originStarId: this.currentStar.id,
      destStarId: this.selectedDestination.id,
      selectedShipIds: Array.from(this.selectedShipIds)
    });

    // Store the move order
    console.log('🚀 MoveDialog: currentPlayer:', this.currentPlayer);
    if (this.currentPlayer) {
      const playerId = this.currentPlayer.id;
      const originStarId = this.currentStar.id;
      const destStarId = this.selectedDestination.id;
      console.log('🚀 MoveDialog: Storing order with playerId:', playerId, 'originStarId:', originStarId, 'destStarId:', destStarId);
      moveOrderStore.storeOrder(playerId, originStarId, destStarId, moveOrder);
      
      console.log('🚀 MoveDialog: Stored move order:', moveOrder.getSummary());
    } else {
      console.warn('🚀 MoveDialog: No current player, cannot store move order');
    }
    
    // TODO: Implement actual fleet movement logic
    // For now, just log the action
    
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
    confirmation.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #00ff88;
      color: #000;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: bold;
      z-index: 3000;
      animation: slideIn 0.3s ease-out;
    `;

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
    confirmation.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: #fff;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: bold;
      z-index: 3000;
      animation: slideIn 0.3s ease-out;
    `;

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