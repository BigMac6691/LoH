import { getShipDisplayName } from './utils/shipGrouping.js';
import { DualSlider } from './DualSlider.js';

/**
 * MoveDialogView - Handles all UI rendering and DOM manipulation for MoveDialog
 * Separates presentation logic from business logic
 */
export class MoveDialogView {
  constructor() {
    this.dialog = null;
    this.starNameElement = null;
    this.starsListContainer = null;
    this.shipTreeContainer = null;
    this.selectionSummary = null;
    this.moveButton = null;
    this.cancelButton = null;
    this.damageThresholdSlider = null;
    this.damageThresholdValue = null;
    this.powerRangeContainer = null;
    this.powerRangeSliderContainer = null;
    this.powerRangeSlider = null;
    this.currentTooltip = null;
    this.tooltipTimeout = null;
  }

  /**
   * Create the main dialog structure
   * @param {Function} onClose - Callback when close button is clicked
   * @param {Function} onDragHandle - Element to use as drag handle
   */
  createDialog(onClose, onDragHandle) {
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
    
    closeBtn.addEventListener('click', onClose);

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

    // Store drag handle reference
    this.dragHandle = header;

    // Initially hide the dialog
    this.dialog.style.display = 'none';

    document.body.appendChild(this.dialog);
  }

  /**
   * Create the ship tree section
   */
  createShipTreeSection(container) {
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
    
    const clearSelectionBtn = document.createElement('button');
    clearSelectionBtn.textContent = 'Clear Selection';
    clearSelectionBtn.className = 'quick-select-btn';
    
    quickSelectContainer.appendChild(selectAllMobileBtn);
    quickSelectContainer.appendChild(clearSelectionBtn);
    section.appendChild(quickSelectContainer);

    container.appendChild(section);
  }

  /**
   * Create the connected stars selection section
   */
  createConnectedStarsSection(container) {
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

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel Order';
    cancelButton.className = 'dialog-btn dialog-btn-danger';
    
    this.cancelButton = cancelButton;
    
    buttonContainer.appendChild(submitButton);
    buttonContainer.appendChild(cancelButton);
    section.appendChild(buttonContainer);
    container.appendChild(section);
  }

  /**
   * Set up event listeners for UI interactions
   * @param {Object} callbacks - Object containing callback functions
   */
  setupEventListeners(callbacks) {
    // Damage threshold slider
    if (this.damageThresholdSlider) {
      this.damageThresholdSlider.addEventListener('input', () => {
        callbacks.onDamageThresholdChange(parseInt(this.damageThresholdSlider.value));
      });
    }

    // Quick select buttons
    const selectAllMobileBtn = this.dialog.querySelector('.quick-select-btn:first-child');
    const clearSelectionBtn = this.dialog.querySelector('.quick-select-btn:last-child');
    
    if (selectAllMobileBtn) {
      selectAllMobileBtn.addEventListener('click', callbacks.onSelectAllMobile);
    }
    
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', callbacks.onClearSelection);
    }

    // Submit and Cancel buttons
    if (this.moveButton) {
      this.moveButton.addEventListener('click', callbacks.onSubmitOrder);
    }
    
