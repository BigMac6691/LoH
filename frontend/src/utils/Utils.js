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
}