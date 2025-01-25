// import * as http from 'node:http';
import { type WebSocket, WebSocketServer } from 'ws';
import * as T from '../../types';

import { PLAYERS } from './player';

const wss = new WebSocketServer({ port: 9025 });

export function send(ws: WebSocket, message: T.ServerMessage) {
    const encoded = JSON.stringify(message);
    ws.send(encoded);
}

wss.on('connection', (ws) => PLAYERS.spawn(ws));

wss.on('listening', () => {
    console.log('listening on', wss.address());
});
