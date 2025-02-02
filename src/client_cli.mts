import fs, { appendFileSync } from 'fs';
import fsa from 'fs/promises';
import { appendFile } from 'fs/promises';
import { exit } from 'process';

import * as common from './common.mjs';
import { HostConfig as HostConfigCommon, HostState } from './common.mjs';
import assert from 'assert';

import { AsyncQueue } from './async_queue.mjs';

const SERVER_WS_PORT = 6970;

// const DEFAULT_HEIGHT = 10;
// const DEFAULT_WIDTH = 80;

interface HostConfig extends HostConfigCommon {
  state?: HostState;
}

interface SceneData {
  currentHosts: HostConfig[];
  newHosts: HostConfig[];
  line_offset: number;
  curr_line?: number | undefined;
  menu_window: 'main_window' | 'editing';
}

const LOG_FILENAME = 'log.txt';
const LOG_FILENAME_OLD = 'log.old.txt';

// Signals to catch for which to call the terminator
const TERM_SIGNALS = [
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGILL',
  'SIGTRAP',
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGUSR1',
  'SIGSEGV',
  'SIGUSR2',
  'SIGTERM',
] as const;

function sendMessage(ws: WebSocket, msg: common.ToServerMessage) {
  ws.send(JSON.stringify(msg));
}

function send_wol(ws: WebSocket, mac_addr: string) {
  console.log('sending wol package');
  sendMessage(ws, { kind: 'WOL', data: mac_addr });
}

function get_log_msg(
  ...msgs: (string | number | object | undefined | unknown)[]
): string {
  const msg = `[${process.uptime().toFixed(5)}] ${msgs
    .map((m) => {
      if (!m) return String(m);
      if (typeof m == 'string' || m instanceof String) {
        return m;
      }
      if (typeof m == 'object') return JSON.stringify(m, undefined, 2);
      if (m instanceof Object) return JSON.stringify(m, undefined, 2);

      return String(m);
    })
    .join(' ')}\n`;

  return msg;
}

const log = async (
  ...msgs: (string | number | object | undefined | unknown)[]
) => {
  const msg = get_log_msg(...msgs);
  await appendFile(LOG_FILENAME, msg);
};

const logSync = (
  ...msgs: (string | number | object | undefined | unknown)[]
) => {
  const msg = get_log_msg(...msgs);
  appendFileSync(LOG_FILENAME, msg);
};

async function write_header(sceneData: SceneData, header: string) {
  // console.log('\u001b[2J');
  await asyncc((cb) => process.stdout.cursorTo(0, 0, cb));
  await asyncc((cb) => process.stdout.clearScreenDown(cb));
  // await asyncc((cb) => process.stdout.clearLine(1, cb));
  await asyncc((cb) => process.stdout.write(header, cb));
  sceneData.line_offset = header.split('\n').length;
}

type KeyType = {
  [key in NonNullable<HostState>]: string;
} & { undefined: string };

const HOST_STATUS_CHAR: KeyType = {
  on: 'UP ',
  off: 'OFF',
  starting: '^^^',
  error: 'ERR',
  undefined: '---',
};

function host_to_str(
  sceneData: SceneData,
  host: HostConfig | undefined,
  idx: number
) {
  if (!host) {
    return '???????????????????????????????????????\n';
  }
  const stat = HOST_STATUS_CHAR[host.state || 'undefined'];
  const mac = host.mac_addr.padStart(17); // length of 17
  const ip = (host.ip_addr || '--').padEnd(15);
  const name = host.name || '--';
  // const line_sel_start = (sceneData.curr_line !== undefined && sceneData.curr_line === idx) ? '->' : '  '
  const line_sel_start =
    sceneData.curr_line !== undefined && sceneData.curr_line === idx
      ? '\x1b[7m'
      : '';
  const line_sel_end =
    sceneData.curr_line !== undefined && sceneData.curr_line === idx
      ? '\x1b[0m'
      : '';

  // if (new_host_line) {
  //   return ` ${line_sel_start} [ + ] | ${mac} | ${ip} | ${name}${line_sel_end}\n`;
  // }
  return ` ${line_sel_start} [${stat}] | ${mac} | ${ip} | ${name}${line_sel_end}\n`;
}

