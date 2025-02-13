import { type WebSocket } from 'ws';
import * as T from '../../types';

import GRID from './grid';
import { send } from './index';
import { choose, ANIMALS, assert, debug_log } from './util';

const INITIAL_PLAYER_TRAIL_LENGTH = 6;
const MAX_COLORS = 2;

const CELLS_TO_SCORE = (cells: number): number => 4 + (cells - 4) ** 2;

// TODO: logarithmic?
const CELLS_TO_ENERGY = (cells: number): number => cells;

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

    increaseEnergy(amount: number) {
        assert(this.state !== null);
        this.state!.energy += amount;
        this.sendState();
    }

    sendState() {
        const ownMsg: T.UpdatePlayerMessage = {
            id: this.id,
            state: this.state,
        };
        send(this.conn, [T.MessageType.UPDATE_PLAYER, ownMsg]);
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
        debug_log('[%d msg] %o', this.id, msg);
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
            debug_log('[%d msg] change color DENIED: movement already happened', this.id);
            PLAYERS.disconnect(this);
            return;
        }
        if (msg.color >= MAX_COLORS) {
            debug_log('[%d msg] change color DENIED: color %d out of bounds', this.id, msg.color);
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
            debug_log('[grid] update', diff);
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

    getById(id: T.PlayerID): Player | undefined {
        return this.#byId.get(id);
    }

    spawn(conn: WebSocket): Player {
        let id = this.#id();
        let state: T.SelfPlayerState = {
            id: id,
            name: choose(ANIMALS),
            color: this.#nextColor, // TODO[paulsn] assign random
            location: GRID.outsideLocation(),
            energy: INITIAL_PLAYER_TRAIL_LENGTH,
        };
        this.#nextColor = (this.#nextColor + 1) % MAX_COLORS;

        let player = new Player(conn, state);
        this.#byWs.set(conn, player);
        this.#byId.set(id, player);

        debug_log('[%d connect]', id);

        conn.once('close', () => {
            this.disconnect(player, true);
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
                teams: TEAMS.state,
            },
        ]);

        this.broadcastPlayerUpdate(player, true);

        return player;
    }

    disconnect(player: Player, graceful: boolean = false) {
        this.#byId.delete(player.id);
        this.#byWs.delete(player.conn);
        if ( ! graceful) {
            player.conn.close();
        }
        player.state = null;
        GRID.clearOwnedTrail(player.id, player.decayTrail);
        this.broadcastPlayerUpdate(player, true);
        debug_log('[%d %sdisconnect]', player.id, graceful ? '' : 'force ');
        player.dispose();
    }

    broadcastPlayerUpdate(subject: Player, excludeSelf: boolean = false) {
        let state = subject.remoteState;
        const msg: T.UpdatePlayerMessage = {
            id: subject.id,
            state,
        };
        for (let [ws, player] of this.#byWs.entries()) {
            if (player === subject) {
                if (excludeSelf) continue;
                player.sendState();
            } else {
                send(ws, [T.MessageType.UPDATE_PLAYER, msg]);
            }
        }
    }

    broadcastGridUpdate(diff: T.CellGrid) {
        const msg: T.UpdateGridMessage = {
            gridDiff: T.compressGrid(diff),
        };
        for (let ws of this.#byWs.keys()) {
            send(ws, [T.MessageType.UPDATE_GRID, msg]);
        }
    }

    broadcastGridEvent(ev: T.GridEventMessage) {
        for (let ws of this.#byWs.keys()) {
            send(ws, [T.MessageType.GRID_EVENT, ev]);
        }
    }

    broadcastTeamUpdate(teams: T.TeamState[]) {
        const msg: T.UpdateTeamsMessage = { teams };
        for (let ws of this.#byWs.keys()) {
            send(ws, [T.MessageType.UPDATE_TEAMS, msg]);
        }
    }
}

export const PLAYERS = new Players();

class Teams {
    scores: Map<T.Color, T.Integer>;
    dirty: Set<T.Color>;

    constructor() {
        this.scores = new Map();
        this.dirty = new Set();
    }

    get state(): T.TeamState[] {
        return Array.from(this.scores).map(([color, score]) => ({ color, score }));
    }

    getScore(team: T.Color) {
        return this.scores.get(team) ?? 0;
    }
    addScore(team: T.Color, amount: T.Integer) {
        this.scores.set(team, this.getScore(team) + amount);
        this.dirty.add(team);
    }

    startTick(_tick: number) {
        //
    }
    endTick(_tick: number) {
        if (this.dirty.size) {
            let teams = [] as T.TeamState[];
            for (let color of this.dirty.values()) {
                teams.push({ color, score: this.getScore(color) });
            }
            PLAYERS.broadcastTeamUpdate(teams);
            this.dirty.clear();
        }
    }

    applyFillScore(team: T.Color, playerContributions: Record<T.PlayerID, T.Integer>) {
        let totalCells = 0;
        for (let [idKey, cells] of Object.entries(playerContributions)) {
            let id = Number(idKey) as T.Integer;
            if (id === 0) continue;
            totalCells += cells;

            let player = PLAYERS.getById(id);
            if (player) {
                player.increaseEnergy(CELLS_TO_ENERGY(cells));
            }
        }

        let score = CELLS_TO_SCORE(totalCells);
        this.addScore(team, score);
        return score;
    }
}

export const TEAMS = new Teams();
