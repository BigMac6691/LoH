import { runMemoryTest, logMemoryUsage } from './MemoryTest.js';
import { moveOrderStore } from '@loh/shared';

/**
 * DevPanel - Development tools panel for testing and debugging
 * Only available in DEV_MODE
 */

export class DevPanel {
  constructor(scene, renderer, camera) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.panel = null;
    this.isVisible = false;
    
    this.createPanel();
    this.setupEventListeners();
  }
  
  /**
   * Create the dev panel DOM element
   */
  createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'dev-panel';
    this.panel.className = 'panel';
    this.panel.id = 'dev-panel';
    
    this.panel.innerHTML = `
      <div class="dev-panel-header">🧪 DEV PANEL</div>
      
      <div class="mb-lg">
        <button id="memory-test-btn" class="dev-panel-btn">Run Memory Test</button>
      </div>
      
      <div class="mb-lg">
        <button id="memory-log-btn" class="dev-panel-btn">Log Memory Usage</button>
      </div>
      
      <div class="mb-lg">
        <button id="move-orders-btn" class="dev-panel-btn">Log Move Orders</button>
      </div>
      
      <div class="mb-lg">
        <button id="toggle-panel-btn" class="dev-panel-btn">Hide Panel</button>
      </div>
      
      <div class="dev-panel-help">
        Press 'M' to toggle panel<br>
        Press 'T' to run memory test
      </div>
    `;
    
    document.body.appendChild(this.panel);
  }
  
  /**
   * Set up event listeners for the panel
   */
  setupEventListeners() {
    // Memory test button
    const memoryTestBtn = this.panel.querySelector('#memory-test-btn');
    memoryTestBtn.addEventListener('click', () => {
      this.runMemoryTest();
    });
    
    // Memory log button
    const memoryLogBtn = this.panel.querySelector('#memory-log-btn');
    memoryLogBtn.addEventListener('click', () => {
      this.logMemoryUsage();
    });
    
    // Move orders button
    const moveOrdersBtn = this.panel.querySelector('#move-orders-btn');
    moveOrdersBtn.addEventListener('click', () => {
      this.logMoveOrders();
    });
    
    // Toggle panel button
    const togglePanelBtn = this.panel.querySelector('#toggle-panel-btn');
    togglePanelBtn.addEventListener('click', () => {
      this.toggle();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'm') {
        this.toggle();
      } else if (event.key.toLowerCase() === 't') {
        this.runMemoryTest();
      }
    });
  }
  
  /**
   * Run the memory test
   */
  runMemoryTest() {
    console.log('🧪 DEV PANEL: Running memory test...');
    runMemoryTest(this.scene, this.renderer, this.camera);
  }
  
  /**
   * Log current memory usage
   */
  logMemoryUsage() {
    console.log('🧪 DEV PANEL: Logging memory usage...');
    logMemoryUsage(this.renderer);
  }
  
  /**
   * Log MoveOrderStore contents
   */
              logMoveOrders() {
              console.log('🧪 DEV PANEL: Logging MoveOrderStore contents...');
              const debugInfo = moveOrderStore.getDebugInfo();
              console.log('📋 MoveOrderStore Debug Info:', debugInfo);
              
              if (debugInfo.totalOrders === 0) {
                console.log('📋 No move orders stored');
              } else {
                console.log('📋 All stored move orders:');
                debugInfo.orders.forEach(orderInfo => {
                  console.log(`  ${orderInfo.key}:`, orderInfo.summary);
                });
              }
            }
  
  /**
   * Show the dev panel
   */
  show() {
    this.panel.style.display = 'block';
    this.isVisible = true;
    this.panel.querySelector('#toggle-panel-btn').textContent = 'Hide Panel';
  }
  
  /**
   * Hide the dev panel
   */
  hide() {
    this.panel.style.display = 'none';
    this.isVisible = false;
    this.panel.querySelector('#toggle-panel-btn').textContent = 'Show Panel';
  }
  
  /**
   * Toggle the dev panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Destroy the dev panel
   */
  destroy() {
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
    this.panel = null;
  }
}
