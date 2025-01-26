import { type WebSocket } from 'ws';
import * as T from '../../types';

import GRID from './grid';
import { send } from './index';
import { choose, ANIMALS, assert } from './util';

const PLAYER_TRAIL_LENGTH = 8;
const MAX_COLORS = 2;

export class Player {
    id: T.PlayerID;
    conn: WebSocket;
    /// null if disconnected
    state: T.SelfPlayerState | null;
    decayTrail: Set<T.CubeLocation>;
    hasMoved: boolean;

    constructor(conn: WebSocket, state: T.SelfPlayerState) {
        this.conn = conn;
        this.state = state;
        this.id = state.id;
        this.decayTrail = new Set();
        this.hasMoved = false;

        this.handleMessageBase = this.handleMessageBase.bind(this);
        this.conn.on('message', this.handleMessageBase);
    }
    dispose() {
        this.conn.removeListener('message', this.handleMessageBase);
    }

    get remoteState(): T.RemotePlayerState | null {
        if (this.state === null) return null;
        let state: T.RemotePlayerState & { energy?: T.SelfPlayerState["energy"] } = { ...this.state };
        delete state.energy;
        return state;
    }

    handleMessageBase(rawMsg: any, isBinary: boolean) {
        if (isBinary) return;
        let strMsg = rawMsg.toString('utf8');
        let anyMsg: any;
        try {
            anyMsg = JSON.parse(strMsg);
        } catch (e) {
            return;
        }
        if ( ! Array.isArray(anyMsg)) return;
        if (anyMsg.length !== 2) return;
        this.handleMessage(anyMsg as T.ClientMessage);
    }

    handleMessage(msg: T.ClientMessage) {
        console.log('[%d msg] %o', this.id, msg);
        switch (msg[0]) {
        case T.MessageType.MOVE: return this.handleMove(msg[1]);
        case T.MessageType.RENAME: return this.handleRename(msg[1]);
        case T.MessageType.CHANGE_COLOR: return this.handleChangeColor(msg[1]);
        }
    }
    handleMove(msg: T.MoveMessage) {
        assert(this.state !== null);
        const { location } = msg;
        this.state.location = location;

        GRID.decayTrail(this.id, this.decayTrail);
        GRID.setTrail(
            location,
            this.state.color,
            this.id,
            this.state.energy,
        );
        GRID.reviveAround(location, this.state.color);
        this.decayTrail.add(location);

        PLAYERS.broadcastPlayerUpdate(this);
    }
    handleRename(msg: T.RenameMessage) {
        assert(this.state !== null);
        const { name } = msg;
        this.state.name = name;
        PLAYERS.broadcastPlayerUpdate(this);
    }
    handleChangeColor(msg: T.ChangeColorMessage) {
        assert(this.state !== null);
        if (this.hasMoved) {
            console.log('[%d msg] change color DENIED: movement already happened', this.id);
            PLAYERS.disconnect(this);
            return;
        }
        if (msg.color >= MAX_COLORS) {
            console.log('[%d msg] change color DENIED: color %d out of bounds', this.id, msg.color);
            PLAYERS.disconnect(this);
            return;
        }

        this.state!.color = msg.color;
        PLAYERS.broadcastPlayerUpdate(this);
    }
}

class Players {
    #byWs: Map<WebSocket, Player>;
    #byId: Map<T.PlayerID, Player>;
    #nextColor = 0;

    constructor() {
        this.#byWs = new Map();
        this.#byId = new Map();

        GRID.onupdate = (diff) => {
            console.log('[grid] update', diff);
            this.broadcastGridUpdate(diff);
        };
    }

    #id(): T.PlayerID {
        const scale = 1 << 31;
        let id;
        do {
            id = Math.abs(Math.random() * scale) | 0;
        } while (this.#byId.has(id) && id !== 0);
        return id;
    }

    get all(): Player[] {
        return Array.from(this.#byId.values());
    }

    spawn(conn: WebSocket): Player {
        let id = this.#id();
        let state: T.SelfPlayerState = {
            id: id,
            name: choose(ANIMALS),
            color: this.#nextColor, // TODO[paulsn] assign random
            location: '0,0,0', // TODO[paulsn] assign random
            energy: PLAYER_TRAIL_LENGTH, // TODO[paulsn] do not hardcode
            score: 0, // TODO persistence?
        };
        this.#nextColor = (this.#nextColor + 1) % 3;

        let player = new Player(conn, state);
        this.#byWs.set(conn, player);
        this.#byId.set(id, player);

        console.log('[%d connect]', id);

        conn.once('close', () => {
            this.#byWs.delete(conn);
            this.#byId.delete(id);
            player.state = null;
            this.broadcastPlayerUpdate(player);
            console.log('[%d disconnected]', id);
            player.dispose();
        });

        let otherPlayers = Array.from(this.#byId.values())
            .filter(p => p.id !== player.id && p.state !== null)
            .map(p => p.remoteState!);

        send(player.conn, [
            T.MessageType.INIT,
            {
                protocolVersion: T.PROTOCOL_VERSION,
                self: player.state!,
                others: otherPlayers,
                grid: T.compressGrid(GRID.cellGrid),
            },
        ]);

        this.broadcastPlayerUpdate(player, true);

        return player;
    }

    disconnect(player: Player) {
        this.#byId.delete(player.id);
        this.#byWs.delete(player.conn);
        player.conn.close();
        player.state = null;
        this.broadcastPlayerUpdate(player, true);
        console.log('[%d force disconnect]', player.id);
        player.dispose();
    }

    broadcastPlayerUpdate(subject: Player, excludeSelf: boolean = false) {
        let state = subject.remoteState;
        if (!state) return;
        const msg: T.UpdatePlayerMessage = {
            id: subject.id,
            state,
        };
        for (let [ws, player] of this.#byWs.entries()) {
            if (player === subject) {
                if (excludeSelf) continue;
                assert(player.state !== null);
                const ownMsg: T.UpdatePlayerMessage = {
                    id: player.id,
                    state: player.state,
                };
                send(ws, [T.MessageType.UPDATE_PLAYER, ownMsg]);
            } else {
                send(ws, [T.MessageType.UPDATE_PLAYER, msg]);
            }
        }
    }

    broadcastGridUpdate(diff: T.CellGrid) {
        for (let ws of this.#byWs.keys()) {
            const msg: T.UpdateGridMessage = {
                gridDiff: T.compressGrid(diff),
            };
            send(ws, [T.MessageType.UPDATE_GRID, msg]);
        }
    }
}

export const PLAYERS = new Players();
