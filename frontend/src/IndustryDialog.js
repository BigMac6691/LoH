/**
 * IndustryDialog - A draggable dialog for displaying and managing star industry
 */
import { eventBus } from './eventBus.js';
import { BaseDialog } from './BaseDialog.js';
import { RB, ApiError } from './utils/RequestBuilder.js';

export class IndustryDialog extends BaseDialog
{
  constructor()
  {
    super(); // Call BaseDialog constructor
    
    this.currentStar = null;

    // Spending orders tracking
    this.spendingOrders = {
      expand: 0,
      research: 0,
      build: 0,
    };

    // Standing orders state
    this.standingOrdersMode = false;
    this.standingOrdersCheckbox = null;

    this.createDialog();
    this.setupEventListeners();
  }

  /**
   * Create the dialog DOM element
   */
  createDialog()
  {
    this.dialog = document.createElement('div');
    this.dialog.className = 'industry-dialog dialog-base';
    this.dialog.style.width = '400px';

    // Create header (draggable area)
    const header = document.createElement('div');
    header.className = 'dialog-header';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Industry Manager';
    title.className = 'dialog-title';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'dialog-close-btn';
    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Star name container with navigation buttons
    const starNameContainer = document.createElement('div');
    starNameContainer.className = 'star-name-display';
    starNameContainer.style.position = 'relative';
    
    // Previous button
    this.prevStarButton = document.createElement('button');
    this.prevStarButton.textContent = '◀ Prev';
    this.prevStarButton.className = 'star-nav-button star-nav-prev';
    this.prevStarButton.title = 'Previous owned star';
    
    // Star name (centered, clickable)
    this.starNameElement = document.createElement('span');
    this.starNameElement.className = 'star-name-text clickable';
    this.starNameElement.style.cursor = 'pointer';
    this.starNameElement.title = 'Click to select a star';
    
    // Star selection dropdown
    this.starSelectionDropdown = document.createElement('div');
    this.starSelectionDropdown.className = 'star-selection-dropdown';
    this.starSelectionDropdown.style.display = 'none';
    
    // Next button
    this.nextStarButton = document.createElement('button');
    this.nextStarButton.textContent = 'Next ▶';
    this.nextStarButton.className = 'star-nav-button star-nav-next';
    this.nextStarButton.title = 'Next owned star';
    
    starNameContainer.appendChild(this.prevStarButton);
    starNameContainer.appendChild(this.starNameElement);
    starNameContainer.appendChild(this.nextStarButton);
    starNameContainer.appendChild(this.starSelectionDropdown);
    
    this.dialog.appendChild(header);
    this.dialog.appendChild(starNameContainer);

    // Content area
    const content = document.createElement('div');
    content.className = 'dialog-content';

    // Economy values
    this.createEconomySection(content);

    // Spending orders section
    this.createSpendingOrdersSection(content);

    this.dialog.appendChild(content);

    // Add to DOM
    document.body.appendChild(this.dialog);

    // Setup drag functionality using BaseDialog's method
    this.setupDragHandlers(header);
  }

