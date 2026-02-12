export class RequestManager
{
  abortContexts = new Map();
  lastRequestIds = new Map();
  pendingRequestIds = new Set();

  getAbortController(context)
  {
    if (!this.abortContexts.has(context))
      this.abortContexts.set(context, new AbortController());

    return this.abortContexts.get(context);
  }

  reset(context)
  {
    this.abort(context);
    this.abortContexts.set(context, new AbortController());

    return this.abortContexts.get(context);
  }

  abort(context)
  {
    const controller = this.abortContexts.get(context);

    if (controller)
    {
      controller.abort();
      this.abortContexts.delete(context);
    }
  }

  start(context, transactionId)
  {
    this.lastRequestIds.set(context, transactionId);
  }

  isLatest(context, transactionId)
  {
    return this.lastRequestIds.get(context) === transactionId;
  }

  getLastTransactionId(context)
  {
    return this.lastRequestIds.get(context);
  }

  complete(context)
  {
    this.lastRequestIds.delete(context);
  }

  // Following methods are used to track pending requests
  addPending(transactionId)
  {
     this.pendingRequestIds.add(transactionId);
  }

  isPending(transactionId)
  {
     return this.pendingRequestIds.has(transactionId);
  }

  removePending(transactionId)
  {
     return this.pendingRequestIds.delete(transactionId);
  }

  clearPending()
  {
     this.pendingRequestIds.clear();
  }
}