/**
 * ApiEvent - Base event class, all events extend this class, it contains the transaction ID and the event type and data
 * Typically acts like a command when used on its own.
 * @param {string} type - Event type, typically the event name
 * @param {any} data - Event data - optional
 */
export class ApiEvent
{
    constructor(type, data = null)
    {
        this.transactionId = crypto.randomUUID();

        this.type = type;
        this.data = data;
    }
}

/**
 * ApiRequest - Request event, typically requesting data from the server.
 * Typically used to prepare a response event when the response is received in order to keep the transaction ID consistent.
 * @param {string} type - Event type, typically the event name
 * @param {any} data - Request data - optional
 */
export class ApiRequest extends ApiEvent
{
    constructor(type, data = null, signal = null)
    {
        super(type, data);
        this.signal = signal;
    }

    prepareResponse(type, data = null, status = 200, error = null)
    {
        const responseEvent = new ApiResponse(type, data, status, error);
        responseEvent.transactionId = this.transactionId;
        
        return responseEvent;
    }
}

/**
 * ApiResponse - Response event, typically either the response data or the error data will be present
 * @param {string} type - Event type, typically the event name
 * @param {any} data - Response data - optional
 * @param {number} status - Response status
 * @param {any} error - Error data - optional
 */
export class ApiResponse extends ApiEvent
{
    constructor(type, data = null, status = 200, error = null)
    {
        super(type, data);
        this.status = status;
        this.error = error;
    }

    isSuccess()
    {
        return this.status >= 200 && this.status < 300;
    }

    isAborted()
    {
        return this.status === 499;
    }

    isError()
    {
        return this.status >= 400;
    }

    isServerError()
    {
        return this.status >= 500;
    }
}