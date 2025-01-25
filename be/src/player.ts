import { type WebSocket } from 'ws';
import * as T from '../../types';

import GRID from './grid';
import { send } from './index';

const PLAYER_TRAIL_LENGTH = 3;

export class Player {
    id: T.PlayerID;
    conn: WebSocket;
    state: T.SelfPlayerState;
    decayTrail: Set<T.CubeLocation>;

    constructor(conn: WebSocket, state: T.SelfPlayerState) {
        this.conn = conn;
        this.state = state;
        this.id = state.id;
        this.decayTrail = new Set();

        this.handleMessageBase = this.handleMessageBase.bind(this);
        this.conn.on('message', this.handleMessageBase);
    }
    dispose() {
        this.conn.removeListener('message', this.handleMessageBase);
    }

    get remoteState(): T.RemotePlayerState {
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
        }
    }
    handleMove(msg: T.MoveMessage) {
        const { location } = msg;
        this.state.location = location;

        GRID.decayTrail(this.id, this.decayTrail);
        GRID.setTrail(
            location,
            this.state.color,
            this.id,
            this.state.energy,
        );
        this.decayTrail.add(location);

        PLAYERS.broadcastPlayerUpdate();
    }
}

class Players {
    #byWs: Map<WebSocket, Player>;
    #byId: Map<T.PlayerID, Player>;

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
        } while (this.#byId.has(id));
        return id;
    }

    spawn(conn: WebSocket): Player {
        let id = this.#id();
        let state: T.SelfPlayerState = {
            id: id,
            color: 0, // TODO[paulsn] assign random
            location: '0,0,0', // TODO[paulsn] assign random
            energy: PLAYER_TRAIL_LENGTH, // TODO[paulsn] do not hardcode
        };

        let player = new Player(conn, state);
        this.#byWs.set(conn, player);
        this.#byId.set(id, player);

        console.log('[%d connect]', id);

        conn.once('close', () => {
            this.#byWs.delete(conn);
            this.#byId.delete(id);
            this.broadcastPlayerUpdate();
            console.log('[%d disconnect]', id);
            player.dispose();
        });

        let otherPlayers = Array.from(this.#byId.values())
            .filter(p => p.id !== player.id)
            .map(p => p.remoteState);

        send(player.conn, [
            T.MessageType.INIT,
            {
                protocolVersion: T.PROTOCOL_VERSION,
                self: player.state,
                others: otherPlayers,
                grid: T.compressGrid(GRID.cellGrid),
            },
        ]);

        this.broadcastPlayerUpdate(new Set([player]));

        return player;
    }

    broadcastPlayerUpdate(except?: Set<Player>) {
        except ??= new Set();

        for (let [ws, player] of this.#byWs.entries()) {
            if (except.has(player)) continue;
            const msg: T.UpdateMessage = {
                self: player.state,
                others: Array.from(this.#byId.values())
                    .filter(p => p.id !== player.id)
                    .map(p => p.remoteState),
                gridDiff: [],
            }
            send(ws, [T.MessageType.UPDATE, msg]);
        }
    }

    broadcastGridUpdate(diff: T.CellGrid) {
        for (let [ws, player] of this.#byWs.entries()) {
            const msg: T.UpdateMessage = {
                self: player.state,
                others: Array.from(this.#byId.values())
                    .filter(p => p.id !== player.id)
                    .map(p => p.remoteState),
                gridDiff: T.compressGrid(diff),
            };
            send(ws, [T.MessageType.UPDATE, msg]);
        }
    }
}

export const PLAYERS = new Players();
