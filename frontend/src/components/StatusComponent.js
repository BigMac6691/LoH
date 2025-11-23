/**
 * StatusComponent - Status message display component
 * Displays status messages at the bottom of the main content area
 */
export class StatusComponent {
  constructor() {
    this.container = null;
  }

  /**
   * Create the status component DOM element
   * @returns {HTMLElement} The status component container
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'home-status-component';
    this.container.innerHTML = '<div class="status-messages"></div>';
    return this.container;
  }

  /**
   * Get the container element
   * @returns {HTMLElement} The status component container
   */
  getContainer() {
    if (!this.container) {
      this.create();
    }
    return this.container;
  }

  /**
   * Post a message to the status component
   * @param {string} message - Message to display
   * @param {string} type - Message type: 'info', 'success', 'error', 'warning' (default: 'info')
   */
  postStatusMessage(message, type = 'info') {
    if (!this.container) {
      this.create();
    }
    
    const messagesContainer = this.container.querySelector('.status-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `status-message status-${type}`;
    
    // Format timestamp (UTC)
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'UTC'
    });
    
    messageDiv.innerHTML = `<span class="status-time">[${timeStr}]</span> <span class="status-text">${this.escapeHtml(message)}</span>`;
    
    messagesContainer.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Auto-remove old messages after 30 seconds (keep last 10 messages)
    setTimeout(() => {
      const messages = messagesContainer.querySelectorAll('.status-message');
      if (messages.length > 10) {
        messages[0].remove();
      }
    }, 30000);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

