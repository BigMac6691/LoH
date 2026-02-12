export class ClientLogger
{
   static log(message, context = {})
   {
      console.log(message, context);
   }

   static info(message, context = {})
   {
      console.info(message, context);
   }

   static warn(message, context = {})
   {
      console.warn(message, context);
   }

   static error(message, context = {})
   {
      console.error(message, context);
   }

   static debug(message, context = {})
   {
      console.debug(message, context);
   }

   static trace(message, context = {})
   {
      console.trace(message, context);
   }
}
