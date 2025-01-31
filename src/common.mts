export const SERVER_PORT = 6970;

const commonMessageKinds = ['Hello'] as const;

const toServerOnlyMessageKinds = ['WOL', 'GetStatus', 'GetHosts'] as const;

const toClientOnlyMessageKinds = [
  // 'StartPing',
  // 'EndPing', // ahead
  // 'WaitingFor',
] as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toServerOtherMessageKinds = [
  'AddHost',
  'UpdateHost',
  'StopPing',
  'RemoveHost',
] as const;

export interface HostConfig {
  mac_addr: string;
  ip_addr?: string | undefined;
  name?: string;
}

export type HostState = 'off' | 'on' | 'starting' | 'error' | undefined;

export interface HostsConfig {
  hosts: HostConfig[];
}

type ToServerMessageOthers =
  | {
      kind: 'AddHost';
      data: { host: HostConfig };
    }
  | {
      kind: 'UpdateHost';
      data: { newHost: HostConfig; host: HostConfig };
    }
  | {
      kind: 'StopPing';
      data: { host: HostConfig };
    }
  | {
      kind: 'RemoveHost';
      data: { host: HostConfig };
    };

// assertion fails if not synced
assertNever<
  IfEquals<
    (typeof toServerOtherMessageKinds)[number],
    ToServerMessageOthers['kind'],
    never,
    unknown
  >
>();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toClientOtherMessageKinds = [
  'WaitingFor',
  'EndPing',
  'RefreshHosts',
] as const;

type ToClientMessageOthers =
  | {
      kind: 'WaitingFor';
      data: { host: HostConfig; time: number };
    }
  | {
      kind: 'EndPing';
      data: { host: HostConfig; state: HostState };
    }
  | {
      kind: 'RefreshHosts';
      data: { hosts: HostConfig[] };
    };

assertNever<
  IfEquals<
    (typeof toClientOtherMessageKinds)[number],
    ToClientMessageOthers['kind'],
    never,
    unknown
  >
>();

function isToServerOthersMessage(arg: unknown): arg is ToServerMessageOthers {
  if (typeof arg !== 'object' || arg === null) {
    return false; // Not an object or is null
  }

  // Check for the 'kind' property
  if (!('kind' in arg)) {
    return false; // 'kind' is not present
  }

  if (typeof arg.kind !== 'string') {
    return false; // 'kind' is not a string
  }

  if (!('data' in arg)) {
    console.log('no data in object');
    return false;
  }

  const k = arg.kind as ToServerMessageOthers['kind'];

  if (typeof arg.data !== 'object') {
    console.log('arg.data is no object');
    // arg.data is an object in this cases.
    return false;
  }

  if (arg.data === null) {
    console.log('arg.data is null');
    // arg.data is an object in this cases.
    return false;
  }

  switch (k) {
    case 'UpdateHost':
      // Needs .data.newHost
      if (!('newHost' in arg.data)) {
        console.log('no newHost');
        return false;
      }
      if (arg.data.newHost) {
        console.log('no newHost data');
        return false;
      }
    // We want to check for the rest as well, so fall through
    // eslint-disable-next-line no-fallthrough
    case 'AddHost':
    case 'StopPing':
    case 'RemoveHost':
      // Needs .data.host
      if (!('host' in arg.data)) {
        console.log('no host');
        return false;
      }
      if (!arg.data.host) {
        console.log('no host data');
        return false;
      }
      return true;
    default:
      // Try-catch because this is used only at compile time to check for
      //  swict-case exaustiveness
      try {
        assertUnreachable(k);
      } catch {
        /* empty */
      }
      return false;
  }
}

