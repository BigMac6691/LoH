import { eventBus } from './eventBus.js';

export class EventRegister
{
   constructor()
   {
      this.eventHandlers = new Map();
   }

   registerEventHandler(eventType, handler)
   {
      const boundHandler = handler.bind(this);
      eventBus.on(eventType, boundHandler);
      this.eventHandlers.set(eventType, boundHandler);
   }

   unregisterEventHandlers()
   {
      this.eventHandlers.forEach((handler, eventType) => { eventBus.off(eventType, handler); });
      this.eventHandlers.clear();
   }
}