/**
 * MenuView - Base class for all menu view components
 * Provides common functionality for components displayed in the home page menu
 */
export class MenuView
{
   constructor(statusComponent)
   {
      this.statusComponent = statusComponent;
   }

   /**
    * Display a status message in the status component
    * @param {string} message - Message to display
    * @param {string} type - Message type: 'info', 'success', 'error', 'warning' (default: 'info')
    */
   displayStatusMessage(message, type = 'info')
   {
      if (this.statusComponent && this.statusComponent.postStatusMessage)
      {
         this.statusComponent.postStatusMessage(message, type);
      }
      else
      {
         // Fallback to alert if statusComponent is not available
         alert(message);
      }
   }
}
