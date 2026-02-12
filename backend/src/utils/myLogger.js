import { asyncLocalStorage } from './AsyncContext.js';

export function myLogger(level, message, { correlationId, clientTxId, data, error } = {}) 
{
    const store = asyncLocalStorage.getStore();
    const resolvedCorrelationId = correlationId || store?.correlationId || 'none';
    const resolvedClientTxId = clientTxId || store?.clientTxId || 'none';
    const timestamp = new Date().toISOString();
  
    const payload = 
    {
      level,
      message,
      timestamp,
      clientTxId: resolvedClientTxId,
      correlationId: resolvedCorrelationId,
      ...(data && { data }),
      ...(error && { error })
    };
  
    console[level]("myLogger:", payload);
  }
  