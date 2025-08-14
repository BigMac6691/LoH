import { runMemoryTest, logMemoryUsage } from './MemoryTest.js';
import { moveOrderStore } from '../../../shared/MoveOrderStore.js';

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
    this.panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      min-width: 200px;
      display: none;
    `;
    
    this.panel.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #00ff00;">🧪 DEV PANEL</div>
      
      <div style="margin-bottom: 10px;">
        <button id="memory-test-btn" style="
          background: #444;
          color: white;
          border: 1px solid #666;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
        ">Run Memory Test</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <button id="memory-log-btn" style="
          background: #444;
          color: white;
          border: 1px solid #666;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
        ">Log Memory Usage</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <button id="move-orders-btn" style="
          background: #444;
          color: white;
          border: 1px solid #666;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
        ">Log Move Orders</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <button id="toggle-panel-btn" style="
          background: #666;
          color: white;
          border: 1px solid #888;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
        ">Hide Panel</button>
      </div>
      
      <div style="font-size: 10px; color: #ccc;">
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
