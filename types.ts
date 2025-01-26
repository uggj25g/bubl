//#region Scaffolding

export type ProtocolVersion = 10;
export const PROTOCOL_VERSION = 10 as ProtocolVersion;

export enum MessageType {
    INIT = "INIT",
    UPDATE_GRID = "UPDATE_GRID",
    UPDATE_PLAYER = "UPDATE_PLAYER",
    GRID_EVENT = "GRID_EVENT",
    UPDATE_TEAMS = "UPDATE_TEAMS",

    MOVE = "MOVE",
    RENAME = "RENAME",
    CHANGE_COLOR = "CHANGE_COLOR",
}
export type ServerMessageType =
    MessageType.INIT
    | MessageType.UPDATE_GRID
    | MessageType.UPDATE_PLAYER
    | MessageType.GRID_EVENT
    | MessageType.UPDATE_TEAMS;
export type ClientMessageType =
    MessageType.MOVE
    | MessageType.RENAME
    | MessageType.CHANGE_COLOR;

export function isValidClientMessageType(val: any): val is ClientMessageType {
    return (typeof val === "string") && (
        val === MessageType.MOVE
        || val === MessageType.RENAME
        || val === MessageType.CHANGE_COLOR
    );
}

export type ServerMessage =
    [MessageType.INIT, InitMessage]
    | [MessageType.UPDATE_GRID, UpdateGridMessage]
    | [MessageType.UPDATE_PLAYER, UpdatePlayerMessage]
    | [MessageType.GRID_EVENT, GridEventMessage]
    | [MessageType.UPDATE_TEAMS, UpdateTeamsMessage];

export type ClientMessage =
    [MessageType.MOVE, MoveMessage]
    | [MessageType.RENAME, RenameMessage]
    | [MessageType.CHANGE_COLOR, ChangeColorMessage];

//#endregion

//#region Messages

export type InitMessage = {
    protocolVersion: ProtocolVersion,
    self: SelfPlayerState,
    others: Array<RemotePlayerState>,
    grid: CompressedCellGrid,
    teams: TeamState[],
}
export type UpdatePlayerMessage = {
    id: PlayerID;
    state: SelfPlayerState | RemotePlayerState | null;
}
export type UpdateGridMessage = {
    /// contains only changes since previous update message, not the full grid
    gridDiff: CompressedCellGrid,
}
export type GridEventMessage = {
    type: GridEventType,
    location: CubeLocation,
    affectedLocations: CubeLocation[],

    /// present only for FILL events
    team?: Color,
    teamScore?: Integer,
}
export type UpdateTeamsMessage = {
    teams: TeamState[],
}

export type MoveMessage = {
    location: CubeLocation,
}
export type RenameMessage = {
    name: string,
}
/// Valid only before movement started
export type ChangeColorMessage = {
    color: Color,
}

//#endregion

//#region Data types

/// guaranteed to be a 53-bit safe integer
export type Integer = number;

export type CubeLocation = `${Integer},${Integer},${Integer}`;
export const cube = (q: Integer, r: Integer, s: Integer): CubeLocation =>
    `${q},${r},${s}`;
export const cube_eq = (a: CubeLocation, b: CubeLocation) => a === b;

export type Color = Integer;

export type PlayerID = Integer;
export type RemotePlayerState = {
    id: PlayerID,
    name: string,
    color: Color,
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

    color: Color,

    /// floating point between 1 and 0 – starts out at 1 and goes to 0 as it decays
    age: number,

    ownerPlayer: Integer,
    decaysIntoFilled: boolean,
};
export type CellFilled = CellCommon & {
    state: CellState.FILLED,

    color: Color,

    /// floating point between 1 and 0 – starts out at 1 and goes to 0 as it decays
    age: number,
}

export type Cell = CellBlank | CellTrail | CellFilled;

export type CellGrid = Record<CubeLocation, Cell>;

export enum GridEventType {
    FILL = "FILL",
    ANNIHILATE = "ANNIHILATE",
}

export type TeamState = {
    color: Integer,
    score: Integer,
}

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
    color?: Color,
    /// 0...255
    age?: Integer,
    ownerPlayer?: Integer,
    decaysIntoFilled?: 0 | 1,
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
                cell.decaysIntoFilled ? 1 : 0,
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
                decaysIntoFilled: cell[5]! === 1,
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
