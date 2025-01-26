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

    teams: new Map<T.Color, T.TeamState>(),

    handlers: Object.create(null) as Handlers,

    /// sends a request to set new location to server
    /// SOCKET.self will not be updated until acknowledged by server
    setLocation(location: T.CubeLocation) {
        let msg: T.ClientMessage = [T.MessageType.MOVE, { location }];
        SOCKET.conn.send(JSON.stringify(msg));
    },

    setName(name: string) {
        let msg: T.ClientMessage = [T.MessageType.RENAME, { name }];
        SOCKET.conn.send(JSON.stringify(msg));
    },

    /// only valid before any calls to setLocation, otherwise server will kick
    setColor(color: T.Integer) {
        let msg: T.ClientMessage = [T.MessageType.CHANGE_COLOR, { color }];
        SOCKET.conn.send(JSON.stringify(msg));
    },

    callbacks: {} as Callbacks,
};

export interface Callbacks {
    onSelfUpdate?(state: T.SelfPlayerState): void;
    onPlayerSpawn?(state: T.RemotePlayerState): void;
    onPlayerDespawn?(state: T.RemotePlayerState): void;
    onPlayerUpdate?(state: T.RemotePlayerState): void;
    onCellUpdate?(location: CubeCoordinates, data: T.Cell): void;
    onTeamsUpdate?(teams: T.TeamState[]): void;
    onGridEvent?(event: T.GridEventMessage): void;
    onConnectionLost?(): void;
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
        SOCKET.callbacks.onConnectionLost?.();
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
        SOCKET.teams = new Map(msg.teams.map(st => [st.color, st]));
        def.resolve([SOCKET.self, SOCKET.grid]);

        SOCKET.callbacks.onSelfUpdate?.(SOCKET.self);
        for (let [locationKey, cell] of Object.entries(SOCKET.grid)) {
            let location = locationKey as T.CubeLocation;
            SOCKET.callbacks.onCellUpdate?.(CubeCoordinates.from_string(location), cell);
        }
    };

    function playerHasDiff(
      p1: T.RemotePlayerState,
      p2: T.RemotePlayerState,
    ): boolean {
      // assumes that id doesn't change
      return (
        p1.location !== p2.location ||
        p1.name !== p2.name ||
        p1.color !== p2.color
      );
    }

    SOCKET.handlers[T.MessageType.UPDATE_GRID] = (msg_) => {
      let msg = msg_[1] as T.UpdateGridMessage;

      for (let [locationKey, cell] of Object.entries(
        T.decompressGrid(msg.gridDiff),
      )) {
        let location = locationKey as T.CubeLocation;
        SOCKET.callbacks.onCellUpdate?.(
          CubeCoordinates.from_string(location),
          cell,
        );
        if (cell.state === T.CellState.BLANK) {
          delete SOCKET.grid[location];
        } else {
          SOCKET.grid[location] = cell;
        }
      }
    };

    SOCKET.handlers[T.MessageType.UPDATE_PLAYER] = (msg_) => {
      let msg = msg_[1] as T.UpdatePlayerMessage;

      // self?
      if (msg.id === SOCKET.self.id) {
        // assume update is not spurious and something has already changed
        // why would the server do otherwise
        // also own state can NOT be null at this point
        let state = msg.state as T.SelfPlayerState;
        SOCKET.self = state;
        SOCKET.callbacks.onSelfUpdate?.(state);
        return;
      }

      // player despawn?
      if (msg.state === null) {
        if (!SOCKET.players.has(msg.id)) return; // spurious?
        let lastState = SOCKET.players.get(msg.id)!;
        SOCKET.players.delete(msg.id);
        SOCKET.callbacks.onPlayerDespawn?.(lastState);
        return;
      }

      // hereonout state is always REMOTE
      const state = msg.state as T.RemotePlayerState;

      // new player?
      if (!SOCKET.players.has(msg.id)) {
        SOCKET.callbacks.onPlayerSpawn?.(state);
        SOCKET.players.set(msg.id, state);
        return;
      }

      // updating player
      let lastState = SOCKET.players.get(msg.id)!;
      if (!playerHasDiff(lastState, state)) return;

      lastState.color = state.color;
      lastState.name = state.name;
      lastState.location = state.location;
      SOCKET.callbacks.onPlayerUpdate?.(lastState);
    };

    SOCKET.handlers[T.MessageType.UPDATE_TEAMS] = (msg_) => {
        let msg = msg_[1] as T.UpdateTeamsMessage;

        for (let team of msg.teams) {
            SOCKET.teams.set(team.color, team);
        }

        SOCKET.callbacks.onTeamsUpdate?.(msg.teams);
    };

    SOCKET.handlers[T.MessageType.GRID_EVENT] = (msg_) => {
        let msg = msg_[1] as T.GridEventMessage;
        console.log('[ws] grid event', msg);
        SOCKET.callbacks.onGridEvent?.(msg);
    }
}

