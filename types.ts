export type ProtocolVersion = 0;
export const PROTOCOL_VERSION = 0 as ProtocolVersion;

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

// TODO[paulsn] replace with cube coordinates eventually, for now just any arbitrary state
export type PlayerLocation = any;

export type ServerMessage =
    [MessageType.INIT, InitMessage]
    | [MessageType.UPDATE, UpdateMessage];

export type ClientMessage =
    [MessageType.MOVE, MoveMessage];

export type InitMessage = {
    protocolVersion: 0,
    self: PlayerState,
    others: Array<PlayerState>,
}
export type UpdateMessage = {
    players: Array<PlayerState>,
}
export type MoveMessage = {
    location: PlayerLocation,
}

export type PlayerState = {
    id: number,
    location: PlayerLocation,
}
