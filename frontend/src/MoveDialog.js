/**
 * MoveDialog - A draggable dialog for managing fleet movement
 * Shows connected stars for movement selection
 */
export class MoveDialog {
  constructor() {
    this.isVisible = false;
    this.currentStar = null;
    this.dialog = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.selectedDestination = null;
    
    this.createDialog();
  }

  createDialog() {
    this.dialog = document.createElement('div');
    this.dialog.className = 'move-dialog';
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

    // Header for dragging
    const header = document.createElement('div');
    header.style.cssText = `
      cursor: move;
      margin: -20px -20px 20px -20px;
      padding: 15px 20px;
      background: #333;
      border-radius: 6px 6px 0 0;
      border-bottom: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Fleet Manager';
    title.style.cssText = `
      margin: 0;
      color: #00ff88;
      font-size: 18px;
      flex: 1;
      text-align: center;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s;
    `;
    
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#ff4444';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
    });
    
    closeBtn.addEventListener('click', () => {
      this.hide();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Star name
    this.starNameElement = document.createElement('div');
    this.starNameElement.style.cssText = `
      text-align: center;
      font-size: 14px;
      color: #ccc;
      margin-bottom: 20px;
    `;

    // Content container
    const content = document.createElement('div');

    // Connected stars section
    this.createConnectedStarsSection(content);

    this.dialog.appendChild(header);
    this.dialog.appendChild(this.starNameElement);
    this.dialog.appendChild(content);

    // Setup drag handlers
    this.setupDragHandlers(header);

    document.body.appendChild(this.dialog);
  }

  /**
   * Create the connected stars selection section
   */
  createConnectedStarsSection(container) {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    // Section title
    const title = document.createElement('h3');
    title.textContent = 'Connected Stars';
    title.style.cssText = `
      margin: 0 0 15px 0;
      color: #00ff88;
      font-size: 16px;
      text-align: center;
    `;
    section.appendChild(title);

    // Stars list container
    this.starsListContainer = document.createElement('div');
    this.starsListContainer.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 4px;
      background: #333;
    `;
    section.appendChild(this.starsListContainer);

    // Move button
    const moveButton = document.createElement('button');
    moveButton.textContent = 'Move Fleet';
    moveButton.style.cssText = `
      width: 100%;
      padding: 12px;
      margin-top: 15px;
      background: #00ff88;
      color: #000;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s;
      opacity: 0.5;
      pointer-events: none;
    `;
    
    this.moveButton = moveButton;
    
    moveButton.addEventListener('mouseenter', () => {
      if (this.selectedDestination) {
        moveButton.style.background = '#00cc6a';
      }
    });
    
    moveButton.addEventListener('mouseleave', () => {
      if (this.selectedDestination) {
        moveButton.style.background = '#00ff88';
      }
    });
    
    moveButton.addEventListener('click', () => {
      this.moveFleet();
    });
    
    section.appendChild(moveButton);
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
   * Show the dialog for a specific star
   */
  show(star) {
    if (!star) {
      console.error('MoveDialog: No star provided');
      return;
    }

    this.currentStar = star;
    this.selectedDestination = null;
    this.isVisible = true;
    this.dialog.style.display = 'block';

    // Update star name
    const starName = star.getName ? star.getName() : `Star ${star.id}`;
    this.starNameElement.textContent = starName;

    // Update connected stars list
    this.updateConnectedStarsList();

    // Reset move button
    this.updateMoveButton();

    console.log('🚀 MoveDialog: Opened for star:', starName);
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

      const starName = star.getName ? star.getName() : `Star ${star.id}`;
      const starNameElement = document.createElement('span');
      starNameElement.textContent = starName;
      starNameElement.style.cssText = `
        color: #ccc;
        font-weight: bold;
      `;

      // Show star owner if any
      const ownerElement = document.createElement('span');
      if (star.owner) {
        ownerElement.textContent = `(${star.owner.name || 'Owned'})`;
        ownerElement.style.color = star.color || '#888';
      }
      ownerElement.style.cssText += `
        font-size: 12px;
        color: #888;
      `;

      starItem.appendChild(starNameElement);
      starItem.appendChild(ownerElement);

      // Hover effects
      starItem.addEventListener('mouseenter', () => {
        starItem.style.background = '#444';
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
   * Select a destination star
   */
  selectDestination(star, element) {
    // Clear previous selection
    const previousSelected = this.starsListContainer.querySelector('.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
      previousSelected.style.background = 'transparent';
      previousSelected.style.border = 'none';
    }

    // Select new destination
    this.selectedDestination = star;
    element.classList.add('selected');
    element.style.background = '#00ff88';
    element.style.color = '#000';
    element.style.border = '1px solid #00ff88';

    // Update move button
    this.updateMoveButton();

    console.log('🚀 MoveDialog: Selected destination:', star.getName ? star.getName() : `Star ${star.id}`);
  }

  /**
   * Update the move button state
   */
  updateMoveButton() {
    if (this.selectedDestination) {
      this.moveButton.style.opacity = '1';
      this.moveButton.style.pointerEvents = 'auto';
    } else {
      this.moveButton.style.opacity = '0.5';
      this.moveButton.style.pointerEvents = 'none';
    }
  }

  /**
   * Move the fleet to the selected destination
   */
  moveFleet() {
    if (!this.selectedDestination || !this.currentStar) {
      console.warn('MoveDialog: No destination selected or no current star');
      return;
    }

    const fromStar = this.currentStar.getName ? this.currentStar.getName() : `Star ${this.currentStar.id}`;
    const toStar = this.selectedDestination.getName ? this.selectedDestination.getName() : `Star ${this.selectedDestination.id}`;
    
    console.log(`🚀 MoveDialog: Moving fleet from ${fromStar} to ${toStar}`);
    
    // TODO: Implement actual fleet movement logic
    // For now, just log the action
    
    // Show confirmation and close dialog
    this.showMoveConfirmation(fromStar, toStar);
    this.hide();
  }

  /**
   * Show move confirmation feedback
   */
  showMoveConfirmation(fromStar, toStar) {
    const confirmation = document.createElement('div');
    confirmation.textContent = `Fleet moved from ${fromStar} to ${toStar}!`;
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
   * Hide the dialog
   */
  hide() {
    this.isVisible = false;
    this.currentStar = null;
    this.selectedDestination = null;
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