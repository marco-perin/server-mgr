export const SERVER_PORT = 6970;
const commonMessageKinds = [
    'Hello',
];
const toServerOnlyMessageKinds = [
    'WOL',
    'GetStatus',
    'StopPing'
];
const toClientOnlyMessageKinds = [
    'StartPing',
    'EndPing',
    'WaitingFor'
];
const toClientMessageKinds = [...commonMessageKinds, ...toClientOnlyMessageKinds];
const toServerMessageKinds = [...commonMessageKinds, ...toServerOnlyMessageKinds];
const messageKinds = [...toClientMessageKinds, ...toServerMessageKinds];
export function isToServerMessageKind(arg) {
    return arg && toServerMessageKinds.includes(arg);
}
export function isToClientMessageKind(arg) {
    return arg && toClientMessageKinds.includes(arg);
}
export function isAnyMessage(arg) {
    return (arg &&
        arg.kind &&
        (isToServerMessageKind(arg.kind) || isToClientMessageKind(arg.kind)));
}
export function isToClientMessage(arg) {
    return isAnyMessage(arg) && isToClientMessageKind(arg.kind);
}
export function isToServerMessage(arg) {
    console.log('isAnyMessage', isAnyMessage(arg));
    console.log('isToServerMessageKind', isToServerMessageKind(arg.kind));
    return isAnyMessage(arg) && isToServerMessageKind(arg.kind);
}
export function assertUnreachable(x) {
    throw new Error("Should not be here");
}
//# sourceMappingURL=common.mjs.map