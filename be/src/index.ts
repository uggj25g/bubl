// import * as http from 'node:http';
import { type WebSocket, WebSocketServer } from 'ws';
import * as T from '../../types';

type PlayerConnection = {
    conn: WebSocket,
    state: T.PlayerState,
}

let players = new Map<WebSocket, PlayerConnection>();
let grid = [] as Array<T.Cell>;

const wss = new WebSocketServer({ port: 9025 });

function send(ws: WebSocket, message: T.ServerMessage) {
    const encoded = JSON.stringify(message);
    ws.send(encoded);
}

function sendUpdate(except?: Set<WebSocket>) {
    except ??= new Set();
    const msg: T.UpdateMessage = {
        players: Array.from(players.values()).map(conn => conn.state),
        // TODO[paulsn] actually keep track of a grid and send efficient update here
        gridDiff: grid,
    };
    for (let ws of players.keys()) {
        if (except.has(ws)) continue;
        send(ws, [T.MessageType.UPDATE, msg]);
    }
    console.log('[state]', Array.from(players.values()).map(({ state }) => state));
}

function decodeMessage(msg: any): T.ClientMessage | null {
    if ( ! Array.isArray(msg)) return null;
    if (msg.length !== 2) return null;
    let [type, payload] = msg;
    if ( ! T.isValidClientMessageType(type)) return null;
    // TODO[paulsn] validate structure of payload? but that's tedious ;-;
    return [type, payload] as T.ClientMessage;
}

wss.on('connection', (ws) => {
    let playerState = {
        // TODO[paulsn] id collision check
        id: Math.abs(Math.random() * (2**32) | 0),
        // TODO[paulsn] assign random
        location: T.cube(0, 0, 0),
        // TODO[paulsn] assign random
        color: 0,
    };

    let playerConn = {
        conn: ws,
        state: playerState,
    };

    console.log('[connect]', playerState.id);

    players.set(ws, playerConn);
    send(ws, [T.MessageType.INIT, {
        protocolVersion: T.PROTOCOL_VERSION,
        self: playerState,
        others: Array.from(players.values())
            .filter(conn => conn !== playerConn)
            .map(conn => conn.state),
        grid,
    }]);
    sendUpdate(new Set([ws]));

    ws.on('message', (rawMsg, isBinary) => {
        if (isBinary) return;
        let strMsg = rawMsg.toString('utf8');
        let anyMsg: any;
        try {
            anyMsg = JSON.parse(strMsg);
        } catch (e) {
            return;
        }
        console.log('[receive:%d]', playerState.id, anyMsg);
        let msg = decodeMessage(anyMsg);
        if (msg === null) return;

        switch (msg[0]) {
        case T.MessageType.MOVE: {
            const { location } = msg[1];
            playerState.location = location;
            let newCell: T.CellTrail = {
                state: T.CellState.TRAIL,
                location,
                color: playerState.color,
                ownerPlayer: playerState.id,
                // TODO[paulsn] decay
                age: 1,
            };
            // TODO[paulsn] O(N^2)
            search: {
                for (let [i, cell] of grid.entries()) {
                    if (T.cube_eq(cell.location, location)) {
                        grid[i] = newCell;
                        break search;
                    }
                }

                // not found
                grid.push(newCell);
            };
            sendUpdate();
            break;
        }
        }
    });
    ws.on('close', () => {
        console.log('[disconnect]', playerState.id);
        players.delete(ws);
        sendUpdate();
    });
});

wss.on('listening', () => {
    console.log('listening on', wss.address());
});