function isToClientOthersMessage(arg: unknown): arg is ToClientMessageOthers {
  if (typeof arg !== 'object' || arg === null) {
    return false; // Not an object or is null
  }
  // Check for the 'kind' property
  if (!('kind' in arg)) {
    return false; // 'kind' is not present
  }

  if (typeof arg.kind !== 'string') {
    return false; // 'kind' is not a string
  }
  if (!('data' in arg) || arg.data === null) return false;

  const k = arg.kind as ToClientMessageOthers['kind'];

  if (typeof arg.data !== 'object')
    // arg.data is an object in this cases.
    return false;

  switch (k) {
    case 'WaitingFor':
      if (!('time' in arg.data)) return false;
      if (typeof arg.data.time !== 'number') return false;
      return true;
    case 'RefreshHosts':
      if (!('hosts' in arg.data)) {
        console.log('no hosts');
        return false;
      }

      if (!Array.isArray(arg.data.hosts)) {
        // console.log('no array');
        return false;
      }
      return true;
    case 'EndPing':
      if (!('host' in arg.data)) {
        console.log('no host');
        return false;
      }
      if (typeof arg.data !== 'object') {
        console.log('no object');
        return false;
      }
      return true;
    default:
      // Try-catch because this is used only at compile time to check for
      //  swict-case exaustiveness
      try {
        assertUnreachable(k);
      } catch {
        /* empty */
      }
      return false;
  }
}

const toClientMessageKinds = [
  ...commonMessageKinds,
  ...toClientOnlyMessageKinds,
] as const;
const toServerMessageKinds = [
  ...commonMessageKinds,
  ...toServerOnlyMessageKinds,
] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const messageKinds = [
  ...toClientMessageKinds,
  ...toServerMessageKinds,
] as const;
// type CommonMessageKindBase = (typeof commonMessageKinds)[number];
type ToServerMessageKindBase = (typeof toServerMessageKinds)[number];
type ToClientMessageKindBase = (typeof toClientMessageKinds)[number];
export type ToClientMessageKind =
  | ToClientMessageKindBase
  | ToClientMessageOthers['kind'];
export type ToServerMessageKind =
  | ToServerMessageKindBase
  | ToServerMessageOthers['kind'];
export type MessageKind = (typeof messageKinds)[number];

interface ToServerMessageBase {
  kind: ToServerMessageKindBase;
  data: string;
}

type ToClientMessageBase = {
  kind: ToClientMessageKindBase;
  data: string;
};

export type ToServerMessage = ToServerMessageBase | ToServerMessageOthers;
export type ToClientMessage = ToClientMessageBase | ToClientMessageOthers;

export interface Message {
  kind: ToServerMessageKindBase | ToClientMessageKindBase;
  data: string;
}

// export function isMessageKind(arg: any): arg is MessageKind {
//   return arg && arg && messageKinds.includes(arg);
// }
export function isToServerMessageKindBase(
  arg: unknown
): arg is ToServerMessageKindBase {
  return !!arg && toServerMessageKinds.includes(arg as ToServerMessageKindBase);
}
export function isToClientMessageKindBase(
  arg: unknown
): arg is ToClientMessageKindBase {
  return !!arg && toClientMessageKinds.includes(arg as ToClientMessageKindBase);
}

// TODO: check for extended messages
export function isAnyMessageBase(
  arg: unknown
): arg is ToServerMessageBase | ToClientMessageBase {
  return (
    !!arg &&
    typeof arg === 'object' &&
    'kind' in arg &&
    !!arg.kind &&
    (isToServerMessageKindBase(arg.kind) || isToClientMessageKindBase(arg.kind))
  );
}

export function isAnyMessage(
  arg: unknown
): arg is ToServerMessage | ToClientMessage {
  return (
    isAnyMessageBase(arg) ||
    isToClientOthersMessage(arg) ||
    isToServerOthersMessage(arg)
  );
}

export function isToClientMessage(arg: unknown): arg is ToClientMessageBase {
  return (
    isAnyMessage(arg) &&
    (isToClientMessageKindBase(arg.kind) || isToClientOthersMessage(arg))
  );
}

export function isToServerMessage(arg: unknown): arg is ToServerMessageBase {
  // console.log('isAnyMessage', isAnyMessage(arg));
  // console.log('isToServerMessageKind', isToServerMessageKindBase(arg.kind));
  return (
    isAnyMessage(arg) &&
    (isToServerMessageKindBase(arg.kind) || isToServerOthersMessage(arg))
  );
}

// Used for static asserts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertUnreachable(_x: never): never {
  throw new Error('Should not be here');
}

type IfEquals<T, U, Y = unknown, N = never> = (() => unknown extends T
  ? 1
  : 2) extends () => unknown extends U ? 1 : 2
  ? Y
  : N;

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unnecessary-type-parameters
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
