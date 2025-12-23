/**
 * Event Bus - Centralized event system for game communication
 * Handles custom events for startup flow and game state management
 */
export class EventBus
{
   constructor()
   {
      this.listeners = new Map();
   }

   /**
    * Add an event listener
    * @param {string} event - Event name
    * @param {Function} callback - Callback function
    * @param {Object} options - Options (once: boolean)
    */
   on(event, callback, options = {})
   {
      if (!this.listeners.has(event))
         this.listeners.set(event, []);

      this.listeners.get(event).push({ callback, once: options.once || false });
   }

   /**
    * Add a one-time event listener
    * @param {string} event - Event name
    * @param {Function} callback - Callback function
    */
   once(event, callback)
   {
      this.on(event, callback, { once: true });
   }

   /**
    * Remove an event listener
    * @param {string} event - Event name
    * @param {Function} callback - Callback function to remove
    */
   off(event, callback)
   {
      if (!this.listeners.has(event)) 
        return;

      const listeners = this.listeners.get(event);
      const index = listeners.findIndex(listener => listener.callback === callback);

      if (index !== -1)
         listeners.splice(index, 1);
   }

   /**
    * Emit an event
    * @param {string} event - Event name
    * @param {*} data - Event data
    */
   emit(event, data = null)
   {
      if (!this.listeners.has(event)) 
      {
         console.warn(`EventBus: Event ${event} not found`);
         return;
      }

      const listeners = this.listeners.get(event);
      const toRemove = [];

      listeners.forEach((listener, index) =>
      {
        listener.callback(data);

        if (listener.once)
          toRemove.push(index);
      });

      // Remove one-time listeners
      toRemove.reverse().forEach(index => this.listeners.splice(index, 1));
   }

   /**
    * Clear all listeners for an event
    * @param {string} event - Event name (optional, clears all if not provided)
    */
   clear(event = null)
   {
      if (event)
         this.listeners.delete(event);
      else
         this.listeners.clear();
   }

   /**
    * Get listener count for an event
    * @param {string} event - Event name
    * @returns {number} Number of listeners
    */
   listenerCount(event)
   {
      return this.listeners.has(event) ? this.listeners.get(event).length : 0;
   }
}

// Create global event bus instance
export const eventBus = new EventBus();

// Add star-related events to the global event bus
export const STAR_EVENTS = 
{
   HOVER: 'star:hover',
   UNHOVER: 'star:unhover',
   CLICK: 'star:click'
};
