//#region Scaffolding

export type ProtocolVersion = 4;
export const PROTOCOL_VERSION = 4 as ProtocolVersion;

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
    self: SelfPlayerState,
    others: Array<RemotePlayerState>,
    grid: CompressedCellGrid,
}
export type UpdateMessage = {
    self: SelfPlayerState
    others: Array<RemotePlayerState>,

    /// contains only changes since previous update message, not the full grid
    gridDiff: CompressedCellGrid,
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

export type PlayerID = Integer;
export type RemotePlayerState = {
    id: PlayerID,
    color: Integer,
    location: CubeLocation,
};
export type SelfPlayerState = RemotePlayerState & {
    energy: Integer,
};

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

export type CellGrid = Record<CubeLocation, Cell>;

//#endregion

//#region Compressed grid

export enum CompressedCellState {
    BLANK = 0,
    TRAIL = 1,
    FILLED = 2,
}

export type CompressedCell = [
    coords: CubeLocation,
    state: CompressedCellState,
    color?: Integer,
    /// 0...255
    age?: Integer,
    ownerPlayer?: Integer,
];
export type CompressedCellGrid = Array<CompressedCell>;

export function compressGrid(grid: CellGrid): CompressedCellGrid {
    let re = [] as Array<CompressedCell>;

    for (let [locationKey, cell] of Object.entries(grid)) {
        let location = locationKey as CubeLocation;
        switch (cell.state) {
        case CellState.BLANK: {
            re.push([location, CompressedCellState.BLANK]);
            break;
        }
        case CellState.TRAIL: {
            re.push([
                location,
                CompressedCellState.TRAIL,
                cell.color,
                (cell.age * 255) | 0,
                cell.ownerPlayer,
            ]);
            break;
        }
        case CellState.FILLED: {
            re.push([
                location,
                CompressedCellState.FILLED,
                cell.color,
                (cell.age * 255) | 0,
            ]);
            break;
        }
        }
    }

    return re;
}

export function decompressGrid(grid: CompressedCellGrid): CellGrid {
    let re = Object.create(null) as CellGrid;

    for (let cell of grid) {
        const location = cell[0];
        switch (cell[1]) {
        case CompressedCellState.BLANK: {
            let reCell: CellBlank = { state: CellState.BLANK };
            re[location] = reCell;
            break;
        }

        case CompressedCellState.TRAIL: {
            let reCell: CellTrail = {
                state: CellState.TRAIL,
                color: cell[2]!,
                age: cell[3]! / 255,
                ownerPlayer: cell[4]!,
            };
            re[location] = reCell;
            break;
        }

        case CompressedCellState.FILLED: {
            let reCell: CellFilled = {
                state: CellState.FILLED,
                color: cell[2]!,
                age: cell[3]! / 255,
            };
            re[location] = reCell;
            break;
        }
        }
    }

    return re;
}

//#endregion
