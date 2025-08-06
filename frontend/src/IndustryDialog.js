/**
 * IndustryDialog - A draggable dialog for displaying and managing star industry
 */
export class IndustryDialog {
  constructor() {
    this.isVisible = false;
    this.currentStar = null;
    this.dialog = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    
    // Spending orders tracking
    this.spendingOrders = {
      expand: 0,
      research: 0,
      build: 0
    };
    
    // In-memory storage for saved orders per star
    this.savedOrders = new Map(); // starId -> spendingOrders
    
    this.createDialog();
  }

  /**
   * Create the dialog DOM element
   */
  createDialog() {
    this.dialog = document.createElement('div');
    this.dialog.className = 'industry-dialog';
    this.dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      background: #2a2a2a;
      border: 2px solid #00ff88;
      border-radius: 8px;
      padding: 20px;
      color: white;
      font-family: Arial, sans-serif;
      z-index: 2000;
      display: none;
      box-shadow: 0 4px 20px rgba(0, 255, 136, 0.3);
    `;

    // Create header (draggable area)
    const header = document.createElement('div');
    header.className = 'dialog-header';
    header.style.cssText = `
      cursor: move;
      padding: 10px;
      margin: -20px -20px 20px -20px;
      background: #333;
      border-radius: 6px 6px 0 0;
      border-bottom: 1px solid #00ff88;
      user-select: none;
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Industry Manager';
    title.style.cssText = `
      margin: 0;
      text-align: center;
      color: #00ff88;
      font-size: 18px;
    `;
    header.appendChild(title);

    // Star name
    this.starNameElement = document.createElement('div');
    this.starNameElement.style.cssText = `
      text-align: center;
      color: #ccc;
      font-size: 14px;
      margin-top: 5px;
    `;
    header.appendChild(this.starNameElement);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      color: #00ff88;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => this.hide();
    header.appendChild(closeBtn);

    this.dialog.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.className = 'dialog-content';

    // Economy values
    this.createEconomySection(content);

    // Spending orders section
    this.createSpendingOrdersSection(content);

    this.dialog.appendChild(content);

    // Add drag functionality
    this.setupDragHandlers(header);

    // Add to DOM
    document.body.appendChild(this.dialog);
  }

