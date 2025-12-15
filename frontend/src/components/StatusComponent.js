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
      this._boundStatusMessage = this.statusMessage.bind(this);

      eventBus.on('ui:statusMessage', this._boundStatusMessage);
   }

   /**
    * Get the container element
    * @returns {HTMLElement} The status component container
    */
   getContainer()
   {
      return this.container;
   }

   mount(target)
   {
      if (!(target instanceof Node))
         throw new Error('mount(): target must be a DOM Node');

      target.appendChild(this.container);
   }

   /**
    * Handle status message event
    * @param {ApiEvent} event - Event object
    */
   statusMessage(event) 
   {
      console.log('StatusComponent: statusMessage', event);

      let message = 'Unknown status message';
      
      switch (event?.data?.type)
      {
         case 'info':
         case 'success':
         case 'warning':
            message = event?.data?.message;
            break;   
         case 'error':
            message = `${event?.data?.message}, source: ${event?.data?.source}, line: ${event?.data?.lineno}, column: ${event?.data?.colno}, error: ${event?.data?.error}`;
            break;
         case 'reject':
            message = `${event?.data?.message}, reason: ${event?.data?.reason}, promise: ${event?.data?.promise}`;
            break;
      }
    
      this.postStatusMessage(message, event?.data?.type || 'fatal');
   }

   postStatusMessage(message, type = 'info')
   {
      const messageDiv = document.createElement('div');
      messageDiv.className = `status-message status-${type}`;
      messageDiv.innerHTML = `<span class="status-time">[${Utils.getUTCTimeString()}]</span> <span class="status-text">${Utils.escapeHtml(this.prefixMessage(message, type))}</span>`;
      this.messagesContainer.appendChild(messageDiv);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight; // Auto-scroll to bottom

      // Auto-remove old messages after 30 seconds (keep last 10 messages)
      setTimeout(() =>
      {
         const messages = this.messagesContainer.querySelectorAll('.status-message');

         if (messages.length > 10)
            messages[0].remove();
      }, 30000);
   }

   prefixMessage(msg, type)
   {
      switch (type)
      {
         case 'info':
            return `ℹ️ Info: ${msg}`;
         case 'success':
            return `✅ Success: ${msg}`;
         case 'error':
            return `❌ Error: ${msg}`;
         case 'reject':
            return `❌ Reject: ${msg}`;
         case 'warning':
            return `⚠️ Warning: ${msg}`;
         default:
            return msg;
      }
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

      eventBus.off('ui:statusMessage', this._boundStatusMessage);
   }
}
