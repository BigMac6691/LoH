/**
 * RulesView - Rules and Instructions placeholder component
 */
import { MenuView } from './MenuView.js';

export class RulesView extends MenuView
{
   constructor(statusComponent)
   {
      super(statusComponent);
      this.container = null;
   }

   /**
    * Create and return the rules view container
    */
   create()
   {
      this.container = document.createElement('div');
      this.container.className = 'rules-view';
      this.container.innerHTML = `
      <div class="view-header">
        <h2>Rules and Instructions</h2>
      </div>
      <div class="view-content">
        <p class="placeholder-text">Game rules and instructions will be displayed here.</p>
        <p class="placeholder-text">This is a placeholder for structured HTML content.</p>
      </div>
    `;
      return this.container;
   }

   /**
    * Get the container element
    */
   getContainer()
   {
      if (!this.container)
         this.create();

      return this.container;
   }

   /**
    * Clean up
    */
   dispose()
   {
      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);

      this.container = null;
   }
}
