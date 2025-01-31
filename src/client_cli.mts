import fs, { appendFileSync } from 'fs';
import fsa from 'fs/promises';
import { appendFile } from 'fs/promises';
import { exit } from 'process';

import * as common from './common.mjs';
import { HostConfig as HostConfigCommon, HostState } from './common.mjs';
import assert from 'assert';

import WaitQueue from 'wait-queue';

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
  idx: number,
  new_host_line: boolean
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

  if (new_host_line) {
    return ` ${line_sel_start} [ + ] | ${mac} | ${ip} | ${name}${line_sel_end}\n`;
  }
  return ` ${line_sel_start} [${stat}] | ${mac} | ${ip} | ${name}${line_sel_end}\n`;
}

function asyncc(method: (callback?: (x?: unknown) => void) => void) {
  return new Promise((resolve) => {
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
        host_to_str(sceneData, host, i, i >= new_hosts.length),
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
        process.stdout.write(host_to_str(sceneData, host, i, false), cb)
      );

      sceneData.currentHosts.push(host);
    }
  } else {
    for (let i = delta_l; i > 0; i--) {
      // let c_t_remove = curr_hosts[hl_total + i - 2];
      sceneData.currentHosts.splice(new_l_total + i - 2, 1);
    }
  }
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
      process.stdout.write(host_to_str(sceneData, h, i, false), cb);
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
        // end_ping(sceneData, msg.data.alive);
        const hostidx = sceneData.currentHosts.findIndex(
          (h) => h.mac_addr === msg.data.host.mac_addr
        );
        if (hostidx < 0) {
          await log('cannot find host for mac address', msg.data.host.mac_addr);
          return;
          console.error('no host for waiting mac addr');
          throw Error('host for waiting for not existing');
        }
        sceneData.currentHosts[hostidx].state = msg.data.state;
        await refresh_hosts(ws, sceneData, msg.data.host.mac_addr);
      }
      return;
    // return;
    // case 'WaitingFor':
    //   const hostidx = sceneData.hosts.findIndex(h => h.mac_addr === msg.data.host.mac_addr)
    //   if(hostidx < 0){
    //     console.error("no host for waiting mac addr")
    //     throw Error("host for waiting for not existing")
    //   }
    //   sceneData.hosts[hostidx].state = 'starting'
    //   refresh_hosts(ws, sceneData, msg.data.host.mac_addr)
    //   return;

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

type Action = 'up' | 'down' | 'right' | 'left' | 'esc' | 'close' | 'enter';

const data_ret_map: { [key: string]: Action | undefined } = {
  '\u0003': 'close', // CTRL-C
  '\u0004': 'close', // CTRL-D

  '\u0027': 'esc', // Esc

  '\r': 'enter',

  '\u001b[A': 'up',
  '\u001b[B': 'down',
  '\u001b[C': 'right',
  '\u001b[D': 'left',
};

async function runQueue(queue: WaitQueue<Promise<unknown>>) {
  await queue.pop();
  await runQueue(queue);
}

function on_data(
  data: Buffer,
  sceneData: SceneData,
  queue: WaitQueue<Promise<unknown>>
) {
  const mapped = data_ret_map[data.toString('utf-8')];

  switch (mapped) {
    case 'close':
      logSync('emitting close');
      process.exit();
      break;
    case 'down':
      if (sceneData.curr_line === undefined) {
        sceneData.curr_line = 0;
      }
      if (sceneData.curr_line < sceneData.currentHosts.length - 1)
        sceneData.curr_line = sceneData.curr_line + 1;
      // sceneData.curr_line = sceneData.curr_line + 1;

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
      // log('enter!');
      break;
    default:
      // log("EOL!", EOL);
      logSync('unknown code:', JSON.stringify(data.toString('utf-8')));
  }
}

async function cleanup() {
  await asyncc((cb) => process.stdout.write('\u001b[?25h', cb));
}

(async () => {
  process.stdin.resume(); // so the program will not close instantly

  if (fs.existsSync(LOG_FILENAME)) {
    await fsa.copyFile(LOG_FILENAME, LOG_FILENAME_OLD);
    await fsa.rm(LOG_FILENAME);
  }

  const queue = new WaitQueue<Promise<unknown>>();

  const queuePromise = runQueue(queue).catch((e: unknown) => {
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
    curr_line: 0,
    line_offset: 0,
    menu_window: 'main_window',
  };
  queue.push(
    write_header(
      sceneData,
      'Host List:'
      // [
      //   'Hosts: Press ',
      //   ' [Enter] to edit',
      //   ' [N] for new',
      //   ' [P] to ping',
      //   ' [Del] to delete',
      // ].join('\n')
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
      queue.push(log('GOT INVALID MESSAGE (not json)', obj));
      return;
    }

    if (!common.isToClientMessage(obj)) {
      queue.push(log('GOT INVALID MESSAGE (not correct message struct)', obj));
      return;
    }

    queue.push(manage_msg_client(ws, obj, sceneData));
  });

  ws.addEventListener('close', (event) => {
    logSync('got close event', event);
  });

  ws.addEventListener('error', (event) => {
    logSync('got error event', event);
  });

  // [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach((eventType) => {
  //   process.on(eventType, cleanup.bind(null, eventType));
  // })

  process.on('beforeExit', (code) => {
    console.log('Process beforeExit event with code: ', code);
    logSync('Process beforeExit event with code: ', code);
  });

  process.on('exit', (code) => {
    logSync('Process exit event with code:', code);
  });

  process.stdin.on('data', (buff) => {
    on_data(buff, sceneData, queue);
  });

  queue.push(log('Client initialized'));
})().catch(logSync);
