/**
 * Dialog - Base class for modal dialogs using HTML <dialog> element
 * Provides common functionality for creating, showing, and managing dialogs
 */
export class Dialog
{
   /**
    * Create a new dialog
    * @param {Object} options - Dialog configuration options
    * @param {string} options.title - Dialog title
    * @param {string} options.contentHTML - HTML content for the dialog body
    * @param {string} options.className - Optional CSS class name for the dialog
    * @param {string} options.styles - Optional custom styles string (appended to default styles)
    * @param {Function} options.onClose - Optional callback function called when dialog is closed
    */
   constructor(options = {})
   {
      this.dialog = document.createElement('dialog');
      this.dialog.className = options.className || 'app-dialog';
      
      // Apply default styles to match existing appearance
      this.dialog.style.cssText = 
      `
         background: rgba(0, 0, 0, 0.95);
         border: 2px solid #00ff88;
         border-radius: 15px;
         padding: 30px;
         color: white;
         min-width: 400px;
         max-width: 500px;
         backdrop-filter: blur(10px);
         font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
         ${options.styles || ''}
      `;

      // Build dialog HTML structure
      this.dialog.innerHTML = 
      `
         <h2 style="margin: 0 0 20px 0; color: #00ff88; text-align: center;">${options.title || 'Dialog'}</h2>
         ${options.contentHTML || ''}
      `;

      this.onClose = options.onClose;

      // Add backdrop styling via CSS (::backdrop pseudo-element)
      // Note: We'll need to add this to a style tag or CSS file, but for now we'll use inline styles
      // The dialog element's ::backdrop is styled via CSS, but we can add a style tag
      this.setupBackdrop();

      // Setup event handlers
      this.setupEventHandlers();
   }

   /**
    * Setup backdrop styling
    */
   setupBackdrop()
   {
      // Add style tag for backdrop if it doesn't exist
      if (!document.getElementById('dialog-backdrop-styles'))
      {
         const style = document.createElement('style');
         style.id = 'dialog-backdrop-styles';
         style.textContent = 
         `  dialog::backdrop 
            {
               background: rgba(0, 0, 0, 0.6);
               backdrop-filter: blur(5px);
            }
         `;
         document.head.appendChild(style);
      }
   }

   /**
    * Setup event handlers for dialog
    */
   setupEventHandlers()
   {
      // Close on Escape key (native dialog behavior)
      this.dialog.addEventListener('cancel', (e) =>
      {
         e.preventDefault();
         this.close();
      });
   }

   /**
    * Show the dialog
    */
   show()
   {
      if (!this.dialog.parentNode)
         document.body.appendChild(this.dialog);
      
      this.dialog.showModal();
   }

   /**
    * Close the dialog
    */
   close()
   {
      this.dialog.close();
      
      if (this.dialog.parentNode)
         this.dialog.parentNode.removeChild(this.dialog);
      
      // Call onClose callback if provided
      if (this.onClose)
         this.onClose();
   }

   /**
    * Get the dialog element
    * @returns {HTMLDialogElement}
    */
   getDialog()
   {
      return this.dialog;
   }
}
