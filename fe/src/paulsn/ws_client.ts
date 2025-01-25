import * as T from '../../../types';
import { CubeCoordinates } from '../coordinates';
import { deferred } from './util';

type Handlers = { [type in T.ServerMessageType]: (msg: T.ServerMessage) => void };
export const SOCKET = {
    conn: new WebSocket('ws://127.0.0.1:9025'),
    init: null as any as Promise<[T.SelfPlayerState, T.CellGrid]>,

    /// HACK[paulsn]: erases that self can be null during initialization so that
    /// accessing it after initialization is less of a pain
    ///
    /// SAFETY: await for `SOCKET.init` if you're not sure whether this will be
    /// initialized!
    // TODO[paulsn] event bus/observer pattern?
    self: null as any as T.SelfPlayerState,

    /// HACK[paulsn]: same as self
    /// SAFETY: same as self
    grid: null as any as T.CellGrid,

    /// contains state only for other (non-self) players
    /// objects recreated, NOT PATCHED, after every update
    // TODO[paulsn] event bus/observer pattern?
    players: new Map<T.PlayerID, T.RemotePlayerState>(),

    handlers: Object.create(null) as Handlers,

    /// sends a request to set new location to server
    /// SOCKET.self will not be updated until acknowledged by server
    setLocation(location: T.CubeLocation) {
        let msg = [T.MessageType.MOVE, { location }];
        SOCKET.conn.send(JSON.stringify(msg));
    },

    callbacks: {} as Callbacks,
};

export interface Callbacks {
    onSelfUpdate?(state: T.SelfPlayerState): void;
    onPlayerSpawn?(state: T.RemotePlayerState): void;
    onPlayerDespawn?(state: T.RemotePlayerState): void;
    onPlayerMove?(state: T.RemotePlayerState): void;
    onCellUpdate?(location: CubeCoordinates, data: T.Cell): void;
}

export default SOCKET;
window.SOCKET = SOCKET;

{
    let def = deferred<[T.SelfPlayerState, T.CellGrid]>();
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
        SOCKET.grid = T.decompressGrid(msg.grid);
        SOCKET.players = new Map(msg.others.map((p) => [p.id, p]));
        def.resolve([SOCKET.self, SOCKET.grid]);

        SOCKET.callbacks.onSelfUpdate?.(SOCKET.self);
        for (let [locationKey, cell] of Object.entries(SOCKET.grid)) {
            let location = locationKey as T.CubeLocation;
            SOCKET.callbacks.onCellUpdate?.(CubeCoordinates.from_string(location), cell);
        }
    };

    function playerSelfHasDiff(p1: T.SelfPlayerState, p2: T.SelfPlayerState): boolean {
        // assumes that id and color don't change
        return p1.location !== p2.location || p1.energy !== p2.energy;
    }
    function playerHasDiff(p1: T.RemotePlayerState, p2: T.RemotePlayerState): boolean {
        // assumes that id and color don't change
        return p1.location !== p2.location;
    }

    SOCKET.handlers[T.MessageType.UPDATE] = (msg_) => {
        let msg = msg_[1] as T.UpdateMessage;

        // [1] update self
        if (playerSelfHasDiff(msg.self, SOCKET.self)) {
            SOCKET.self.location = msg.self.location;
            SOCKET.self.energy = msg.self.energy;
            console.log('[ws cb] self update (loc: %s, en: %d)', msg.self.location, msg.self.energy);
            SOCKET.callbacks.onSelfUpdate?.(SOCKET.self);
        }

        // [2] process foreign player updates
        let seen = new Set<T.PlayerID>();
        for (let player of msg.others) {
            // move other if already present
            if (SOCKET.players.has(player.id)) {
                seen.add(player.id);
                let prevPlayer = SOCKET.players.get(player.id)!;
                if ( ! playerHasDiff(player, prevPlayer)) continue;
                prevPlayer.location = player.location;
                console.log('[ws cb] move', player.id);
                SOCKET.callbacks.onPlayerMove?.(prevPlayer);
                continue;
            }

            // spawn other
            SOCKET.players.set(player.id, player);
            console.log('[ws cb] spawn', player.id);
            SOCKET.callbacks.onPlayerSpawn?.(player);
            seen.add(player.id);
        }

        // [2.1] process despawns
        for (let [id, player] of SOCKET.players.entries()) {
            if (seen.has(id)) continue;
            console.log('[ws cb] despawn', player.id);
            SOCKET.callbacks.onPlayerDespawn?.(player);
            SOCKET.players.delete(player.id);
        }

        // [3] process grid updates
        for (let [locationKey, cell] of Object.entries(T.decompressGrid(msg.gridDiff))) {
            let location = locationKey as T.CubeLocation;
            SOCKET.callbacks.onCellUpdate?.(CubeCoordinates.from_string(location), cell);
            if (cell.state === T.CellState.BLANK) {
                delete SOCKET.grid[location];
            } else {
                SOCKET.grid[location] = cell;
            }
        }
    };
}

