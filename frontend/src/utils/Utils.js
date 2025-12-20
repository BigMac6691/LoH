export class Utils
{
   static escapeHtml(text)
   {
      if (!text) 
        return '';
      
      const div = document.createElement('div');
      div.textContent = text;
      
      return div.innerHTML;
      // return escaped.replace(/\n/g, '<br>');
   }

   static getUTCTimeString(date = new Date())
   {
      return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
   }

   static requireElement(selector)
   {
      const element = document.querySelector(selector);

      if (!element)
         throw new Error(`Utils: Element not found: ${selector}`);

      return element;
   }

   static requireChild(parent, selector)
   {
      const element = parent.querySelector(selector);

      if (!element)
         throw new Error(`Utils: Child element not found: ${selector} inside ${parent.tagName}.${parent.className} with id ${parent.id}`);

      return element;
   }

   /**
    * Validate email address
    * @param {string} email - Email to validate
    * @returns {boolean} True if valid
    */
   static validateEmail(email)
   {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
   }

   /**
    * Validate password strength
    * @param {string} password - Password to validate
    * @returns {Object} { valid: boolean, errors: string[] }
    */
   static validatePassword(password)
   {
      const errors = [];

      if (!password || password.length < 8)
         errors.push('Password must be at least 8 characters long');

      if (password && !/[A-Z]/.test(password))
         errors.push('Password must contain at least one uppercase letter');

      if (password && !/[a-z]/.test(password))
         errors.push('Password must contain at least one lowercase letter');

      if (password && !/[0-9]/.test(password))
         errors.push('Password must contain at least one number');

      if (password && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password))
         errors.push('Password must contain at least one safe symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)');

      return { valid: errors.length === 0, errors };
   }
}