/**
 *  Used to convert a function with a callback to an async one.
 * @example await asyncc((cb) => process.stdout.cursorTo(0, 0, cb));
 * @example await asyncc((cb) => process.stdout.clearScreenDown(cb));
 * */
function asyncc(method: (callback?: (x?: Error) => void) => void) {
  return new Promise((resolve: (x?: Error) => void) => {
    method(resolve);
  });
}

async function refresh_hosts(
  ws: WebSocket,
  sceneData: SceneData,
  // newHosts: HostConfigCommon[],
  overwrite_mac: string | undefined
) {
  const curr_hosts = sceneData.currentHosts;
  const new_hosts = sceneData.newHosts;

  const curr_l = curr_hosts.length;

  // + 1 for the last entry empty, to add an host
  const new_l_total = new_hosts.length;
  const delta_l = curr_l - new_l_total;
  const line_offset = sceneData.line_offset;

  // await log('[refresh_hosts] lo:', line_offset, 'om:', overwrite_mac);
  if (!overwrite_mac) {
    if (line_offset == 0) {
      console.log('\u001b[2J');
      await asyncc((cb) => process.stdout.cursorTo(0, 0, cb));
    } else {
      await asyncc((cb) => process.stdout.cursorTo(0, line_offset, cb));
      await asyncc((cb) => process.stdout.clearScreenDown(cb));
    }
  } else await asyncc((cb) => process.stdout.cursorTo(0, line_offset, cb));

  // await asyncc((cb) =>
  //   process.stdout.write(
  //     host_to_str(sceneData, { mac_addr: '---', state: undefined }, 0, true),
  //     cb
  //   )
  // );

  for (let i = 0; i < curr_l && i < new_hosts.length; i++) {
    const host = new_hosts[i];
    if (overwrite_mac) {
      if (overwrite_mac !== host.mac_addr) {
        await asyncc((cb) => process.stdout.moveCursor(0, 1, cb));
        continue;
      }
    }
    await asyncc((cb) =>
      process.stdout.write(
        host_to_str(sceneData, host, i),
        // host_to_str(sceneData, host, i + 1, i >= new_hosts.length),
        cb
      )
    );
    sceneData.currentHosts[i] = {
      ...host,
    };
  }

  if (delta_l < 0) {
    // less hosts on html
    for (let i = 0; i < -delta_l; i++) {
      // console.log('i:',i)
      // console.log(hosts);
      const host = new_hosts[curr_l + i];
      // console.log('host', host);
      // const new_node = host_config_to_htmlnode(host, ws, i >= -dl - 1);
      await asyncc((cb) =>
        // process.stdout.write(host_to_str(sceneData, host, i + 1, false), cb)
        process.stdout.write(host_to_str(sceneData, host, i), cb)
      );

      sceneData.currentHosts.push(host);
    }
  } else {
    for (let i = delta_l; i > 0; i--) {
      // let c_t_remove = curr_hosts[hl_total + i - 2];
      sceneData.currentHosts.splice(new_l_total + i - 2, 1);
    }
  }
  await log('finished refreshing hosts');
}

async function redraw_hosts(sceneData: SceneData) {
  // const height = process.stdout.rows || DEFAULT_HEIGHT;
  // const width = process.stdout.columns || DEFAULT_WIDTH;

  const out = process.stdout;
  assert(out, 'process.stdout was null!');

  const hosts = sceneData.currentHosts;

  // await log('lineOffset:', sceneData.line_offset);
  if (sceneData.line_offset == 0) {
    console.log('\u001b[2J');
    await asyncc((cb) => process.stdout.cursorTo(0, 0, cb));
  } else {
    await asyncc((cb) => process.stdout.cursorTo(0, sceneData.line_offset, cb));
    await asyncc((cb) => process.stdout.clearScreenDown(cb));
  }

  // await asyncc((cb) => {
  //   process.stdout.write(
  //     host_to_str(sceneData, { mac_addr: '---' }, 0, true),
  //     cb
  //   );
  // });
  for (const { h, i } of hosts.map((h, i) => ({ h, i }))) {
    await asyncc((cb) => {
      // process.stdout.write(host_to_str(sceneData, h, i + 1, false), cb);
      process.stdout.write(host_to_str(sceneData, h, i), cb);
    });
  }
}