  /**
   * Create the economy values section
   */
  createEconomySection(container) {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-top: 20px;
    `;

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
  createValueRow(label, valueKey) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #444;
    `;

    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      color: #ccc;
      font-weight: bold;
    `;

    const valueElement = document.createElement('span');
    valueElement.className = `value-${valueKey}`;
    valueElement.style.cssText = `
      color: #00ff88;
      font-weight: bold;
      font-size: 16px;
    `;

    row.appendChild(labelElement);
    row.appendChild(valueElement);

    return row;
  }

  /**
   * Create the spending orders section
   */
  createSpendingOrdersSection(container) {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-top: 30px;
      border-top: 2px solid #444;
      padding-top: 20px;
    `;

    // Section title
    const title = document.createElement('h3');
    title.textContent = 'Spending Orders';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #00ff88;
      font-size: 16px;
      text-align: center;
    `;
    section.appendChild(title);

    // Create spending order controls
    this.createSpendingOrderControl(section, 'Expand', 'expand');
    this.createSpendingOrderControl(section, 'Research', 'research');
    this.createSpendingOrderControl(section, 'Build', 'build');

    // Total spending display
    const totalRow = document.createElement('div');
    totalRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-top: 1px solid #444;
      margin-top: 15px;
    `;

    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total Spending';
    totalLabel.style.cssText = `
      color: #ccc;
      font-weight: bold;
    `;

    this.totalSpendingElement = document.createElement('span');
    this.totalSpendingElement.style.cssText = `
      color: #00ff88;
      font-weight: bold;
      font-size: 16px;
    `;

    totalRow.appendChild(totalLabel);
    totalRow.appendChild(this.totalSpendingElement);
    section.appendChild(totalRow);

    // Submit Order button
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit Order';
    submitButton.style.cssText = `
      width: 100%;
      padding: 12px;
      margin-top: 20px;
      background: #00ff88;
      color: #000;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    
    // Hover effect
    submitButton.addEventListener('mouseenter', () => {
      submitButton.style.background = '#00cc6a';
    });
    
    submitButton.addEventListener('mouseleave', () => {
      submitButton.style.background = '#00ff88';
    });
    
    // Click handler
    submitButton.addEventListener('click', () => {
      this.submitOrder();
    });
    
    section.appendChild(submitButton);

    container.appendChild(section);
  }

  /**
   * Create a spending order control with slider and number input
   */
  createSpendingOrderControl(container, label, key) {
    const controlRow = document.createElement('div');
    controlRow.style.cssText = `
      margin-bottom: 15px;
    `;

    // Label
    const labelElement = document.createElement('div');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      color: #ccc;
      font-weight: bold;
      margin-bottom: 8px;
    `;
    controlRow.appendChild(labelElement);

    // Control container
    const controlContainer = document.createElement('div');
    controlContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';
    slider.step = '1';
    slider.style.cssText = `
      flex: 1;
      height: 6px;
      background: #444;
      outline: none;
      border-radius: 3px;
      cursor: pointer;
    `;

    // Number input
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '0';
    numberInput.max = '100';
    numberInput.value = '0';
    numberInput.style.cssText = `
      width: 60px;
      padding: 5px;
      background: #333;
      border: 1px solid #555;
      border-radius: 4px;
      color: #00ff88;
      text-align: center;
      font-weight: bold;
    `;

    // Store references for later use
    if (!this.spendingControls) {
      this.spendingControls = {};
    }
    this.spendingControls[key] = { slider, numberInput };

    // Link slider and number input
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      numberInput.value = value;
      this.spendingOrders[key] = value;
      this.updateSpendingConstraints();
      this.updateTotalSpending();
    });

    numberInput.addEventListener('input', (e) => {
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
  updateSpendingConstraints() {
    if (!this.currentStar || !this.currentStar.economy) return;

    const available = this.currentStar.economy.available || 0;
    const currentTotal = Object.values(this.spendingOrders).reduce((sum, val) => sum + val, 0);

    // If total exceeds available, we need to constrain the inputs
    if (currentTotal > available) {
      // Find which input was just changed (the one with the highest value)
      let maxKey = null;
      let maxValue = -1;
      for (const [key, value] of Object.entries(this.spendingOrders)) {
        if (value > maxValue) {
          maxValue = value;
          maxKey = key;
        }
      }

      if (maxKey) {
        // Cap the changed input to available
        this.spendingOrders[maxKey] = available;
        this.spendingControls[maxKey].slider.value = available;
        this.spendingControls[maxKey].numberInput.value = available;
      }
    }

    // Update max values for all inputs
    const remaining = available - Object.values(this.spendingOrders).reduce((sum, val) => sum + val, 0);
    
    for (const [key, controls] of Object.entries(this.spendingControls)) {
      const currentValue = this.spendingOrders[key];
      const maxForThisInput = currentValue + remaining;
      
      controls.slider.max = maxForThisInput;
      controls.numberInput.max = maxForThisInput;
    }
  }

  /**
   * Update the total spending display
   */
  updateTotalSpending() {
    if (!this.totalSpendingElement) return;

    const total = Object.values(this.spendingOrders).reduce((sum, val) => sum + val, 0);
    this.totalSpendingElement.textContent = total;
  }

  /**
   * Submit the current spending order
   */
  submitOrder() {
    if (!this.currentStar) {
      console.error('IndustryDialog: No star selected for order submission');
      return;
    }

    const starId = this.currentStar.id;
    const orderData = {
      expand: this.spendingOrders.expand,
      research: this.spendingOrders.research,
      build: this.spendingOrders.build,
      timestamp: Date.now()
    };

    // Save the order to memory
    this.savedOrders.set(starId, orderData);

    console.log('🏭 IndustryDialog: Order submitted for star', starId, ':', orderData);
    
    // Show confirmation (optional - could be a toast notification)
    this.showOrderConfirmation();
  }

  /**
   * Show order confirmation feedback
   */
  showOrderConfirmation() {
    // Create a temporary confirmation message
    const confirmation = document.createElement('div');
    confirmation.textContent = 'Order Submitted!';
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

    // Remove after 2 seconds
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.parentNode.removeChild(confirmation);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 2000);
  }

  /**
   * Load saved orders for a star
   */
  loadSavedOrders(starId) {
    const savedOrder = this.savedOrders.get(starId);
    if (savedOrder) {
      this.spendingOrders = {
        expand: savedOrder.expand,
        research: savedOrder.research,
        build: savedOrder.build
      };
      
      // Update the UI controls
      if (this.spendingControls) {
        for (const [key, controls] of Object.entries(this.spendingControls)) {
          const value = this.spendingOrders[key];
          controls.slider.value = value;
          controls.numberInput.value = value;
        }
      }
      
      console.log('🏭 IndustryDialog: Loaded saved orders for star', starId, ':', this.spendingOrders);
      return true;
    }
    return false;
  }

  /**
   * Set up drag handlers for the dialog
   */
  setupDragHandlers(header) {
    header.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const rect = this.dialog.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
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
      }
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  /**
   * Show the dialog for a specific star
   */
  show(star) {
    if (!star) {
      console.error('IndustryDialog: No star provided');
      return;
    }

    this.currentStar = star;
    this.isVisible = true;
    this.dialog.style.display = 'block';

    // Update star name
    const starName = star.getName ? star.getName() : `Star ${star.id}`;
    this.starNameElement.textContent = starName;

    // Try to load saved orders for this star
    const hasSavedOrders = this.loadSavedOrders(star.id);
    
    // If no saved orders, reset to defaults
    if (!hasSavedOrders) {
      this.spendingOrders = { expand: 0, research: 0, build: 0 };
      if (this.spendingControls) {
        for (const [key, controls] of Object.entries(this.spendingControls)) {
          controls.slider.value = 0;
          controls.numberInput.value = 0;
        }
      }
    }

    // Update economy values and spending constraints
    this.updateEconomyValues();
    this.updateSpendingConstraints();
    this.updateTotalSpending();

    console.log('🏭 IndustryDialog: Opened for star:', starName, hasSavedOrders ? '(with saved orders)' : '(new orders)');
  }

  /**
   * Update the economy values display
   */
  updateEconomyValues() {
    if (!this.currentStar || !this.currentStar.economy) {
      console.warn('IndustryDialog: Star has no economy');
      return;
    }

    const economy = this.currentStar.economy;
    
    // Update capacity
    const capacityElement = this.dialog.querySelector('.value-capacity');
    if (capacityElement) {
      capacityElement.textContent = economy.capacity || 0;
    }

    // Update available
    const availableElement = this.dialog.querySelector('.value-available');
    if (availableElement) {
      availableElement.textContent = economy.available || 0;
    }

    // Update tech level
    const techLevelElement = this.dialog.querySelector('.value-techLevel');
    if (techLevelElement) {
      techLevelElement.textContent = economy.techLevel || 0;
    }

    // Update spending constraints when economy values change
    this.updateSpendingConstraints();
  }

  /**
   * Hide the dialog
   */
  hide() {
    this.isVisible = false;
    this.currentStar = null;
    
    // Reset spending orders
    this.spendingOrders = { expand: 0, research: 0, build: 0 };
    
    this.dialog.style.display = 'none';
    console.log('🏭 IndustryDialog: Closed');
  }

  /**
   * Check if the dialog is currently visible
   */
  isOpen() {
    return this.isVisible;
  }

  /**
   * Get saved orders for a specific star
   */
  getSavedOrders(starId) {
    return this.savedOrders.get(starId);
  }

  /**
   * Get all saved orders
   */
  getAllSavedOrders() {
    return Object.fromEntries(this.savedOrders);
  }

  /**
   * Clear saved orders for a specific star
   */
  clearSavedOrders(starId) {
    this.savedOrders.delete(starId);
    console.log('🏭 IndustryDialog: Cleared saved orders for star', starId);
  }

  /**
   * Clear all saved orders
   */
  clearAllSavedOrders() {
    this.savedOrders.clear();
    console.log('🏭 IndustryDialog: Cleared all saved orders');
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
    
    // Clear saved orders on dispose
    this.clearAllSavedOrders();
  }
} 