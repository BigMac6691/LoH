/**
 * StatusComponent - Status message display component
 * Displays status messages at the bottom of the main content area
 */
import { eventBus } from '../eventBus.js';
import { Utils } from '../utils/Utils.js';

export class StatusComponent
{
   constructor()
   {
      this.container = document.createElement('div');
      this.container.className = 'home-status-component';
      this.container.innerHTML = '<div class="status-messages"></div>';

      this.messagesContainer = this.container.querySelector('.status-messages');

      eventBus.on('ui:statusMessage', this.statusMessage.bind(this));
   }

   /**
    * Get the container element
    * @returns {HTMLElement} The status component container
    */
   getContainer()
   {
      return this.container;
   }

   /**
    * Handle status message event
    * @param {ApiEvent} event - Event object
    */
   statusMessage(event) 
   {
      console.log('StatusComponent: statusMessage', event);

      let message = 'Unknown status message';
      let type = 'fatal';
    
      switch (event?.data?.type)
      {
         case 'info':
            message = `ℹ️ Info: ${event?.data?.message}`;
            type = 'info';
            break;
         case 'success':
            message = `✅ Success: ${event?.data?.message}`;
            type = 'success';
            break;
         case 'error':
            message = `❌ Error: ${event?.data?.message}, source: ${event?.data?.source}, line: ${event?.data?.lineno}, column: ${event?.data?.colno}, error: ${event?.data?.error}`;
            type = 'error';
            break;
         case 'reject':
            message = `❌ Reject: ${event?.data?.message}, reason: ${event?.data?.reason}, promise: ${event?.data?.promise}`;
            type = 'reject';
            break;
         case 'warning':
            message = `⚠️ Warning: ${event?.data?.message}`;
            type = 'warning';
            break;
      }
    
      this.postStatusMessage(message, type);
   }

   postStatusMessage(message, type = 'info')
   {
      const messageDiv = document.createElement('div');
      messageDiv.className = `status-message status-${type}`;
      messageDiv.innerHTML = `<span class="status-time">[${Utils.getUTCTimeString()}]</span> <span class="status-text">${Utils.escapeHtml(message)}</span>`;
      this.messagesContainer.appendChild(messageDiv);

      // Auto-scroll to bottom
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

      // Auto-remove old messages after 30 seconds (keep last 10 messages)
      setTimeout(() =>
      {
         const messages = this.messagesContainer.querySelectorAll('.status-message');

         if (messages.length > 10)
            messages[0].remove();
      }, 30000);
   }

   /**
    * Clean up
    */
   dispose()
   {
      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
      this.messagesContainer = null;

      eventBus.off('ui:statusMessage', this.statusMessage.bind(this));
   }
}