function common_hosts_to_client(
  commonHosts: HostConfigCommon[],
  current_hosts: HostConfig[]
) {
  return commonHosts.map((chost: HostConfigCommon): HostConfig => {
    const existingHost = current_hosts.find(
      (c_h) => c_h.mac_addr === chost.mac_addr
    );
    return {
      ...chost,
      state: existingHost?.state,
    };
  });
}
async function manage_msg_client(
  ws: WebSocket,
  msg: common.ToClientMessage,
  sceneData: SceneData
) {
  logSync('received message of kind', msg.kind);

  switch (msg.kind) {
    case 'Hello':
      logSync('Server says hello! text:', msg.data);
      return;
    case 'EndPing':
      {
        // logSync(msg.data.host, sceneData);
        const hostidx = sceneData.newHosts.findIndex(
          (h) => h.mac_addr === msg.data.host.mac_addr
        );
        if (hostidx < 0) {
          await log('cannot find host for mac address', msg.data.host.mac_addr);
          return;
          console.error('no host for waiting mac addr');
          throw Error('host for waiting for not existing');
        }
        sceneData.newHosts[hostidx].state = msg.data.state;
        await refresh_hosts(ws, sceneData, msg.data.host.mac_addr);
      }
      return;
    case 'WaitingFor':
      {
        const hostidx = sceneData.newHosts.findIndex(
          (h) => h.mac_addr === msg.data.host.mac_addr
        );
        if (hostidx < 0) {
          await log('cannot find host for mac address', msg.data.host.mac_addr);
          return;
          console.error('no host for waiting mac addr');
          throw Error('host for waiting for not existing');
        }
        sceneData.newHosts[hostidx].state = 'starting';
        await refresh_hosts(ws, sceneData, msg.data.host.mac_addr);
      }
      return;

    case 'RefreshHosts':
      await log('going to call refresh hosts');
      sceneData.newHosts = common_hosts_to_client(
        msg.data.hosts,
        sceneData.currentHosts
      );
      await refresh_hosts(ws, sceneData, undefined);
      return;
    default:
      //   common.assertUnreachable(msg);
      break;
  }
}

type Action =
  | 'up'
  | 'down'
  | 'right'
  | 'left'
  | 'esc'
  | 'close'
  | 'enter'
  // | 'ping'
  | 'wake';

const data_ret_map: { [key: string]: Action | undefined } = {
  '\u0003': 'close', // CTRL-C
  '\u0004': 'close', // CTRL-D

  '\u001b': 'esc', // Esc

  '\r': 'enter',

  '\u001b[A': 'up',
  k: 'up',
  '\u001b[B': 'down',
  j: 'down',
  '\u001b[C': 'right',
  '\u001b[D': 'left',

  // p: 'ping',
  // P: 'ping',
  w: 'wake',
  W: 'wake',
};

function on_data(
  ws: WebSocket,
  data: Buffer,
  sceneData: SceneData,
  queue: AsyncQueue
) {
  const mapped = data_ret_map[data.toString('utf-8')];

  switch (mapped) {
    case 'close':
      logSync('emitting close');
      process.kill(process.pid, 'SIGINT');
      break;
    case 'down':
      if (sceneData.curr_line === undefined) {
        sceneData.curr_line = -1;
      }
      if (sceneData.curr_line < sceneData.currentHosts.length - 1)
        sceneData.curr_line = sceneData.curr_line + 1;

      queue.push(redraw_hosts(sceneData));
      break;

    case 'up':
      if (sceneData.curr_line === undefined) {
        sceneData.curr_line = 0;
      }
      if (sceneData.curr_line > 0)
        sceneData.curr_line = sceneData.curr_line - 1;

      queue.push(redraw_hosts(sceneData));
      break;

    case 'enter':
      // TODO: enter edit menu
      // break;
      throw Error('Not implemented');
    case 'esc':
      // TODO: redraw only corresponding line
      sceneData.curr_line = undefined;
      queue.push(redraw_hosts(sceneData));
      break;
    case 'wake':
      if (!sceneData.curr_line) return;
      send_wol(ws, sceneData.currentHosts[sceneData.curr_line].mac_addr);
      break;
    default:
      // log("EOL!", EOL);
      if (mapped)
        logSync(
          'not implemented code:',
          JSON.stringify(data.toString('utf-8')),
          'Action:',
          mapped.toString()
        );
      else logSync('unknown code:', JSON.stringify(data.toString('utf-8')));
  }
}

