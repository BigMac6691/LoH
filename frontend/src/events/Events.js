export class ApiEvent
{
    constructor(type)
    {
        this.type = type;
    }
}

export class ApiRequest extends ApiEvent
{
    constructor(type, request)
    {
        super(type);
        this.request = request;
    }
}

/**
 * ApiResponse - Response event, typically either the response data or the error data will be present
 * @param {string} type - Event type, typically the event name
 * @param {any} response - Response data - optional
 * @param {number} status - Response status
 * @param {any} error - Error data - optional
 */
export class ApiResponse extends ApiEvent
{
    constructor(type, response = null, status = 200, error = null)
    {
        super(type);
        this.response = response;
        this.status = status;
        this.error = error;
    }

    isSuccess()
    {
        return this.status >= 200 && this.status < 300;
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