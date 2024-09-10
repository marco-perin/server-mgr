

export const SERVER_PORT = 6970;

const commonMessageKinds = [
    'Hello',   
] as const;

const toServerOnlyMessageKinds = [
    'WOL',
    'GetStatus',
    'StopPing'
] as const;

const toClientOnlyMessageKinds = [
    'StartPing',
    'EndPing',
    'WaitingFor'
] as const;

const toClientMessageKinds = [...commonMessageKinds,...toClientOnlyMessageKinds] as const;
const toServerMessageKinds = [...commonMessageKinds,...toServerOnlyMessageKinds] as const;
const messageKinds = [...toClientMessageKinds,...toServerMessageKinds] as const;
 
export type CommonMessageKind = (typeof commonMessageKinds)[number];
export type ToServerMessageKind = (typeof toServerMessageKinds)[number];
export type ToClientMessageKind = (typeof toClientMessageKinds)[number];
export type MessageKind = typeof messageKinds[number];

export interface ToServerMessage {
    kind: ToServerMessageKind | CommonMessageKind,
    data: string
}

export interface ToClientMessage {
  kind: ToClientMessageKind | CommonMessageKind;
  data: string;
}

export interface Message {
  kind: ToServerMessage | ToClientMessageKind | CommonMessageKind;
  data: string;
}


// export function isMessageKind(arg: any): arg is MessageKind {
//   return arg && arg && messageKinds.includes(arg);
// }
export function isToServerMessageKind(arg: any): arg is ToServerMessageKind {
  return arg && toServerMessageKinds.includes(arg);
}
export function isToClientMessageKind(arg: any): arg is ToClientMessageKind {
  return arg && toClientMessageKinds.includes(arg);
}

export function isAnyMessage(arg: any): arg is ToServerMessage | ToClientMessage {
  return (
    arg &&
    arg.kind &&
    // arg.data &&
    (isToServerMessageKind(arg.kind) || isToClientMessageKind(arg.kind))
    // (typeof arg.data === "string" || arg.data instanceof String)
  );
}

export function isToClientMessage(arg: any): arg is ToClientMessage{
    return isAnyMessage(arg) && isToClientMessageKind(arg.kind)
}
export function isToServerMessage(arg: any): arg is ToServerMessage {
    console.log('isAnyMessage', isAnyMessage(arg));
    console.log('isToServerMessageKind', isToServerMessageKind(arg.kind));
  return isAnyMessage(arg) && isToServerMessageKind(arg.kind);
}

// Used for static asserts
export function assertUnreachable(x:never):never {
    throw new Error("Should not be here")
}