  /**
   * Set up event listeners for order responses
   */
  setupEventListeners()
  {
    // Listen for order submission success
    eventBus.on('order:build.submitSuccess', this.handleOrderSubmitSuccess.bind(this));
    
    // Listen for order submission error
    eventBus.on('order:build.submitError', this.handleOrderSubmitError.bind(this));
    
    // Listen for order loading success
    eventBus.on('order:build.loadSuccess', this.handleOrderLoadSuccess.bind(this));
    
    // Listen for order loading error
    eventBus.on('order:build.loadError', this.handleOrderLoadError.bind(this));
    
    // Navigation button event listeners
    if (this.prevStarButton) {
      this.prevStarButton.addEventListener('click', () => this.navigateToPreviousStar());
    }
    
    if (this.nextStarButton) {
      this.nextStarButton.addEventListener('click', () => this.navigateToNextStar());
    }

    // Star name click to show dropdown
    if (this.starNameElement) {
      this.starNameElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleStarNameClick();
      });
    }

    // Click outside to close dropdown
    document.addEventListener('click', (e) => {
      if (this.starSelectionDropdown && 
          this.starSelectionDropdown.style.display !== 'none' &&
          !this.dialog.contains(e.target)) {
        this.hideStarSelectionDropdown();
      }
    });
    
    console.log('🏭 IndustryDialog: Event listeners set up');
  }

  /**
   * Create the economy values section
   */
  createEconomySection(container)
  {
    const section = document.createElement('div');
    section.className = 'dialog-section';

    // Resource (from star, not economy)
    const resourceRow = this.createValueRow('Resource', 'resource');
    section.appendChild(resourceRow);

    // Capacity
    const capacityRow = this.createValueRow('Capacity', 'capacity');
    section.appendChild(capacityRow);

    // Available
    const availableRow = this.createValueRow('Available', 'available');
    section.appendChild(availableRow);

    // Tech Level
    const techLevelRow = this.createValueRow('Tech Level', 'techLevel');
    section.appendChild(techLevelRow);

    container.appendChild(section);
  }

  /**
   * Create a value row with label and value
   */
  createValueRow(label, valueKey)
  {
    const row = document.createElement('div');
    row.className = 'value-row';

    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    labelElement.className = 'value-label';

    const valueElement = document.createElement('span');
    valueElement.className = `value-display value-${valueKey}`;

    row.appendChild(labelElement);
    row.appendChild(valueElement);

    return row;
  }

  /**
   * Create the spending orders section
   */
  createSpendingOrdersSection(container)
  {
    const section = document.createElement('div');
    section.className = 'spending-orders-section';

    // Section title
    const title = document.createElement('h3');
    title.textContent = 'Spending Orders';
    title.className = 'dialog-section-title';
    section.appendChild(title);

    // Create spending order controls
    this.createSpendingOrderControl(section, 'Expand', 'expand');
    this.createSpendingOrderControl(section, 'Research', 'research');
    this.createSpendingOrderControl(section, 'Build', 'build');

    // Total spending display
    const totalRow = document.createElement('div');
    totalRow.className = 'total-spending-row';

    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total Spending';
    totalLabel.className = 'value-label';

    this.totalSpendingElement = document.createElement('span');
    this.totalSpendingElement.className = 'value-display';

    totalRow.appendChild(totalLabel);
    totalRow.appendChild(this.totalSpendingElement);
    section.appendChild(totalRow);

    // Standing orders checkbox (placed just above submit button)
    const standingOrdersContainer = document.createElement('div');
    standingOrdersContainer.className = 'standing-orders-container';
    standingOrdersContainer.style.marginBottom = '10px';
    
    this.standingOrdersCheckbox = document.createElement('input');
    this.standingOrdersCheckbox.type = 'checkbox';
    this.standingOrdersCheckbox.id = 'standing-orders-checkbox';
    this.standingOrdersCheckbox.className = 'standing-orders-checkbox';
    
    const standingOrdersLabel = document.createElement('label');
    standingOrdersLabel.htmlFor = 'standing-orders-checkbox';
    standingOrdersLabel.textContent = 'Standing Orders';
    standingOrdersLabel.style.marginLeft = '5px';
    standingOrdersLabel.style.cursor = 'pointer';
    
    standingOrdersContainer.appendChild(this.standingOrdersCheckbox);
    standingOrdersContainer.appendChild(standingOrdersLabel);
    
    // Add change handler for checkbox
    this.standingOrdersCheckbox.addEventListener('change', () => {
      this.handleStandingOrdersToggle();
    });
    
    section.appendChild(standingOrdersContainer);

    // Submit Order button
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit Order';
    submitButton.className = 'dialog-btn';

    // Click handler
    submitButton.addEventListener('click', async () =>
    {
      await this.submitOrder();
    });

    section.appendChild(submitButton);

    container.appendChild(section);
  }

  /**
   * Create a spending order control with slider and number input
   */
  createSpendingOrderControl(container, label, key)
  {
    const controlRow = document.createElement('div');
    controlRow.className = 'spending-control';

    // Label
    const labelElement = document.createElement('div');
    labelElement.textContent = label;
    labelElement.className = 'spending-control-label';
    controlRow.appendChild(labelElement);

    // Control container
    const controlContainer = document.createElement('div');
    controlContainer.className = 'spending-control-container';

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';
    slider.step = '1';
    slider.className = 'spending-slider';

    // Number input
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '0';
    numberInput.max = '100';
    numberInput.value = '0';
    numberInput.className = 'spending-number-input';

    // Store references for later use
    if (!this.spendingControls)
    {
      this.spendingControls = {};
    }
    this.spendingControls[key] = {slider, numberInput};

    // Link slider and number input
    slider.addEventListener('input', e =>
    {
      const value = parseInt(e.target.value);
      numberInput.value = value;
      this.spendingOrders[key] = value;
      this.updateSpendingConstraints();
      this.updateTotalSpending();
    });

    numberInput.addEventListener('input', e =>
    {
      const value = parseInt(e.target.value) || 0;
      slider.value = value;
      this.spendingOrders[key] = value;
      this.updateSpendingConstraints();
      this.updateTotalSpending();
    });

    controlContainer.appendChild(slider);
    controlContainer.appendChild(numberInput);
    controlRow.appendChild(controlContainer);
    container.appendChild(controlRow);
  }

  /**
   * Update spending constraints to ensure total doesn't exceed available
   */
  updateSpendingConstraints()
  {
    if (!this.currentStar || !this.currentStar.economy) return;

    const available = this.currentStar.economy.available || 0;
    const currentTotal = Object.values(this.spendingOrders).reduce(
      (sum, val) => sum + val,
      0
    );

    console.log('🏭 IndustryDialog: updateSpendingConstraints:');
    console.log('  - Standing orders mode:', this.standingOrdersMode);
    console.log('  - Available:', available);
    console.log('  - Current total:', currentTotal);
    console.log('  - Spending orders:', this.spendingOrders);

    if (this.standingOrdersMode)
    {
      // Percentage mode: max is 100, sum must be ≤ 100
      if (currentTotal > 100)
      {
        console.log('🏭 IndustryDialog: Total exceeds 100%, constraining inputs');
        
        // Find which input was just changed (the one with the highest value)
        let maxKey = null;
        let maxValue = -1;
        for (const [key, value] of Object.entries(this.spendingOrders))
        {
          if (value > maxValue)
          {
            maxValue = value;
            maxKey = key;
          }
        }

        if (maxKey)
        {
          // Cap the changed input to ensure total doesn't exceed 100
          const otherTotal = currentTotal - maxValue;
          const maxForThisInput = Math.max(0, 100 - otherTotal);
          this.spendingOrders[maxKey] = maxForThisInput;
          this.spendingControls[maxKey].slider.value = maxForThisInput;
          this.spendingControls[maxKey].numberInput.value = maxForThisInput;
          console.log(`🏭 IndustryDialog: Capped ${maxKey} to ${maxForThisInput}%`);
        }
      }

      // Update max values for all inputs based on remaining percentage
      const remaining = 100 - currentTotal;

      for (const [key, controls] of Object.entries(this.spendingControls))
      {
        const currentValue = this.spendingOrders[key];
        const maxForThisInput = currentValue + remaining;

        controls.slider.max = 100;
        controls.numberInput.max = 100;
        
        console.log(`🏭 IndustryDialog: ${key} - current: ${currentValue}%, max: 100%`);
      }
    }
    else
    {
      // Normal mode: max is based on available amount
      // If total exceeds available, we need to constrain the inputs
      if (currentTotal > available)
      {
        console.log('🏭 IndustryDialog: Total exceeds available, constraining inputs');
        
        // Find which input was just changed (the one with the highest value)
        let maxKey = null;
        let maxValue = -1;
        for (const [key, value] of Object.entries(this.spendingOrders))
        {
          if (value > maxValue)
          {
            maxValue = value;
            maxKey = key;
          }
        }

        if (maxKey)
        {
          // Cap the changed input to available
          this.spendingOrders[maxKey] = available;
          this.spendingControls[maxKey].slider.value = available;
          this.spendingControls[maxKey].numberInput.value = available;
          console.log(`🏭 IndustryDialog: Capped ${maxKey} to available: ${available}`);
        }
      }

      // Update max values for all inputs based on remaining available
      const remaining = available - currentTotal;

      for (const [key, controls] of Object.entries(this.spendingControls))
      {
        const currentValue = this.spendingOrders[key];
        const maxForThisInput = currentValue + remaining;

        controls.slider.max = Math.max(maxForThisInput, currentValue);
        controls.numberInput.max = Math.max(maxForThisInput, currentValue);
        
        console.log(`🏭 IndustryDialog: ${key} - current: ${currentValue}, max: ${Math.max(maxForThisInput, currentValue)}`);
      }
    }
  }

  /**
   * Calculate the actual available build points (capacity minus all existing spending orders)
   */
  getActualAvailable()
  {
    if (!this.currentStar || !this.currentStar.economy) 
      return 0;

    console.log('🏭 IndustryDialog: getActualAvailable calculation:', this.currentStar);

    const available = this.currentStar.economy.available || 0;
    const totalSpendingOrders = Object.values(this.spendingOrders).reduce(
      (sum, val) => sum + val,
      0
    );
    
    console.log('🏭 IndustryDialog: getActualAvailable calculation:');
    console.log('  - Economy available:', available);
    console.log('  - Spending orders:', this.spendingOrders);
    console.log('  - Total spending:', totalSpendingOrders);
    console.log('  - Remaining available:', Math.max(0, available - totalSpendingOrders));
    
    // Calculate remaining available as economy available minus current spending orders
    return Math.max(0, available - totalSpendingOrders);
  }

  /**
   * Update the total spending display
   */
  updateTotalSpending()
  {
    if (!this.totalSpendingElement) return;

    const total = Object.values(this.spendingOrders).reduce(
      (sum, val) => sum + val,
      0
    );
    
    console.log('🏭 IndustryDialog: updateTotalSpending:');
    console.log('  - Spending orders:', this.spendingOrders);
    console.log('  - Total calculated:', total);
    
    this.totalSpendingElement.textContent = total;
    
    // Also update the available display
    this.updateAvailableDisplay();
  }
  
  /**
   * Update just the available display (without updating all economy values)
   */
  updateAvailableDisplay()
  {
    const availableElement = this.dialog.querySelector('.value-available');
    if (!availableElement) return;
    
    if (this.standingOrdersMode)
    {
      // In standing orders mode, show "100" as total percentage
      availableElement.textContent = '100';
    }
    else
    {
      const actualAvailable = this.getActualAvailable();
      availableElement.textContent = parseFloat(actualAvailable).toFixed(2);
    }
  }

  /**
   * Handle standing orders toggle
   */
  handleStandingOrdersToggle()
  {
    this.standingOrdersMode = this.standingOrdersCheckbox.checked;
    
    if (this.standingOrdersMode)
    {
      // Switch to percentage mode
      // Convert current values to percentages if we have available amount
      if (this.currentStar && this.currentStar.economy)
      {
        const available = this.currentStar.economy.available || 0;
        if (available > 0)
        {
          // Convert current spending orders to percentages
          this.spendingOrders.expand = Math.round((this.spendingOrders.expand / available) * 100);
          this.spendingOrders.research = Math.round((this.spendingOrders.research / available) * 100);
          this.spendingOrders.build = Math.round((this.spendingOrders.build / available) * 100);
        }
        else
        {
          // Reset to 0 if no available
          this.spendingOrders = {expand: 0, research: 0, build: 0};
        }
      }
      else
      {
        this.spendingOrders = {expand: 0, research: 0, build: 0};
      }
      
      // Update UI controls
      if (this.spendingControls)
      {
        for (const [key, controls] of Object.entries(this.spendingControls))
        {
          controls.slider.value = this.spendingOrders[key];
          controls.numberInput.value = this.spendingOrders[key];
          controls.slider.max = 100;
          controls.numberInput.max = 100;
        }
      }
      
      // Update available label to show "Total Percentage:"
      const rows = this.dialog.querySelectorAll('.value-row');
      for (const row of rows)
      {
        const label = row.querySelector('.value-label');
        if (label && label.textContent === 'Available')
        {
          label.textContent = 'Total Percentage:';
          break;
        }
      }
    }
    else
    {
      // Switch back to normal mode
      // Convert percentages back to actual values
      if (this.currentStar && this.currentStar.economy)
      {
        const available = this.currentStar.economy.available || 0;
        this.spendingOrders.expand = Math.floor((available * this.spendingOrders.expand) / 100);
        this.spendingOrders.research = Math.floor((available * this.spendingOrders.research) / 100);
        this.spendingOrders.build = Math.floor((available * this.spendingOrders.build) / 100);
      }
      
      // Update UI controls
      if (this.spendingControls)
      {
        for (const [key, controls] of Object.entries(this.spendingControls))
        {
          controls.slider.value = this.spendingOrders[key];
          controls.numberInput.value = this.spendingOrders[key];
          // Max will be updated by updateSpendingConstraints
        }
      }
      
      // Restore available label
      const rows = this.dialog.querySelectorAll('.value-row');
      for (const row of rows)
      {
        const label = row.querySelector('.value-label');
        if (label && label.textContent === 'Total Percentage:')
        {
          label.textContent = 'Available';
          break;
        }
      }
    }
    
    this.updateSpendingConstraints();
    this.updateTotalSpending();
    this.updateAvailableDisplay();
    
    console.log('🏭 IndustryDialog: Standing orders mode:', this.standingOrdersMode);
  }

  /**
   * Load standing orders for the current star
   */
  async loadStandingOrders(starId)
  {
    const context = eventBus.getContext();
    const gameId = context.gameId;
    const playerId = context.playerId; // Use playerId from context, not user (user is user_id)

    if (!gameId || !playerId)
    {
      console.warn('🏭 IndustryDialog: Cannot load standing orders - missing gameId or playerId');
      return null;
    }

    try
    {
      const result = await RB.fetchGet(`/api/orders/standing/${starId}?gameId=${gameId}`);
      return result.standingOrders;
    }
    catch (error)
    {
      // 404 is acceptable - no standing orders exist yet
      if (error instanceof ApiError && error.status === 404)
      {
        console.warn('🏭 IndustryDialog: No standing orders found');
        return null;
      }
      console.error('🏭 IndustryDialog: Error loading standing orders:', error);
      return null;
    }
  }

  /**
   * Save standing orders for the current star
   */
  async saveStandingOrders(starId, standingOrders)
  {
    const context = eventBus.getContext();
    const gameId = context.gameId;
    if (!gameId)
    {
      console.error('🏭 IndustryDialog: Cannot save standing orders - missing gameId');
      throw new Error('Missing gameId');
    }

    try
    {
      // playerId is derived from authenticated user on backend
      const result = await RB.fetchPost('/api/orders/standing', {
        gameId,
        starId,
        standingOrders
      });
      console.log('🏭 IndustryDialog: Standing orders saved:', result);
      return result;
    }
    catch (error)
    {
      console.error('🏭 IndustryDialog: Error saving standing orders:', error);
      throw error;
    }
  }

  /**
   * Delete standing orders for the current star
   */
  async deleteStandingOrders(starId)
  {
    const context = eventBus.getContext();
    const gameId = context.gameId;
    if (!gameId)
    {
      console.error('🏭 IndustryDialog: Cannot delete standing orders - missing gameId');
      throw new Error('Missing gameId');
    }

    try
    {
      // playerId is derived from authenticated user on backend
      const result = await RB.fetchDelete(`/api/orders/standing/${starId}?gameId=${gameId}`);
      console.log('🏭 IndustryDialog: Standing orders deleted:', result);
      return result;
    }
    catch (error)
    {
      console.error('🏭 IndustryDialog: Error deleting standing orders:', error);
      throw error;
    }
  }

  /**
   * Submit the current spending order via event system
   */
  async submitOrder()
  {
    if (!this.currentStar)
    {
      console.error('IndustryDialog: No star selected for order submission');
      return;
    }

    const starId = this.currentStar.getId();

    try
    {
      if (this.standingOrdersMode)
      {
        // Save standing orders
        const standingOrders = {
          industry: {
            expand: this.spendingOrders.expand,
            research: this.spendingOrders.research,
            build: this.spendingOrders.build
          }
        };

        await this.saveStandingOrders(starId, standingOrders);
        this.showOrderConfirmation();
        console.log('🏭 IndustryDialog: Standing orders saved:', standingOrders);
      }
      else
      {
        // Check if standing orders exist - if so, delete them first
        const existingStandingOrders = await this.loadStandingOrders(starId);
        if (existingStandingOrders && existingStandingOrders.industry)
        {
          await this.deleteStandingOrders(starId);
          console.log('🏭 IndustryDialog: Deleted existing standing orders');
        }

        // Submit regular order
        const orderData = {
          sourceStarId: starId,
          expand: this.spendingOrders.expand,
          research: this.spendingOrders.research,
          build: this.spendingOrders.build,
          timestamp: Date.now()
        };

        console.log('🏭 IndustryDialog: Submitting order via event system:', starId, orderData);

        // Emit order submission event
        eventBus.emit('order:build.submit', {
          success: true,
          details: {
            eventType: 'order:build.submit',
            orderType: 'build',
            payload: orderData
          }
        });
      }
    }
    catch (error)
    {
      console.error('🏭 IndustryDialog: Error submitting order:', error);
      this.showOrderError(error.message || 'Failed to submit order');
    }
  }

  /**
   * Show order confirmation feedback
   */
  showOrderConfirmation()
  {
    // Create a temporary confirmation message
    const confirmation = document.createElement('div');
    confirmation.textContent = 'Order Submitted!';
    confirmation.className = 'confirmation-message success';

    document.body.appendChild(confirmation);

    // Remove after 2 seconds
    setTimeout(() =>
    {
      if (confirmation.parentNode)
      {
        confirmation.parentNode.removeChild(confirmation);
      }
    }, 2000);
  }

  /**
   * Show order error feedback
   */
  showOrderError(message)
  {
    // Create a temporary error message
    const error = document.createElement('div');
    error.textContent = `Error: ${message}`;
    error.className = 'confirmation-message error';

    document.body.appendChild(error);

    // Remove after 3 seconds
    setTimeout(() =>
    {
      if (error.parentNode)
      {
        error.parentNode.removeChild(error);
      }
    }, 3000);
  }

  /**
   * Handle order submission success
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data with order result
   */
  handleOrderSubmitSuccess(context, eventData)
  {
    console.log('🏭 IndustryDialog: Order submitted successfully:', eventData.details);
    this.showOrderConfirmation();
  }

  /**
   * Handle order submission error
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data with error information
   */
  handleOrderSubmitError(context, eventData)
  {
    console.error('🏭 IndustryDialog: Order submission failed:', eventData.details.error);
    this.showOrderError(eventData.details.error);
  }

  /**
   * Handle order loading success
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data with loaded orders
   */
  handleOrderLoadSuccess(context, eventData)
  {
    console.log('🏭 IndustryDialog: Orders loaded successfully:', eventData.details);
    
    const { orders, sourceStarId, orderType } = eventData.details;
    
    // Check if this is for the star we're currently loading
    if (sourceStarId === this.pendingLoadStarId)
    {
      let hasOrders = false;
      
      if (orders && orders.length > 0)
      {
        // Get the latest order (first in the array since they're ordered by created_at DESC)
        const latestOrder = orders[0];
        const payload = latestOrder.payload;

        this.spendingOrders = {
          expand: payload.expand || 0,
          research: payload.research || 0,
          build: payload.build || 0,
        };

        console.log('🏭 IndustryDialog: Raw payload from database:', payload);
        console.log('🏭 IndustryDialog: Parsed spendingOrders:', this.spendingOrders);

        // Update the UI controls
        if (this.spendingControls)
        {
          for (const [key, controls] of Object.entries(this.spendingControls))
          {
            const value = this.spendingOrders[key];
            console.log(`🏭 IndustryDialog: Updating ${key} controls to value:`, value);
            controls.slider.value = value;
            controls.numberInput.value = value;
            console.log(`🏭 IndustryDialog: After update - slider.value: ${controls.slider.value}, numberInput.value: ${controls.numberInput.value}`);
          }
        }

        // Update economy values to reflect the new available amount
        this.updateEconomyValues();

        console.log(
          '🏭 IndustryDialog: Loaded saved orders for star',
          sourceStarId,
          ':',
          this.spendingOrders
        );
        hasOrders = true;
      }
      
      // Resolve the promise
      if (this.pendingLoadResolve)
      {
        this.pendingLoadResolve(hasOrders);
        this.pendingLoadResolve = null;
        this.pendingLoadStarId = null;
      }
    }
  }

  /**
   * Handle order loading error
   * @param {Object} context - Current context
   * @param {Object} eventData - Event data with error information
   */
  handleOrderLoadError(context, eventData)
  {
    console.error('🏭 IndustryDialog: Order loading failed:', eventData.details.error);
    
    // Resolve the promise with false to indicate no orders were loaded
    if (this.pendingLoadResolve)
    {
      this.pendingLoadResolve(false);
      this.pendingLoadResolve = null;
      this.pendingLoadStarId = null;
    }
  }

  /**
   * Load saved orders for a star via event system
   */
  async loadSavedOrders(starId)
  {
    console.log('🏭 IndustryDialog: Loading saved orders via event system for star:', starId);

    // Store the starId for the response handler
    this.pendingLoadStarId = starId;

    // Emit order loading event
    eventBus.emit('order:build.loadForStar', {
      success: true,
      details: {
        eventType: 'order:build.loadForStar',
        sourceStarId: starId,
        orderType: 'build'
      }
    });

    // Return a promise that will be resolved by the event handler
    return new Promise((resolve) => {
      this.pendingLoadResolve = resolve;
    });
  }


  /**
   * Show the dialog for a specific star
   */
  async show(star)
  {
    if (!star)
    {
      console.error('IndustryDialog: No star provided');
      return;
    }

    this.currentStar = star;
    super.show();
    this.dialog.style.display = 'block';

    // Update star name
    this.starNameElement.textContent = star.getName();

    // Reset standing orders mode
    this.standingOrdersMode = false;
    if (this.standingOrdersCheckbox)
    {
      this.standingOrdersCheckbox.checked = false;
    }

    // Try to load standing orders first
    const standingOrders = await this.loadStandingOrders(star.getId());
    
    if (standingOrders && standingOrders.industry)
    {
      // Standing orders exist - enable standing orders mode
      this.standingOrdersMode = true;
      if (this.standingOrdersCheckbox)
      {
        this.standingOrdersCheckbox.checked = true;
      }

      // Load percentages into spending orders
      this.spendingOrders = {
        expand: standingOrders.industry.expand || 0,
        research: standingOrders.industry.research || 0,
        build: standingOrders.industry.build || 0
      };

      // Update UI controls - set max FIRST, then values
      if (this.spendingControls)
      {
        for (const [key, controls] of Object.entries(this.spendingControls))
        {
          // Set max first to ensure slider range is correct
          controls.slider.max = 100;
          controls.numberInput.max = 100;
          // Set the values - use setAttribute to ensure DOM updates
          const value = this.spendingOrders[key] || 0;
          controls.slider.setAttribute('value', value);
          controls.slider.value = value;
          controls.numberInput.value = value;
        }
      }

      // Update available label to show "Total Percentage:"
      const rows = this.dialog.querySelectorAll('.value-row');
      for (const row of rows)
      {
        const label = row.querySelector('.value-label');
        if (label && label.textContent === 'Available')
        {
          label.textContent = 'Total Percentage:';
          break;
        }
      }

      console.log('🏭 IndustryDialog: Loaded standing orders:', standingOrders.industry);
    }
    else
    {
      // No standing orders - try to load regular saved orders
      const hasSavedOrders = await this.loadSavedOrders(star.getId());

      // If no saved orders, reset to defaults
      if (!hasSavedOrders)
      {
        this.spendingOrders = {expand: 0, research: 0, build: 0};
        if (this.spendingControls)
        {
          // Reset max values will be set by updateSpendingConstraints
          for (const [key, controls] of Object.entries(this.spendingControls))
          {
            controls.slider.value = 0;
            controls.numberInput.value = 0;
          }
        }
      }
    }

    // Update economy values first to ensure available amount is correct
    this.updateEconomyValues();
    // Then update spending constraints (this will set correct max values)
    this.updateSpendingConstraints();
    // Finally update total spending display
    this.updateTotalSpending();

    // Update navigation buttons based on available owned stars
    this.updateNavigationButtons();

    console.log(
      '🏭 IndustryDialog: Opened for star:',
      star.getName(),
      standingOrders ? '(with standing orders)' : '(regular orders)',
      star
    );
  }

  /**
   * Get all stars owned by the current player that have economy, sorted alphabetically
   * @returns {Array} Array of owned star objects that have economy
   */
  getOwnedStarsSorted()
  {
    if (!window.globalMapModel || !this.currentStar || !this.currentStar.getOwner())
    {
      return [];
    }

    const currentPlayer = this.currentStar.getOwner();
    const allStars = window.globalMapModel.getStars();
    const ownedStars = allStars.filter(star => {
      const owner = star.getOwner();
      if (!owner || owner.id !== currentPlayer.id)
      {
        return false;
      }
      
      // Only include stars that have an economy
      const economy = star.economy;
      return economy !== null && economy !== undefined;
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
  getCurrentStarIndex()
  {
    if (!this.currentStar) return -1;
    
    const ownedStars = this.getOwnedStarsSorted();
    const currentStarId = this.currentStar.getId();
    
    return ownedStars.findIndex(star => star.getId() === currentStarId);
  }

  /**
   * Update navigation button states based on current position
   */
  updateNavigationButtons()
  {
    const ownedStars = this.getOwnedStarsSorted();
    const currentIndex = this.getCurrentStarIndex();
    
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < ownedStars.length - 1;
    
    if (this.prevStarButton)
    {
      this.prevStarButton.disabled = !hasPrev;
      if (!hasPrev)
      {
        this.prevStarButton.classList.add('disabled');
      }
      else
      {
        this.prevStarButton.classList.remove('disabled');
      }
    }
    
    if (this.nextStarButton)
    {
      this.nextStarButton.disabled = !hasNext;
      if (!hasNext)
      {
        this.nextStarButton.classList.add('disabled');
      }
      else
      {
        this.nextStarButton.classList.remove('disabled');
      }
    }
  }

  /**
   * Navigate to the previous owned star (alphabetically)
   */
  navigateToPreviousStar()
  {
    const ownedStars = this.getOwnedStarsSorted();
    const currentIndex = this.getCurrentStarIndex();
    
    if (currentIndex <= 0)
    {
      console.warn('🏭 IndustryDialog: No previous star available');
      return;
    }
    
    const prevStar = ownedStars[currentIndex - 1];
    console.log(`🏭 IndustryDialog: Navigating to previous star: ${prevStar.getName()}`);
    
    // Show the previous star (this will reload its state and orders)
    this.show(prevStar);
  }

  /**
   * Navigate to the next owned star (alphabetically)
   */
  navigateToNextStar()
  {
    const ownedStars = this.getOwnedStarsSorted();
    const currentIndex = this.getCurrentStarIndex();
    
    if (currentIndex < 0 || currentIndex >= ownedStars.length - 1)
    {
      console.warn('🏭 IndustryDialog: No next star available');
      return;
    }
    
    const nextStar = ownedStars[currentIndex + 1];
    console.log(`🏭 IndustryDialog: Navigating to next star: ${nextStar.getName()}`);
    
    // Show the next star (this will reload its state and orders)
    this.show(nextStar);
  }

  /**
   * Handle star name click to show selection dropdown
   */
  handleStarNameClick()
  {
    const ownedStars = this.getOwnedStarsSorted();
    const currentStarId = this.currentStar ? this.currentStar.getId() : null;
    
    // Show dropdown with stars
    this.showStarSelectionDropdown(
      ownedStars,
      (star) => this.handleStarSelection(star),
      currentStarId
    );
  }

  /**
   * Handle star selection from dropdown
   * @param {Object} star - Selected star object
   */
  handleStarSelection(star)
  {
    if (!star)
    {
      console.warn('🏭 IndustryDialog: No star provided for selection');
      return;
    }
    
    console.log(`🏭 IndustryDialog: Star selected from dropdown: ${star.getName()}`);
    
    // Show the selected star (this will reload its state and orders)
    this.show(star);
  }

  /**
   * Show star selection dropdown
   * @param {Array} stars - Array of star objects to display
   * @param {Function} onStarSelect - Callback when a star is selected
   * @param {string} currentStarId - ID of the current star to highlight
   */
  showStarSelectionDropdown(stars, onStarSelect, currentStarId)
  {
    if (!this.starSelectionDropdown) return;

    // Clear existing content
    this.starSelectionDropdown.innerHTML = '';

    if (stars.length === 0)
    {
      const noStarsMsg = document.createElement('div');
      noStarsMsg.className = 'star-dropdown-item star-dropdown-empty';
      noStarsMsg.textContent = 'No stars with economy available';
      this.starSelectionDropdown.appendChild(noStarsMsg);
    }
    else
    {
      // Add each star to the dropdown
      stars.forEach(star => {
        const starItem = document.createElement('div');
        starItem.className = 'star-dropdown-item';
        
        const starId = star.getId();
        const starName = star.getName();
        const isCurrent = starId === currentStarId;
        
        if (isCurrent)
        {
          starItem.classList.add('current');
        }
        
        starItem.textContent = starName;
        starItem.style.cursor = 'pointer';
        
        // Set star color
        const starColor = star.getColor();
        if (starColor)
        {
          starItem.style.borderLeft = `3px solid ${starColor}`;
        }
        
        starItem.addEventListener('click', (e) => {
          e.stopPropagation();
          onStarSelect(star);
          this.hideStarSelectionDropdown();
        });
        
        starItem.addEventListener('mouseenter', () => {
          starItem.style.background = 'var(--bg-hover)';
        });
        
        starItem.addEventListener('mouseleave', () => {
          starItem.style.background = isCurrent ? 'var(--bg-light)' : 'var(--bg-dark)';
        });
        
        this.starSelectionDropdown.appendChild(starItem);
      });

      // Calculate width based on longest star name
      let maxWidth = 0;
      stars.forEach(star => {
        const tempElement = document.createElement('span');
        tempElement.textContent = star.getName();
        tempElement.style.position = 'absolute';
        tempElement.style.visibility = 'hidden';
        tempElement.style.fontSize = getComputedStyle(this.starSelectionDropdown).fontSize;
        document.body.appendChild(tempElement);
        const textWidth = tempElement.offsetWidth;
        document.body.removeChild(tempElement);
        maxWidth = Math.max(maxWidth, textWidth);
      });
      
      // Add padding (2em = approximately 32px for default font size)
      const padding = 64; // 2em equivalent in pixels
      const calculatedWidth = maxWidth + padding;
      
      // Use calculated width or minimum 200px, maximum 400px
      const dropdownWidth = Math.max(200, Math.min(calculatedWidth, 400));
      
      // Position dropdown below star name, centered on star name
      const starNameRect = this.starNameElement.getBoundingClientRect();
      const starNameContainer = this.starNameElement.parentElement;
      const containerRect = starNameContainer.getBoundingClientRect();
      const centerOffset = (starNameRect.width - dropdownWidth) / 2;
      
      this.starSelectionDropdown.style.position = 'absolute';
      this.starSelectionDropdown.style.top = `${starNameRect.bottom - containerRect.top + 5}px`;
      this.starSelectionDropdown.style.left = `${starNameRect.left - containerRect.left + centerOffset}px`;
      this.starSelectionDropdown.style.width = `${dropdownWidth}px`;
      this.starSelectionDropdown.style.display = 'block';
      this.starSelectionDropdown.style.zIndex = '10000';
    }
  }

  /**
   * Hide star selection dropdown
   */
  hideStarSelectionDropdown()
  {
    if (this.starSelectionDropdown)
    {
      this.starSelectionDropdown.style.display = 'none';
    }
  }

  /**
   * Update the economy values display
   */
  updateEconomyValues()
  {
    if (!this.currentStar)
    {
      console.warn('IndustryDialog: No star provided');
      return;
    }

    // Update resource (from star, not economy)
    const resourceElement = this.dialog.querySelector('.value-resource');
    if (resourceElement)
    {
      const resourceValue = this.currentStar.getResourceValue() || 0;
      resourceElement.textContent = resourceValue;
      console.log(
        '🏭 IndustryDialog: Resource value from star:',
        resourceValue
      );
    }

    // Update economy values if star has economy
    if (this.currentStar.economy)
    {
      const economy = this.currentStar.economy;

      // Update capacity
      const capacityElement = this.dialog.querySelector('.value-capacity');
      if (capacityElement)
      {
        capacityElement.textContent = economy.capacity || 0;
      }

      // Update available (use updateAvailableDisplay to handle standing orders mode)
      this.updateAvailableDisplay();

      // Update tech level
      const techLevelElement = this.dialog.querySelector('.value-techLevel');
      if (techLevelElement)
      {
        techLevelElement.textContent = economy.techLevel || 0;
      }
    }
    else
    {
      // Set default values if no economy
      const capacityElement = this.dialog.querySelector('.value-capacity');
      if (capacityElement) capacityElement.textContent = '0';

      const availableElement = this.dialog.querySelector('.value-available');
      if (availableElement) availableElement.textContent = '0';

      const techLevelElement = this.dialog.querySelector('.value-techLevel');
      if (techLevelElement) techLevelElement.textContent = '0';
    }

    // Update spending constraints when economy values change
    this.updateSpendingConstraints();
  }

  /**
   * Hide the dialog
   */
  hide()
  {
    this.currentStar = null;

    // Reset spending orders
    this.spendingOrders = {expand: 0, research: 0, build: 0};

    // Close dropdown if open
    this.hideStarSelectionDropdown();

    super.hide();
    console.log('🏭 IndustryDialog: Closed');
  }

  /**
   * Get saved orders for a specific star
   */
  getSavedOrders(starId)
  {
    if (!this.savedOrders) return null;
    return this.savedOrders.get(starId);
  }

  /**
   * Get all saved orders
   */
  getAllSavedOrders()
  {
    if (!this.savedOrders) return {};
    return Object.fromEntries(this.savedOrders);
  }

  /**
   * Clear saved orders for a specific star
   */
  clearSavedOrders(starId)
  {
    if (this.savedOrders) {
      this.savedOrders.delete(starId);
      console.log('🏭 IndustryDialog: Cleared saved orders for star', starId);
    }
  }

  /**
   * Clear all saved orders
   */
  clearAllSavedOrders()
  {
    if (this.savedOrders) {
      this.savedOrders.clear();
      console.log('🏭 IndustryDialog: Cleared all saved orders');
    }
  }

  /**
   * Clean up resources
   */
  dispose()
  {
    if (this.dialog && this.dialog.parentNode)
    {
      this.dialog.parentNode.removeChild(this.dialog);
    }

    // Clear saved orders on dispose
    this.clearAllSavedOrders();
  }
}
