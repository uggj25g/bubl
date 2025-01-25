//#region Scaffolding

export type ProtocolVersion = 2;
export const PROTOCOL_VERSION = 2 as ProtocolVersion;

export enum MessageType {
    INIT = "INIT",
    UPDATE = "UPDATE",

    MOVE = "MOVE",
}
export type ServerMessageType = MessageType.INIT | MessageType.UPDATE;
export type ClientMessageType = MessageType.MOVE;

export function isValidClientMessageType(val: any): val is ClientMessageType {
    return (typeof val === "string") && val === MessageType.MOVE;
}

export type ServerMessage =
    [MessageType.INIT, InitMessage]
    | [MessageType.UPDATE, UpdateMessage];

export type ClientMessage =
    [MessageType.MOVE, MoveMessage];

//#endregion

//#region Messages

export type InitMessage = {
    protocolVersion: ProtocolVersion,
    self: PlayerState,
    others: Array<PlayerState>,
    grid: CellGrid,
}
export type UpdateMessage = {
    players: Array<PlayerState>,

    /// contains only changes since previous update message, not the full grid
    gridDiff: CellGrid,
}
export type MoveMessage = {
    location: CubeLocation,
}

//#endregion

//#region Data types

/// guaranteed to be a 53-bit safe integer
export type Integer = number;

export type CubeLocation = `${Integer},${Integer},${Integer}`;
export const cube = (q: Integer, r: Integer, s: Integer): CubeLocation =>
    `${q},${r},${s}`;
export const cube_eq = (a: CubeLocation, b: CubeLocation) => a === b;

export type PlayerState = {
    id: Integer,
    color: Integer,
    location: CubeLocation,
}

export enum CellState {
    /// Cell is unoccupied.
    ///
    /// Such cells are not sent in client/server protocol (except when a cell
    /// ends up in this state due to decay) and, for most intents and purposes,
    /// can be removed from memory.
    BLANK = "blank",

    /// Cell is part of a player's live trail.
    TRAIL = "trail",

    /// Cell has been occupied by a team.
    FILLED = "filled",
}

export type CellCommon = {
    // location: CubeLocation, // implicit based on containing structure
    state: CellState,
};
export type CellBlank = CellCommon & { state: CellState.BLANK };
export type CellTrail = CellCommon & {
    state: CellState.TRAIL,

    color: Integer,

    /// floating point between 1 and 0 – starts out at 1 and goes to 0 as it decays
    age: number,

    ownerPlayer: Integer,
};
export type CellFilled = CellCommon & {
    state: CellState.FILLED,

    color: Integer,

    /// floating point between 1 and 0 – starts out at 1 and goes to 0 as it decays
    age: number,
}

export type Cell = CellBlank | CellTrail | CellFilled;

// TODO more efficient organized representation (map by coordinate?)
export type CellGrid = Record<CubeLocation, Cell>;

//#endregion
