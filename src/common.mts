

export const SERVER_PORT = 6970;

const commonMessageKinds = [
    'Hello',   
] as const;

const toServerOnlyMessageKinds = [
    'WOL',
    'GetStatus',
] as const;

const toClientOnlyMessageKinds = [
    // 'StartPing',
    // 'EndPing', // ahead
    // 'WaitingFor',
] as const;

const toServerOtherMessageKinds = [
  'AddHost',
  'UpdateHost',
  'StopPing',
  'RemoveHost',
] as const;


export interface HostConfig {
    mac_addr: string,
    ip_addr?: string | undefined,
    name?: string;
  }

export type HostState = 'off' | 'on' | 'starting' | 'error' | undefined

export interface HostsConfig {
  hosts: HostConfig[]
}

type ToServerMessageOthers = {
  kind: 'AddHost';
  data: { host:HostConfig}
} |
{
  kind: 'UpdateHost';
  data:  { newHost: HostConfig,  host: HostConfig};
} |
{
  kind: 'StopPing';
  data: { host: HostConfig}
} |
{
  kind: 'RemoveHost';
  data: { host: HostConfig}
}

// assertion fails if not synced
assertNever<IfEquals<(typeof toServerOtherMessageKinds)[number],ToServerMessageOthers['kind'],never,unknown>>()

const toClientOtherMessageKinds = [
  'WaitingFor',
  'EndPing',
  'RefreshHosts',
] as const;

type ToClientMessageOthers =  
{
  kind: 'WaitingFor';
  data:  { host: HostConfig; time: number };
} |
{
  kind: 'EndPing';
  data:  { host: HostConfig; state: HostState };
} |
{
  kind: 'RefreshHosts';
  data:  { hosts: HostConfig[] };
}

assertNever<IfEquals<(typeof toClientOtherMessageKinds)[number], ToClientMessageOthers['kind'], never, unknown>>()

function isToServerOthersMessage(arg: any): arg is ToServerMessageOthers{
  if (typeof arg !== 'object' || arg === null) {
    return false; // Not an object or is null
  }

  // Check for the 'kind' property
  if (typeof arg.kind !== 'string') {
    return false; // 'kind' is not a string
  }

  if (!('data' in arg)){
    console.log('no data in object')
    return false;
  }

  const k = arg.kind as ToServerMessageOthers['kind'];

  
  if (typeof arg.data !== 'object')
  {
    console.log('arg.data is no object')
    // arg.data is an object in this cases.
    return false;
  }
  
  switch (k){
    case 'UpdateHost':
      if (!('newHost' in arg.data))
      {
        console.log('no newHost')
        return false;
      }
      if (!!arg.newHost)
      {
        console.log('no newHost data')
        return false
      }
    case 'AddHost':
    case 'StopPing':
    case 'RemoveHost':
      if (!('host' in arg.data))
      {
        console.log('no host')
        return false;
      }
      if (!!arg.host)
      {
        console.log('no host data')
        return false
      }
      return true;
    default:
      // Try-catch because this is used only at compile time to check for
      //  swict-case exaustiveness
      try{assertUnreachable(k)}
      catch{}
      return false;
  }
}

function isToClientOthersMessage(arg: any): arg is ToClientMessageOthers{
  if (typeof arg !== 'object' || arg === null) {
    return false; // Not an object or is null
  }
  // Check for the 'kind' property
  if (typeof arg.kind !== 'string') {
    return false; // 'kind' is not a string
  }
  if (!('data' in arg))
    return false;

  const k = arg.kind as ToClientMessageOthers['kind'];
  
  if (typeof arg.data !== 'object')
    // arg.data is an object in this cases.
    return false;

  switch (k){
    case 'WaitingFor':
      if (!('time' in arg.data)) return false;
      if (typeof arg.data.time !== 'number')  return false;
      return true;
    case 'RefreshHosts':
      if (!('hosts' in arg.data))
      {
        console.log('no hosts')
        return false;
      }
      
      if (!Array.isArray(arg.data.hosts))
      {
        // console.log('no array');
        return false;
      }
      return true;
    case 'EndPing':
      if (!('host' in arg.data))
      {
        console.log('no host')
        return false;
      }
      if (typeof arg.data !== 'object')
      {
        console.log('no object');
        return false;
      }
      return true;
    default:
      // Try-catch because this is used only at compile time to check for
      //  swict-case exaustiveness
      try{assertUnreachable(k)}
      catch{}
      return false;
  }
}

