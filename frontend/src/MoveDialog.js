import { getShipDisplayName } from './utils/shipGrouping.js';
import { eventBus } from './eventBus.js';
import { DualSlider } from './DualSlider.js';
import { BaseDialog } from './BaseDialog.js';
import { MoveDialogView } from './MoveDialogView.js';
import { RB } from './utils/RequestBuilder.js';

/**
 * MoveDialog - A draggable dialog for managing fleet movement
 * Shows connected stars for movement selection and hierarchical ship tree
 */
export class MoveDialog extends BaseDialog
{
  constructor()
  {
    super(); // Call BaseDialog constructor
    
    this.currentStar = null;
    this.selectedDestination = null;
    this.currentPlayer = null;
    this.currentMoveOrder = null;
    this.selectedShipIds = new Set();
    this.loadedOrders = []; // Track orders loaded from database (deprecated)
    this.currentOrders = []; // Current move orders for the current star
    this.isSubmitting = false; // Track if currently submitting an order
    
    // Standing orders state
    this.standingOrdersMode = false;
    
    // Create view instance
    this.view = new MoveDialogView();
    this.view.createDialog(
      () => this.handleCloseClick(),
      this.view.getDragHandle()
    );
    
    // Set BaseDialog's dialog property to point to the view's dialog
    this.dialog = this.view.dialog;
    
    // Setup drag handlers using the view's drag handle
    this.setupDragHandlers(this.view.getDragHandle());
    
    // Setup view event listeners
    this.setupViewEventListeners();
    
    // Setup order event listeners
    this.setupOrderEventListeners();
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
   * Set up event listeners for view interactions
   */
  setupViewEventListeners() {
    this.view.setupEventListeners({
      onDamageThresholdChange: (threshold) => this.updateDamageThreshold(threshold),
      onSelectAllMobile: () => this.selectAllMobileShips(),
      onClearSelection: () => this.clearShipSelection(),
      onSubmitOrder: () => this.moveFleet(),
      onCancelOrder: () => this.cancelOrder(),
      onPrevStar: () => this.navigateToPreviousStar(),
      onNextStar: () => this.navigateToNextStar(),
      onStarNameClick: () => this.handleStarNameClick(),
      onStandingOrdersToggle: () => this.handleStandingOrdersToggle()
    });
    
    // Add checkbox change handler
    if (this.view.standingOrdersCheckbox) {
      this.view.standingOrdersCheckbox.addEventListener('change', () => {
        this.handleStandingOrdersToggle();
      });
    }
  }

  /**
   * Set up event listeners for order responses
   */
  setupOrderEventListeners() {
    // Listen for order submission success
    eventBus.on('order:move.submitSuccess', this.handleOrderSubmitSuccess.bind(this));
    
    // Listen for order submission error
    eventBus.on('order:move.submitError', this.handleOrderSubmitError.bind(this));
    
    // Listen for order loading success
    eventBus.on('order:move.loadSuccess', this.handleOrderLoadSuccess.bind(this));
    
    // Listen for order loading error
    eventBus.on('order:move.loadError', this.handleOrderLoadError.bind(this));
    
    console.log('🚀 MoveDialog: Event listeners set up');
  }

  /**
   * Handle order submission success
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing order information
   */
  handleOrderSubmitSuccess(context, eventData) {
    console.log('🚀 MoveDialog: Order submitted successfully:', eventData);
    console.log('🚀 MoveDialog: context:', context);
    
    // Always unlock UI after submission completes
    this.disableSubmissionUI();
    
    // Check if this is for the current star
    if (eventData.details.payload?.sourceStarId === this.currentStar?.getId()) {
      
      // Update current orders with the returned orders from the server
      if (eventData.details.orders) {
        this.currentOrders = eventData.details.orders;
        console.log('🚀 MoveDialog: Updated currentOrders with server response:', this.currentOrders.length);
      }
      
      // Store destination before any UI updates that might clear it
      const preservedDestination = this.selectedDestination;
      
      // Update UI to reflect the saved order
      this.updateConnectedStarsList(); // Refresh rocket icons
      
      // Show appropriate confirmation based on action
      const fromStar = this.currentStar.getName();
      const toStar = preservedDestination.getName();
      
      if (eventData.details.payload.action === 'cancel') {
        // For cancellation, clear selections after successful cancel
        this.selectedShipIds.clear();
        this.currentMoveOrder = null;
        this.updateShipList();
        this.view.showCancelConfirmation(fromStar, toStar);
        console.log('🚀 MoveDialog: Selections cleared after successful cancellation');
      } else {
        // For move orders, preserve selections (both destination and ships)
        this.view.showMoveConfirmation(fromStar, toStar);
        
        // Explicitly preserve the destination selection
        this.selectedDestination = preservedDestination;
        
        // Re-apply the selected styling to the destination star
        this.view.updateDestinationSelection(this.selectedDestination);
        
        console.log('🚀 MoveDialog: Selections preserved after successful submission');
      }
      
      // Update button states after preserving selections
      this.updateMoveButton();
    }
  }

  /**
   * Handle order submission error
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data containing error information
   */
  handleOrderSubmitError(context, eventData) {
    console.error('🚀 MoveDialog: Order submission failed:', eventData);
    console.log('🚀 MoveDialog: context:', context);
    
    // Always unlock UI after submission completes (even on error)
    this.disableSubmissionUI();
    
    // Check if this is for the current star
    if (eventData.details.payload?.sourceStarId === this.currentStar?.getId()) {
      
      // Show error message to user
      alert(`Failed to submit move order: ${eventData.details.error || 'Unknown error'}`);
      
      // Preserve selections on error - user can try again!
      console.log('🚀 MoveDialog: Selections preserved after failed submission - user can retry');
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




  /**
   * Setup keyboard handlers for accessibility
   */
  setupKeyboardHandlers() {
    // Call parent setupKeyboardHandlers first
    super.setupKeyboardHandlers();
  }

  /**
   * Handle close button click
   */
  handleCloseClick() {
    if (this.isSubmitting) {
      console.log('🚀 MoveDialog: Cannot close dialog during submission');
      return;
    }
    this.hide();
  }

  /**
   * Handle ESC key press - override BaseDialog behavior
   */
  handleEscapeKey() {
    // Prevent ESC from closing dialog during submission
    if (this.isSubmitting) {
      console.log('🚀 MoveDialog: Cannot close dialog with ESC during submission');
      return;
    }
    
    // Call parent hide method
    super.hide();
  }


  /**
   * Show the dialog for a specific star
   */
  async show(star, player = null) {
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
    
    // Reset standing orders mode
    this.standingOrdersMode = false;
    if (this.view.standingOrdersCheckbox) {
      this.view.standingOrdersCheckbox.checked = false;
    }
    
    // Call parent show method
    super.show();
    
    // Reset damage threshold to 100% (show all ships)
    if (this.view.damageThresholdSlider) {
      this.view.damageThresholdSlider.value = '100';
      this.view.damageThresholdValue.textContent = '100%';
    }
    

    // Update star name
    const starName = star.getName();
    this.view.updateStarName(starName);

    // Update connected stars list (needed for both modes)
    this.updateConnectedStarsList();

    // Try to load standing orders first
    const standingOrders = await this.loadStandingOrders(star.getId());
    
    if (standingOrders && standingOrders.move && standingOrders.move.destinationStarId) {
      // Standing orders exist - enable standing orders mode
      this.standingOrdersMode = true;
      if (this.view.standingOrdersCheckbox) {
        this.view.standingOrdersCheckbox.checked = true;
      }
      
      // Select the destination star
      const lookupFunction = this.getStarLookupFunction();
      if (lookupFunction) {
        const destinationStar = lookupFunction(standingOrders.move.destinationStarId);
        if (destinationStar) {
          this.selectedDestination = destinationStar;
          // Find and select the destination star element
          const starItems = this.view.starsListContainer?.querySelectorAll('.star-item');
          if (starItems) {
            starItems.forEach(item => {
              const starNameElement = item.querySelector('.star-name');
              if (starNameElement && starNameElement.textContent === destinationStar.getName()) {
                this.view.applySelectionStyling(item);
              }
            });
          }
        }
      }
      
      // Disable ship selection UI
      this.view.disableShipTree();
      
      console.log('🚀 MoveDialog: Loaded standing orders:', standingOrders.move);
    } else {
      // No standing orders - enable ship selection UI
      this.view.enableShipTree();
      this.view.resetSelectionSummary();

      // Load orders from database for this star
      eventBus.emit('order:move.loadForStar', {
        success: true,
        details: {
          eventType: 'order:move.loadForStar',
          sourceStarId: this.currentStar.getId(),
          orderType: 'move'
        }
      });

      // Initialize power range slider
      this.initializePowerRangeSlider();

      // Update ship list
      this.updateShipList();
    }

    // Reset move button
    this.updateMoveButton();

    console.log('🚀 MoveDialog: Opened for star:', starName, 'player:', this.currentPlayer.id, standingOrders ? '(with standing orders)' : '(regular orders)');
    
    // Update navigation buttons based on available owned stars
    this.updateNavigationButtons();
  }

  /**
   * Get all stars owned by the current player that have ships, sorted alphabetically
   * @returns {Array} Array of owned star objects that have ships
   */
  getOwnedStarsSorted() {
    if (!window.globalMapModel || !this.currentPlayer) {
      return [];
    }

    const allStars = window.globalMapModel.getStars();
    const ownedStars = allStars.filter(star => {
      const owner = star.getOwner();
      if (!owner || owner.id !== this.currentPlayer.id) {
        return false;
      }
      
      // Only include stars that have ships
      const ships = star.getShips();
      if (!ships || ships.length === 0) {
        return false;
      }
      
      // Filter out destroyed ships and check if any active ships remain
      const activeShips = ships.filter(ship => {
        if (ship.status !== undefined) {
          return ship.status !== 'destroyed';
        }
        return true; // Include ships without status property for backwards compatibility
      });
      
      return activeShips.length > 0;
    });

    // Sort alphabetically by star name
    return ownedStars.sort((a, b) => {
      const nameA = a.getName().toLowerCase();
      const nameB = b.getName().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  /**
   * Get the index of the current star in the sorted owned stars list
   * @returns {number} Index of current star, or -1 if not found
   */
  getCurrentStarIndex() {
    if (!this.currentStar) return -1;
    
    const ownedStars = this.getOwnedStarsSorted();
    const currentStarId = this.currentStar.getId();
    
    return ownedStars.findIndex(star => star.getId() === currentStarId);
  }

  /**
   * Update navigation button states based on current position
   */
  updateNavigationButtons() {
    const ownedStars = this.getOwnedStarsSorted();
    const currentIndex = this.getCurrentStarIndex();
    
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < ownedStars.length - 1;
    
    this.view.updateNavigationButtons(hasPrev, hasNext);
  }

  /**
   * Navigate to the previous owned star (alphabetically)
   */
  navigateToPreviousStar() {
    const ownedStars = this.getOwnedStarsSorted();
    const currentIndex = this.getCurrentStarIndex();
    
    if (currentIndex <= 0) {
      console.warn('🚀 MoveDialog: No previous star available');
      return;
    }
    
    const prevStar = ownedStars[currentIndex - 1];
    console.log(`🚀 MoveDialog: Navigating to previous star: ${prevStar.getName()}`);
    
    // Show the previous star (this will reload its state and orders)
    this.show(prevStar, this.currentPlayer);
  }

  /**
   * Navigate to the next owned star (alphabetically)
   */
  navigateToNextStar() {
    const ownedStars = this.getOwnedStarsSorted();
    const currentIndex = this.getCurrentStarIndex();
    
    if (currentIndex < 0 || currentIndex >= ownedStars.length - 1) {
      console.warn('🚀 MoveDialog: No next star available');
      return;
    }
    
    const nextStar = ownedStars[currentIndex + 1];
    console.log(`🚀 MoveDialog: Navigating to next star: ${nextStar.getName()}`);
    
    // Show the next star (this will reload its state and orders)
    this.show(nextStar, this.currentPlayer);
  }

  /**
   * Handle star name click to show selection dropdown
   */
  handleStarNameClick() {
    const ownedStars = this.getOwnedStarsSorted();
    const currentStarId = this.currentStar ? this.currentStar.getId() : null;
    
    // Show dropdown with stars
    this.view.showStarSelectionDropdown(
      ownedStars,
      (star) => this.handleStarSelection(star),
      currentStarId
    );
  }

  /**
   * Handle star selection from dropdown
   * @param {Object} star - Selected star object
   */
  handleStarSelection(star) {
    if (!star) {
      console.warn('🚀 MoveDialog: No star provided for selection');
      return;
    }
    
    console.log(`🚀 MoveDialog: Star selected from dropdown: ${star.getName()}`);
    
    // Show the selected star (this will reload its state and orders)
    this.show(star, this.currentPlayer);
  }

  /**
   * Load standing orders for the current star
   */
  async loadStandingOrders(starId) {
    const context = eventBus.getContext();
    const gameId = context.gameId;
    const playerId = context.playerId; // Use playerId from context, not user (user is user_id)

    if (!gameId || !playerId) {
      console.warn('🚀 MoveDialog: Cannot load standing orders - missing gameId or playerId');
      return null;
    }

    try {
      const response = await fetch(`/api/orders/standing/${starId}?gameId=${gameId}`, {
        headers: RB.getHeadersForGet()
      });
      if (!response.ok) {
        console.warn('🚀 MoveDialog: Failed to load standing orders:', response.statusText);
        return null;
      }

      const result = await response.json();
      return result.standingOrders;
    } catch (error) {
      console.error('🚀 MoveDialog: Error loading standing orders:', error);
      return null;
    }
  }

  /**
   * Save standing orders for the current star
   */
  async saveStandingOrders(starId, standingOrders) {
    const context = eventBus.getContext();
    const gameId = context.gameId;
    const playerId = context.playerId; // Use playerId from context, not user (user is user_id)

    if (!gameId || !playerId) {
      console.error('🚀 MoveDialog: Cannot save standing orders - missing gameId or playerId');
      throw new Error('Missing gameId or playerId');
    }

    try {
      const response = await fetch('/api/orders/standing', {
        method: 'POST',
        headers: RB.getHeaders(),
        body: JSON.stringify({
          gameId,
          starId,
          playerId,
          standingOrders
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save standing orders');
      }

      const result = await response.json();
      console.log('🚀 MoveDialog: Standing orders saved:', result);
      return result;
    } catch (error) {
      console.error('🚀 MoveDialog: Error saving standing orders:', error);
      throw error;
    }
  }

  /**
   * Delete standing orders for the current star
   */
  async deleteStandingOrders(starId) {
    const context = eventBus.getContext();
    const gameId = context.gameId;
    const playerId = context.playerId; // Use playerId from context, not user (user is user_id)

    if (!gameId || !playerId) {
      console.error('🚀 MoveDialog: Cannot delete standing orders - missing gameId or playerId');
      throw new Error('Missing gameId or playerId');
    }

    try {
      const response = await fetch(`/api/orders/standing/${starId}?gameId=${gameId}&playerId=${playerId}`, {
        method: 'DELETE',
        headers: RB.getHeadersForGet()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete standing orders');
      }

      const result = await response.json();
      console.log('🚀 MoveDialog: Standing orders deleted:', result);
      return result;
    } catch (error) {
      console.error('🚀 MoveDialog: Error deleting standing orders:', error);
      throw error;
    }
  }

  /**
   * Handle standing orders toggle
   */
  handleStandingOrdersToggle() {
    this.standingOrdersMode = this.view.standingOrdersCheckbox?.checked || false;
    
    if (this.standingOrdersMode) {
      // Disable ship selection UI
      this.view.disableShipTree();
      // Clear ship selection since all ships will move
      this.selectedShipIds.clear();
      this.updateSelectionSummary();
    } else {
      // Enable ship selection UI
      this.view.enableShipTree();
      this.view.resetSelectionSummary();
      this.updateSelectionSummary();
    }
    
    this.updateMoveButton();
    console.log('🚀 MoveDialog: Standing orders mode:', this.standingOrdersMode);
  }

  /**
   * Update the connected stars list
   */
  updateConnectedStarsList() {
    if (!this.currentStar) return;

    // Get connected star IDs and look up the actual star objects
    const connectedStarIds = this.currentStar.getConnectedStarIds ? this.currentStar.getConnectedStarIds() : [];
    const lookupFunction = this.getStarLookupFunction();
    const connectedStars = connectedStarIds
      .map(starId => lookupFunction ? lookupFunction(starId) : null)
      .filter(star => star !== null);

    // Update view with connected stars
    this.view.updateConnectedStarsList(
      connectedStars,
      (star, starItem) => this.selectDestination(star, starItem),
      (star) => this.checkForExistingMoveOrder(star)
    );
  }

     /**
    * Clear destination selection
    */
   clearDestinationSelection() {
     console.log('🚀 MoveDialog: Clearing destination selection');
     
     // Clear previous selection styling
     this.view.clearDestinationSelection(this.currentStar, () => this.getStarLookupFunction());
     
     this.selectedDestination = null;
     
     // Disable ship tree
     this.view.disableShipTree();
   }

   /**
    * Select a destination star
    */
   selectDestination(star, element) {
    // Clear previous selection
    this.view.clearDestinationSelection(this.currentStar, () => this.getStarLookupFunction());

    // Select new destination
    this.selectedDestination = star;
    
    // Apply selection styling
    this.view.applySelectionStyling(element);

    // Enable ship tree and update ship selection based on current orders
    this.view.enableShipTree();
    this.updateShipSelection();
    this.updateMoveButton();

    console.log(`🚀 MoveDialog: Selected destination: ${star.getName()}(${star.getId()})`);
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
    if (!this.currentStar || !this.view.powerRangeSliderContainer) return;

    // Get ships at this star
    const ships = this.currentStar.getShips();
    
    // Filter out destroyed ships
    const activeShips = ships.filter(ship => {
      if (ship.status !== undefined) {
        return ship.status !== 'destroyed';
      }
      return true;
    });
    
    // Calculate power range
    const powerRange = this.calculatePowerRange(activeShips);
    
    // Destroy existing slider if it exists
    if (this.view.powerRangeSlider) {
      this.view.powerRangeSlider.destroy();
    }
    
    // Create new DualSlider
    this.view.powerRangeSlider = new DualSlider(this.view.powerRangeSliderContainer, {
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
    
    // Filter out destroyed ships
    const activeShips = ships.filter(ship => {
      // Check if ship has status property and exclude destroyed ships
      if (ship.status !== undefined) {
        return ship.status !== 'destroyed';
      }
      // If ship doesn't have status property, include it (for backwards compatibility)
      return true;
    });
    
    // Filter ships by damage threshold
    const damageFilteredShips = this.filterShipsByDamageThreshold(activeShips);
    
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
    const threshold = this.view.damageThresholdSlider ? parseInt(this.view.damageThresholdSlider.value) : 100;
    
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
    if (!this.view.powerRangeSlider) {
      return ships; // No filtering if slider not initialized
    }
    
    const values = this.view.powerRangeSlider.getValues();
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
    if (this.view.damageThresholdValue) {
      this.view.damageThresholdValue.textContent = `${threshold}%`;
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
    // Sort ships by damage (least damaged first) then power (highest first)
    const sortedShips = this.sortShips(ships);

    // Delegate to view for rendering
    this.view.renderShipList(sortedShips, (ship) => this.createShipElement(ship));

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
    return this.view.createShipElement(
      ship,
      (ship) => this.getShipId(ship),
      (shipId) => this.hasShipOrdersToOtherDestinations(shipId),
      (rocketIcon, shipId) => this.showShipOrderTooltip(rocketIcon, shipId),
      (ship) => this.toggleShipSelection(ship),
      this.selectedShipIds,
      (ship) => getShipDisplayName(ship)
    );
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
   * Check if a ship has orders to other destinations (not the currently selected one)
   */
  hasShipOrdersToOtherDestinations(shipId) {
    if (!this.currentOrders.length) return false;
    
    return this.currentOrders.some(order => {
      // Skip if this is for the currently selected destination
      if (this.selectedDestination && order.payload && order.payload.destinationStarId === this.selectedDestination.getId()) {
        return false;
      }
      
      // Check if ship is in this order's selected ships
      return order.payload && order.payload.selectedShipIds && order.payload.selectedShipIds.includes(shipId);
    });
  }

  /**
   * Get tooltip text for a ship with orders to other destinations
   */
  getShipOrderTooltip(shipId) {
    if (!this.currentOrders.length) return '';
    
    const orderForShip = this.currentOrders.find(order => {
      // Skip if this is for the currently selected destination
      if (this.selectedDestination && order.payload && order.payload.destinationStarId === this.selectedDestination.getId()) {
        return false;
      }
      
      // Check if ship is in this order's selected ships
      return order.payload && order.payload.selectedShipIds && order.payload.selectedShipIds.includes(shipId);
    });
    
    if (orderForShip && orderForShip.payload && orderForShip.payload.destinationStarId) {
      const destinationStarId = orderForShip.payload.destinationStarId;
      const lookupFunction = this.getStarLookupFunction();
      if (lookupFunction) {
        const destinationStar = lookupFunction(destinationStarId);
        if (destinationStar) {
          return `Moving to ${destinationStar.getName()}`;
        }
      }
      return `Moving to Star ${destinationStarId}`;
    }
    
    return 'Has move orders to another destination';
  }

  /**
   * Show tooltip for ship orders
   */
  showShipOrderTooltip(rocketIcon, shipId) {
    this.view.showShipOrderTooltip(rocketIcon, shipId, (shipId) => this.getShipOrderTooltip(shipId));
  }

  /**
   * Hide ship order tooltip
   */
  hideShipOrderTooltip() {
    this.view.hideShipOrderTooltip();
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
    if (!this.view.selectionSummary) return;

    const selectedCount = this.selectedShipIds.size;
    const totalPower = this.calculateSelectedPower();

    if (selectedCount === 0) {
      this.view.selectionSummary.textContent = 'No ships selected';
          } else {
      this.view.selectionSummary.textContent = `${selectedCount} ships selected (${totalPower} power)`;
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
    if (this.standingOrdersMode) {
      // In standing orders mode, only need destination selected
      return this.selectedDestination !== null;
    }
    // Normal mode: need both destination and ships selected
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
    this.view.updateButtonStates(this.canSubmit(), this.canCancel());
  }

  /**
   * Cancel the move order for the selected destination
   */
  cancelOrder() {
    if (!this.canCancel()) {
      console.warn('MoveDialog: Cannot cancel - no existing order for this destination');
      return;
    }

    if (this.isSubmitting) {
      console.warn('MoveDialog: Already submitting an order, please wait');
      return;
    }

    const fromStar = this.currentStar.getName();
    const toStar = this.selectedDestination.getName();
    
    console.log(`🚀 MoveDialog: Cancelling move order from ${fromStar} to ${toStar}`);
    
    // Lock UI before submission
    this.enableSubmissionUI();
    
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
        eventBus.emit('order:move.submit', {
          success: true,
          details: {
            eventType: 'order:move.submit',
            orderType: 'move',
            payload: orderData
          }
        });
    }
    
    // Note: UI updates and confirmations are handled in the response handlers
    // Selections are preserved for user to retry if needed
  }

  /**
   * Submit the move order for the selected destination
   */
  async moveFleet() {
    if (!this.canSubmit()) {
      console.warn('MoveDialog: Cannot submit - missing destination or ship selection');
      return;
    }

    if (this.isSubmitting) {
      console.warn('MoveDialog: Already submitting an order, please wait');
      return;
    }

    const starId = this.currentStar.getId();
    const fromStar = this.currentStar.getName();
    const toStar = this.selectedDestination.getName();
    
    // Lock UI before submission
    this.enableSubmissionUI();

    try {
      if (this.standingOrdersMode) {
        // Save standing orders
        const standingOrders = {
          move: {
            destinationStarId: this.selectedDestination.getId()
          }
        };

        await this.saveStandingOrders(starId, standingOrders);
        this.view.showMoveConfirmation(fromStar, toStar);
        console.log('🚀 MoveDialog: Standing orders saved:', standingOrders);
      } else {
        // Check if standing orders exist - if so, delete them first
        const existingStandingOrders = await this.loadStandingOrders(starId);
        if (existingStandingOrders && existingStandingOrders.move) {
          await this.deleteStandingOrders(starId);
          console.log('🚀 MoveDialog: Deleted existing standing orders');
        }

        // Submit regular order
        console.log(`🚀 MoveDialog: Submitting move order from ${fromStar} to ${toStar}`);
        
        // Prepare order data for database submission
        const orderData = {
          action: 'move',
          sourceStarId: starId,
          destinationStarId: this.selectedDestination.getId(),
          selectedShipIds: Array.from(this.selectedShipIds)
        };

        console.log('🚀 MoveDialog: Submitting move order via event system', orderData);

        // Emit order submission event
        eventBus.emit('order:move.submit', {
          success: true,
          details: {
            eventType: 'order:move.submit',
            orderType: 'move',
            payload: orderData
          }
        });
      }
    } catch (error) {
      console.error('🚀 MoveDialog: Error submitting order:', error);
      alert(`Failed to submit order: ${error.message || 'Unknown error'}`);
    } finally {
      // Unlock UI after submission completes
      this.disableSubmissionUI();
    }
    
    // Note: UI updates and confirmations are handled in the response handlers or above
    // Selections are preserved for user to retry if needed
  }


  /**
   * Hide the dialog
   */
  hide() {
    // Clear MoveDialog specific state
    this.currentStar = null;
    this.currentPlayer = null;
    this.currentMoveOrder = null;
    this.selectedDestination = null;
    this.selectedShipIds.clear();
    this.currentOrders = []; // Clear current orders
    this.isSubmitting = false; // Reset submission state
    this.view.hideShipOrderTooltip(); // Clean up any tooltips
    
    // Call parent hide method
    super.hide();
    
    // Reset damage threshold to 100% for next time
    if (this.view.damageThresholdSlider) {
      this.view.damageThresholdSlider.value = '100';
      this.view.damageThresholdValue.textContent = '100%';
    }
    
    // Clean up power range slider
    if (this.view.powerRangeSlider) {
      this.view.powerRangeSlider.destroy();
      this.view.powerRangeSlider = null;
    }
    
    console.log('🚀 MoveDialog: Closed');
  }


  /**
   * Enable UI controls during submission
   */
  enableSubmissionUI() {
    this.isSubmitting = true;
    this.view.enableSubmissionUI();
    console.log('🚀 MoveDialog: UI locked for submission');
  }

  /**
   * Disable UI controls after submission completes
   */
  disableSubmissionUI() {
    this.isSubmitting = false;
    this.view.disableSubmissionUI();
    console.log('🚀 MoveDialog: UI unlocked after submission');
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