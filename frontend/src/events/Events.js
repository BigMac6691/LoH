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

export class ApiResponse extends ApiEvent
{
    constructor(type, response, status)
    {
        super(type);
        this.response = response;
        this.status = status;
    }
}