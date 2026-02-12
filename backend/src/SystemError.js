export class SystemError extends Error
{
   constructor(details, shortMessage, statusCode)
   {
      super(details);
      this.shortMessage = shortMessage;
      this.statusCode = statusCode;
   }

   static withSafeMessage(message, statusCode)
   {
      return new SystemError(message, message, statusCode);
   }

   static withUnsafeMessage(message, statusCode)
   {
      return new SystemError(message, 'Internal server error', statusCode);
   }
}