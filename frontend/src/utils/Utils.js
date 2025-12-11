export class Utils
{
   static escapeHtml(text)
   {
      if (!text) 
        return '';
      
      const div = document.createElement('div');
      div.textContent = text;
      
      return div.innerHTML;
   }

   static getUTCTimeString()
   {
      return new Date().toISOString().replace('T', ' ');
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
}