(async () => {
  process.stdin.resume(); // so the program will not close instantly

  if (fs.existsSync(LOG_FILENAME)) {
    await fsa.copyFile(LOG_FILENAME, LOG_FILENAME_OLD);
    await fsa.rm(LOG_FILENAME);
  }

  const queue = new AsyncQueue();

  const queuePromise = queue.run().catch((e: unknown) => {
    console.log('ERROR RUNNING QUEUE', e);
  });

  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf-8');

  // Hide cursor
  queue.push(
    asyncc((cb) => {
      process.stdout.write('\u001b[?25l', cb);
    })
  );

  let ws: WebSocket;

  try {
    ws = new WebSocket(`ws://127.0.0.1:${SERVER_WS_PORT.toString()}`);
  } catch (e) {
    const msg = 'Error opening websocket';
    logSync(msg, e);
    process.stderr.write(msg + String(e));
    exit(1);
  }

  const sceneData: SceneData = {
    currentHosts: [],
    newHosts: [],
    curr_line: undefined,
    line_offset: 0,
    menu_window: 'main_window',
  };

  queue.push(
    write_header(
      sceneData,
      [
        'Hosts: Press ',
        // ' [Enter] to edit',
        // ' [N] for new',
        ' [{up,k}/{down,j}] select host',
        ' [W] send WOL',
        // ' [Del] to delete',
      ].join('\n')
    )
  );

  ws.addEventListener('message', (event) => {
    let obj: undefined | common.ToClientMessage;

    try {
      assert('data' in event && typeof event.data === 'string');
      const parsed: unknown = JSON.parse(event.data);
      assert(common.isToClientMessage(parsed));
      obj = parsed;
    } catch {
      queue.push(log('GOT INVALID MESSAGE (not json): ', obj));
      return;
    }

    if (!common.isToClientMessage(obj)) {
      queue.push(log('GOT INVALID MESSAGE (not correct message struct)', obj));
      return;
    }

    queue.push(manage_msg_client(ws, obj, sceneData));
  });

  ws.addEventListener('close', (event) => {
    logSync('got ws close event', event);
    queue.push(
      asyncc((cb) => {
        process.stdout.write('Server Disconnected!', cb);
      })
    );
    process.kill(process.pid, 'SIGINT');
  });

  ws.addEventListener('error', (event) => {
    logSync('got ws error event', event);
    queue.push(
      asyncc((cb) => {
        process.stdout.write('\nWebsocket error!', cb);
      })
    );
    process.kill(process.pid, 'SIGINT');
  });

  // catching signals and do something before exit
  TERM_SIGNALS.forEach(function (sig) {
    // Ignore no awaited promise here, since it is known that for some tasks
    //  the async tasks will not be guaranteed to be finished, but hey,
    //  it's js afterall
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on(sig, terminator);
  });

  async function terminator(evtOrExitCodeOrError: number | string | Error) {
    logSync('terminator with event:', evtOrExitCodeOrError);

    try {
      // Signal to the queue to stop
      queue.stop();
      // Restore cursor
      process.stdout.write('\u001b[?25h');
      // await async code here
      await queuePromise;
      // Optionally: Handle evtOrExitCodeOrError here
    } catch (e) {
      console.error('EXIT HANDLER ERROR', e);
      logSync('EXIT HANDLER ERROR', e);
    }

    process.exit(isNaN(+evtOrExitCodeOrError) ? 1 : +evtOrExitCodeOrError);
  }

  // Exit event.
  // Cannot handle async code in here, it is best to rely on signals
  process.on('exit', (code) => {
    logSync('Process exit event with code:', code);
  });

  // Handle keyboard input
  process.stdin.on('data', (buff) => {
    on_data(ws, buff, sceneData, queue);
  });

  queue.push(log('Client initialized'));
})().catch(logSync);
