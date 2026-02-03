import { asyncLocalStorage } from './AsyncContext.js';

export function myLogger(level, message, { correlationId, clientTxId, data } = {}) 
{
    const store = asyncLocalStorage.getStore();
    const resolvedCorrelationId = correlationId || store?.correlationId || 'none';
    const resolvedClientTxId = clientTxId || store?.clientTxId || 'none';
    const timestamp = new Date().toISOString();
  
    const payload = 
    {
      timestamp,
      level,
      clientTxId: resolvedClientTxId,
      correlationId: resolvedCorrelationId,
      message,
      ...(data && { data })
    };
  
    console[level](payload);
  }
  