import { EventEmitter } from 'events';

class ServerBus extends EventEmitter
{
}

export const serverBus = new ServerBus();
