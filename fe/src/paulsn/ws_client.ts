import * as T from '../../../types';
import { deferred } from './util';

type Handlers = { [type in T.ServerMessageType]: (msg: T.ServerMessage) => void };
export const SOCKET = {
    conn: new WebSocket('ws://127.0.0.1:9025'),
    init: null as any as Promise<[T.PlayerState, T.CellGrid]>,

    /// HACK[paulsn]: erases that self can be null during initialization so that
    /// accessing it after initialization is less of a pain
    ///
    /// SAFETY: await for `SOCKET.init` if you're not sure whether this will be
    /// initialized!
    // TODO[paulsn] event bus/observer pattern?
    self: null as any as T.PlayerState,

    /// HACK[paulsn]: same as self
    /// SAFETY: same as self
    grid: null as any as T.CellGrid,

    /// contains state only for other (non-self) players
    /// objects recreated, NOT PATCHED, after every update
    // TODO[paulsn] event bus/observer pattern?
    playerState: [] as Array<T.PlayerState>,

    handlers: Object.create(null) as Handlers,

    /// sends a request to set new location to server
    /// SOCKET.self will not be updated until acknowledged by server
    setLocation(location: T.CubeLocation) {
        let msg = [T.MessageType.MOVE, { location }];
        SOCKET.conn.send(JSON.stringify(msg));
    },
};

export default SOCKET;
window.SOCKET = SOCKET;

{
    let def = deferred<[T.PlayerState, T.CellGrid]>();
    SOCKET.init = def.promise;
    SOCKET.conn.onerror = (ev: Event) => {
        console.log('[ws] error:', ev);
        def.reject(ev);
    };
    SOCKET.conn.onmessage = (ev: MessageEvent) => {
        let data = ev.data;
        if (typeof data !== 'string') return;
        let msg = JSON.parse(data);
        console.log('[ws] received:', data);
        if ( ! Array.isArray(msg)) return;
        if (msg.length !== 2) return;
        let type = msg[0] as T.ServerMessageType;
        if (type in SOCKET.handlers) {
            // TODO[paulsn]: validate structure ?
            SOCKET.handlers[type](msg as T.ServerMessage);
        }
    };
    SOCKET.conn.onclose = () => {
        console.warn('[ws] connection closed');
    };

    SOCKET.handlers[T.MessageType.INIT] = (msg_) => {
        let msg = msg_[1] as T.InitMessage;
        if (msg.protocolVersion !== T.PROTOCOL_VERSION) {
            console.error('[ws] incompatible protocol version: I know %d but server speaks %d – aborting', T.PROTOCOL_VERSION, msg.protocolVersion);
            SOCKET.conn.close();
            def.reject(new Error('incompatible protocol version: ' + msg.protocolVersion));
            return;
        }

        SOCKET.self = msg.self;
        SOCKET.grid = msg.grid;
        SOCKET.playerState = msg.others;
        def.resolve([SOCKET.self, SOCKET.grid]);
    };

    SOCKET.handlers[T.MessageType.UPDATE] = (msg_) => {
        let msg = msg_[1] as T.UpdateMessage;
        for (let player of msg.players) {
            if (player.id === SOCKET.self.id) {
                SOCKET.self = player;
            }
        }
        SOCKET.playerState = msg.players.filter(pl => pl.id !== SOCKET.self.id);

        for (let [locationKey, cell] of Object.entries(msg.gridDiff)) {
            let location = locationKey as T.CubeLocation;
            if (cell.state === T.CellState.BLANK) {
                delete SOCKET.grid[location];
            } else {
                SOCKET.grid[location] = cell;
            }
        }
    };
}