    if (this.cancelButton) {
      this.cancelButton.addEventListener('click', callbacks.onCancelOrder);
    }
  }

  /**
   * Update the star name display
   * @param {string} starName - Name of the current star
   */
  updateStarName(starName) {
    if (this.starNameElement) {
      this.starNameElement.textContent = starName;
    }
  }

  /**
   * Update the connected stars list
   * @param {Array} connectedStars - Array of connected star objects
   * @param {Function} onStarClick - Callback when a star is clicked
   * @param {Function} hasMoveOrder - Function to check if star has move order
   */
  updateConnectedStarsList(connectedStars, onStarClick, hasMoveOrder) {
    if (!this.starsListContainer) return;

    // Clear existing list
    this.starsListContainer.innerHTML = '';

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
      const hasOrder = hasMoveOrder(star);

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
      if (hasOrder) {
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
        if (!starItem.classList.contains('selected')) {
          starItem.style.background = 'var(--bg-light)';
        }
      });

      starItem.addEventListener('mouseleave', () => {
        if (!starItem.classList.contains('selected')) {
          starItem.style.background = 'transparent';
        }
      });

      // Click handler
      starItem.addEventListener('click', () => {
        onStarClick(star, starItem);
      });

      this.starsListContainer.appendChild(starItem);
    });
  }

  /**
   * Get the drag handle element
   * @returns {HTMLElement} The drag handle element
   */
  getDragHandle() {
    return this.dragHandle;
  }

  /**
   * Show the dialog
   */
  show() {
    if (this.dialog) {
      this.dialog.style.display = 'block';
    }
  }

  /**
   * Hide the dialog
   */
  hide() {
    if (this.dialog) {
      this.dialog.style.display = 'none';
    }
  }

  /**
   * Update destination selection styling
   * @param {Object} destination - The selected destination star
   */
  updateDestinationSelection(destination) {
    if (!destination) return;
    
    const starItems = this.starsListContainer.querySelectorAll('.star-item');
    starItems.forEach(item => {
      const starNameElement = item.querySelector('.star-name');
      if (starNameElement && starNameElement.textContent === destination.getName()) {
        item.classList.add('selected');
        item.style.background = '#00ff00'; // Green background
        item.style.border = '1px solid #00ff00';
        starNameElement.style.color = '#000';
      }
    });
  }

  /**
   * Clear destination selection styling
   * @param {Object} currentStar - The current star for color lookup
   * @param {Function} getStarLookupFunction - Function to get star lookup
   */
  clearDestinationSelection(currentStar, getStarLookupFunction) {
    const previousSelected = this.starsListContainer.querySelector('.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
      previousSelected.style.background = 'transparent';
      previousSelected.style.border = 'none';
      
      // Restore original star name color
      const starNameElement = previousSelected.querySelector('span:first-child');
      if (starNameElement) {
        const connectedStarIds = currentStar.getConnectedStarIds ? currentStar.getConnectedStarIds() : [];
        const lookupFunction = getStarLookupFunction();
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
  }

  /**
   * Apply selection styling to a star element
   * @param {HTMLElement} element - The star element to style
   */
  applySelectionStyling(element) {
    element.classList.add('selected');
    element.style.background = '#00ff00'; // Green background
    element.style.border = '1px solid #00ff00';
    
    // Change star name to black for better contrast on green background
    const starNameElement = element.querySelector('span:first-child');
    if (starNameElement) {
      starNameElement.style.color = '#000';
    }
  }

  /**
   * Enable ship tree
   */
  enableShipTree() {
    if (this.shipTreeContainer) {
      this.shipTreeContainer.classList.remove('disabled');
    }
  }

  /**
   * Disable ship tree
   */
  disableShipTree() {
    if (this.shipTreeContainer) {
      this.shipTreeContainer.classList.add('disabled');
    }
  }

  /**
   * Render the ship list
   * @param {Array} ships - Array of ships to render
   * @param {Function} createShipElement - Function to create ship element
   */
  renderShipList(ships, createShipElement) {
    if (!this.shipTreeContainer) return;

    this.shipTreeContainer.innerHTML = '';

    if (ships.length === 0) {
      const noShipsMessage = document.createElement('div');
      noShipsMessage.textContent = 'No ships available at this star';
      noShipsMessage.className = 'ship-list-empty';
      this.shipTreeContainer.appendChild(noShipsMessage);
      return;
    }

    // Render each ship
    ships.forEach(ship => {
      const shipElement = createShipElement(ship);
      this.shipTreeContainer.appendChild(shipElement);
    });
  }

  /**
   * Create a ship element for the list
   * @param {Object} ship - Ship object
   * @param {Function} getShipId - Function to get ship ID
   * @param {Function} hasShipOrdersToOtherDestinations - Function to check ship orders
   * @param {Function} showShipOrderTooltip - Function to show tooltip
   * @param {Function} toggleShipSelection - Function to toggle selection
   * @param {Set} selectedShipIds - Set of selected ship IDs
   * @param {Function} getShipDisplayName - Function to get display name
   */
  createShipElement(ship, getShipId, hasShipOrdersToOtherDestinations, showShipOrderTooltip, toggleShipSelection, selectedShipIds, getShipDisplayName) {
    const shipElement = document.createElement('div');
    shipElement.className = 'ship-item';
    
    const shipId = getShipId(ship);
    const isSelected = selectedShipIds.has(shipId);
    const canMove = ship.canMove();
    const damagePercentage = ship.getDamagePercentage();
    const healthPercentage = 100 - damagePercentage;
    
    // Check if ship has orders to other destinations
    const hasOrdersToOtherDestinations = hasShipOrdersToOtherDestinations(shipId);

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
    
    // Create selection control (checkbox or rocket icon)
    let selectionControl;
    if (hasOrdersToOtherDestinations) {
      // Create rocket icon for ships with orders to other destinations
      const rocketIcon = document.createElement('span');
      rocketIcon.textContent = '🚀';
      rocketIcon.className = 'ship-rocket-icon';
      rocketIcon.addEventListener('click', () => {
        // Show tooltip on click
        showShipOrderTooltip(rocketIcon, shipId);
      });
      rocketIcon.addEventListener('mouseenter', () => {
        // Show tooltip on hover
        console.log('🚀 Mouse entered rocket icon for ship:', shipId);
        showShipOrderTooltip(rocketIcon, shipId);
      });
      rocketIcon.addEventListener('mouseleave', () => {
        // Hide tooltip when mouse leaves (but with a small delay to allow moving to tooltip)
        console.log('🚀 Mouse left rocket icon for ship:', shipId);
        setTimeout(() => {
          this.hideShipOrderTooltip();
        }, 100);
      });
      selectionControl = rocketIcon;
    } else {
      // Create checkbox for available ships
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isSelected;
      checkbox.disabled = !canMove;
      checkbox.addEventListener('change', () => {
        toggleShipSelection(ship);
      });
      selectionControl = checkbox;
    }
    
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
    
    shipElement.appendChild(selectionControl);
    shipElement.appendChild(shipInfo);
    
    return shipElement;
  }

  /**
   * Show tooltip for ship orders
   * @param {HTMLElement} rocketIcon - The rocket icon element
   * @param {string} shipId - The ship ID
   * @param {Function} getShipOrderTooltip - Function to get tooltip text
   */
  showShipOrderTooltip(rocketIcon, shipId, getShipOrderTooltip) {
    const tooltipText = getShipOrderTooltip(shipId);
    
    console.log(`🚀 Showing tooltip for ship ${shipId}: ${tooltipText}`);
    
    // Remove any existing tooltip
    this.hideShipOrderTooltip();
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'ship-order-tooltip';
    tooltip.textContent = tooltipText;
    tooltip.id = 'ship-order-tooltip';
    
    // Position tooltip near the rocket icon (below it to avoid mouse conflicts)
    const rect = rocketIcon.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
    tooltip.style.zIndex = '10000';
    
    document.body.appendChild(tooltip);
    
    // Store reference for cleanup
    this.currentTooltip = tooltip;
    
    // Auto-hide after 3 seconds
    this.tooltipTimeout = setTimeout(() => {
      console.log(`🚀 Auto-hiding tooltip for ship ${shipId}`);
      this.hideShipOrderTooltip();
    }, 3000);
  }

  /**
   * Hide ship order tooltip
   */
  hideShipOrderTooltip() {
    console.log('🚀 Hiding tooltip, currentTooltip exists:', !!this.currentTooltip);
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }

  /**
   * Update button states
   * @param {boolean} canSubmit - Whether submit button should be enabled
   * @param {boolean} canCancel - Whether cancel button should be enabled
   */
  updateButtonStates(canSubmit, canCancel) {
    // Update submit button
    if (canSubmit) {
      this.moveButton.classList.remove('btn-disabled');
      this.moveButton.classList.add('btn-enabled');
    } else {
      this.moveButton.classList.remove('btn-enabled');
      this.moveButton.classList.add('btn-disabled');
    }

    // Update cancel button
    if (canCancel) {
      this.cancelButton.classList.remove('btn-disabled');
      this.cancelButton.classList.add('btn-enabled');
    } else {
      this.cancelButton.classList.remove('btn-enabled');
      this.cancelButton.classList.add('btn-disabled');
    }
  }

  /**
   * Enable submission UI state
   */
  enableSubmissionUI() {
    // Disable buttons
    this.moveButton.disabled = true;
    this.cancelButton.disabled = true;
    this.moveButton.textContent = 'Submitting...';
    
    // Add visual feedback
    this.dialog.classList.add('submitting');
  }

  /**
   * Disable submission UI state
   */
  disableSubmissionUI() {
    // Re-enable buttons
    this.moveButton.disabled = false;
    this.cancelButton.disabled = false;
    this.moveButton.textContent = 'Submit Order';
    
    // Remove visual feedback
    this.dialog.classList.remove('submitting');
  }

  /**
   * Show move confirmation message
   * @param {string} fromStar - Source star name
   * @param {string} toStar - Destination star name
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
   * Show cancel confirmation message
   * @param {string} fromStar - Source star name
   * @param {string} toStar - Destination star name
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
   * Clean up resources
   */
  dispose() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
  }
}