const toClientMessageKinds = [...commonMessageKinds,...toClientOnlyMessageKinds] as const;
const toServerMessageKinds = [...commonMessageKinds,...toServerOnlyMessageKinds] as const;
const messageKinds = [...toClientMessageKinds, ...toServerMessageKinds] as const;
type CommonMessageKindBase = (typeof commonMessageKinds)[number];
type ToServerMessageKindBase = (typeof toServerMessageKinds)[number];
type ToClientMessageKindBase = (typeof toClientMessageKinds)[number];
export type ToClientMessageKind = ToClientMessageKindBase | ToClientMessageOthers['kind']
export type ToServerMessageKind = ToServerMessageKindBase | ToServerMessageOthers['kind']
export type MessageKind = typeof messageKinds[number];

interface ToServerMessageBase {
    kind: ToServerMessageKindBase,
    data: string
}

type ToClientMessageBase = {
  kind: ToClientMessageKindBase
  data: string
}

export type ToServerMessage = ToServerMessageBase | ToServerMessageOthers
export type ToClientMessage = ToClientMessageBase | ToClientMessageOthers

export interface Message {
  kind: ToServerMessageBase | ToClientMessageKindBase | CommonMessageKindBase;
  data: string;
}


// export function isMessageKind(arg: any): arg is MessageKind {
//   return arg && arg && messageKinds.includes(arg);
// }
export function isToServerMessageKindBase(arg: any): arg is ToServerMessageKindBase {
  return arg && toServerMessageKinds.includes(arg);
}
export function isToClientMessageKindBase(arg: any): arg is ToClientMessageKindBase {
  return arg && toClientMessageKinds.includes(arg);
}

// TODO: check for extended messages
export function isAnyMessageBase(arg: any): arg is ToServerMessageBase | ToClientMessageBase {
  return (
    arg &&
    arg.kind &&
    // arg.data &&
    (isToServerMessageKindBase(arg.kind) || isToClientMessageKindBase(arg.kind))
    // (typeof arg.data === "string" || arg.data instanceof String)
  );
}

export function isAnyMessage(arg: any): arg is ToServerMessage | ToClientMessage{
  return isAnyMessageBase(arg) || isToClientOthersMessage(arg) || isToServerOthersMessage(arg)
}

export function isToClientMessage(arg: any): arg is ToClientMessageBase {
    return isAnyMessage(arg) && (
      isToClientMessageKindBase(arg.kind)
      ||
      isToClientOthersMessage(arg)
    )
}

export function isToServerMessage(arg: any): arg is ToServerMessageBase {
    // console.log('isAnyMessage', isAnyMessage(arg));
    // console.log('isToServerMessageKind', isToServerMessageKindBase(arg.kind));
  return isAnyMessage(arg) && (
    isToServerMessageKindBase(arg.kind) 
    ||
    isToServerOthersMessage(arg)
  )
}

// Used for static asserts
export function assertUnreachable(x:never):never {
    throw new Error("Should not be here")
}

type IfEquals<T, U, Y=unknown, N=never> =
  (<G>() => G extends T ? 1 : 2) extends
  (<G>() => G extends U ? 1 : 2) ? Y : N;
  
export function assertNever<T extends never>() {}

// export function assertEqual<T1, T2>(){
//   type confront = IfEquals<T1, T2, 'never', 'b'>
//   assertNever<confront>()
// }

// assertNever<IfEquals<(typeof toServerOtherMessageKinds)[number],ToServerMessageOthers['kind'],never,unknown>>()

// type a1 = ToServerMessageOthers['kind'];
// type a2 = 'AddHost' | 'B';
// const arr = ['AddHost', 'B'] as const
// type b = (typeof arr)[number];

// type same1 = IfEquals<a1,b,never,unknown>
// type same2 = IfEquals<a2,b,never,unknown>

// assert<same1>()
// assert<same2>()

// type TypeEqualityGuard<A,B> = Exclude<A,B> | Exclude<B,A>;

// assert<TypeEqualityGuard<a1,b>>(); // returns an error
// assert<TypeEqualityGuard<a2,b>>(); // no error

