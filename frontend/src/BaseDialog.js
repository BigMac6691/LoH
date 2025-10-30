/**
 * BaseDialog - Base class for draggable dialogs
 * Provides common functionality like dragging, keyboard handling, and basic dialog lifecycle
 */
export class BaseDialog
{
   constructor()
   {
      this.isVisible = false;
      this.dialog = null;
      this.isDragging = false;
      this.dragOffset = {
         x: 0,
         y: 0
      };
   }

   /**
    * Setup drag handlers for the dialog
    * @param {HTMLElement} dragHandle - The element that will be used to drag the dialog
    */
   setupDragHandlers(dragHandle)
   {
      dragHandle.addEventListener('mousedown', (e) =>
      {
        console.log('📝 BaseDialog: Setting up drag handlers');

         if (this.dialog === null) 
          return;

         this.isDragging = true;
         const rect = this.dialog.getBoundingClientRect();
         this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
         };
         e.preventDefault();
      });

      document.addEventListener('mousemove', (e) =>
      {
         if (!this.isDragging) 
          return;

         const x = e.clientX - this.dragOffset.x;
         const y = e.clientY - this.dragOffset.y;

         // Keep dialog within viewport bounds
         const maxX = window.innerWidth - this.dialog.offsetWidth;
         const maxY = window.innerHeight - this.dialog.offsetHeight;

         const clampedX = Math.max(0, Math.min(x, maxX));
         const clampedY = Math.max(0, Math.min(y, maxY));

         this.dialog.style.left = clampedX + 'px';
         this.dialog.style.top = clampedY + 'px';
         this.dialog.style.transform = 'none';
      });

      document.addEventListener('mouseup', () =>
      {
         this.isDragging = false;
      });
   }

   /**
    * Setup keyboard handlers for accessibility
    * Override this method in subclasses to add specific keyboard handling
    */
   setupKeyboardHandlers()
   {
      document.addEventListener('keydown', (e) =>
      {
         if (!this.isVisible) return;

         // ESC key handling - can be overridden by subclasses
         if (e.key === 'Escape')
         {
            this.handleEscapeKey();
         }
      });
   }

   /**
    * Handle ESC key press
    * Override this method in subclasses to customize ESC key behavior
    */
   handleEscapeKey()
   {
      this.hide();
   }

   /**
    * Show the dialog
    * Override this method in subclasses to add custom show logic
    */
   show()
   {
      this.isVisible = true;
      if (this.dialog)
      {
         this.dialog.style.display = 'block';
      }
   }

   /**
    * Hide the dialog
    * Override this method in subclasses to add custom hide logic
    */
   hide()
   {
      this.isVisible = false;
      if (this.dialog)
      {
         this.dialog.style.display = 'none';
      }
   }

   /**
    * Check if the dialog is currently open
    * @returns {boolean} True if the dialog is visible
    */
   isOpen()
   {
      return this.isVisible;
   }

   /**
    * Clean up resources
    * Override this method in subclasses to add custom cleanup logic
    */
   dispose()
   {
      if (this.dialog && this.dialog.parentNode)
      {
         this.dialog.parentNode.removeChild(this.dialog);
      }
   }
}
