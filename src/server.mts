import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';

import { networkInterfaces } from 'node:os';

import * as common from './common.mjs';

import { wake } from 'wake_on_lan';

import ping_pkg from 'ping';
import { HostConfig, HostState } from './common.mjs';
import assert from 'node:assert';
const { promise: ping_promise } = ping_pkg;

const wss = new WebSocketServer({
  port: common.SERVER_PORT,
});

class HostsConfig implements common.HostsConfig {
  hosts: common.HostConfig[];
  constructor(hosts: HostConfig[]) {
    this.hosts = hosts;
  }
}

function wol(mac_address: string) {
  const address = broadcast_addr;
  console.log(`Sending WOL packet to ${mac_address} (${address})`);
  // address: string | undefined = '255.255.255.255'
  wake(mac_address, { address: address });
  console.log('done');
}

const pingData: Map<
  string,
  {
    // Get this from process.hrtime()
    start_time: [number, number];
    stop_requested: boolean;
  }
> = new Map();

function stop_ping(ws: WebSocket, host: HostConfig, state: HostState) {
  const pd = pingData.get(host.mac_addr);
  if (pd) {
    pd.stop_requested = true;
  }
  sendMessage(ws, {
    kind: 'EndPing',
    data: { host, state },
  });
}
// TODO: make this dynamic
const broadcast_addr: string = '192.168.2.255';

async function ping_once(host: HostConfig) {
  if (!host.ip_addr) {
    return undefined;
  }
  return await ping_promise.probe(host.ip_addr);
}

function ping(ws: WebSocket, host: HostConfig) {
  if (!pingData.has(host.mac_addr)) {
    pingData.set(host.mac_addr, {
      start_time: process.hrtime(),
      stop_requested: false,
    });
  }
  tell_status(host, ws);
  const ip_addr = host.ip_addr;

  if (!ip_addr) {
    stop_ping(ws, host, undefined);
    return;
  }

  const pd = pingData.get(host.mac_addr);
  assert(pd);
  if (pd.stop_requested) {
    pingData.delete(host.mac_addr);
    return;
  }

  ping_once(host)
    .then((response) => {
      // pinged = (randomInt(5) > 3) || response.alive;
      // console.log('h:', host.ip_addr, 'r\n', response)
      const pinged = response?.alive ? 'OK' : 'KO';
      console.log(`Pinging ${ip_addr}: ${pinged}`);
      if (response?.alive) {
        stop_ping(ws, host, 'on');
      } else {
        setTimeout(() => {
          ping(ws, host);
        }, 1000);
      }
    })
    .catch((e: unknown) => {
      console.log('error pinging once:', e);
    });
}

function tell_status(host: HostConfig, ws: WebSocket) {
  // if (!pingData.start_time) pingData.start_time = process.hrtime();
  const pd = pingData.get(host.mac_addr);

  assert(pd);

  const dt = process.hrtime(pd.start_time);
  sendMessage(ws, {
    kind: 'WaitingFor',
    data: { host, time: dt[0] + 1e-9 * dt[1] },
  });
}

function sendMessage(ws: WebSocket, msg: common.ToClientMessage) {
  ws.send(JSON.stringify(msg));
}

async function manage_msg_server(ws: WebSocket, msg: common.ToServerMessage) {
  console.log('received message of kind', msg.kind);
  switch (msg.kind) {
    case 'WOL':
      {
        wol(msg.data);
        assert(hosts_config !== undefined);
        const host = hosts_config.hosts.find((h) => h.mac_addr === msg.data);
        assert(
          host !== undefined,
          `host for MAC addr ${msg.data} not existing`
        );
        ping(ws, host);
      }
      return;
    case 'Hello':
      console.log('Client says hello! text:', msg.data);
      return;
    case 'GetStatus':
      {
        const host = hosts_config?.hosts.find((h) => h.mac_addr === msg.data);
        assert(host);
        tell_status(host, ws);
      }
      return;
    case 'StopPing':
      stop_ping(ws, msg.data.host, undefined);
      return;
    case 'AddHost':
      add_host(msg.data.host);
      wss.clients.forEach((client: WebSocket) => {
        refresh_hosts(client).catch((e: unknown) => {
          console.log('error:', e);
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 500)).then(
        async () => {
          await ping_all_hosts(Array.from(wss.clients));
        }
      );
      return;
    case 'UpdateHost':
      {
        update_host(msg.data);
        wss.clients.forEach((client: WebSocket) => {
          refresh_hosts(client).catch((e: unknown) => {
            console.log('error refresh_hosts:', e);
          });
        });
        await new Promise((resolve) => setTimeout(resolve, 500)).then(
          async () => {
            await ping_all_hosts(Array.from(wss.clients));
          }
        );
      }
      return;
    case 'RemoveHost':
      remove_host(msg.data.host.mac_addr);

      wss.clients.forEach((client: WebSocket) => {
        refresh_hosts(client).catch((e: unknown) => {
          console.log('error refresh_hosts:', e);
        });
      });
      return;
    case 'GetHosts':
      if (!hosts_config) await get_hosts();
      assert(hosts_config, 'hosts_config is null');
      sendMessage(ws, {
        kind: 'RefreshHosts',
        data: { hosts: hosts_config.hosts },
      });
      break;
    default:
      common.assertUnreachable(msg);
  }
}

wss.on('connection', (ws: WebSocket, req) => {
  console.log(
    'client connected: ',
    req.socket.localAddress,
    req.socket.remoteAddress
  );

  sendMessage(ws, {
    kind: 'Hello',
    data: 'LOOL',
  });

  ws.addEventListener('message', (event) => {
    let obj: undefined | common.Message;

    try {
      assert('data' in event && typeof event.data === 'string');
      const parsed: unknown = JSON.parse(event.data);
      assert(common.isToServerMessage(parsed));
      obj = parsed;
    } catch {
      console.log('GOT INVALID MESSAGE (not json)', obj);
      return;
    }

    if (!common.isToServerMessage(obj)) {
      console.log('GOT INVALID MESSAGE (not correct message struct)', obj);
      return;
    }
    manage_msg_server(ws, obj).catch((e: unknown) => {
      console.log('error pinging once:', e);
    });
  });

  ws.addEventListener('close', () => {
    console.log(
      'client disconnected: ',
      // req.socket.localAddress, // undefined on disconnect (?)
      req.socket.remoteAddress
    );
    if (wss.clients.size == 0) {
      // If no clients are connected anymore, stop the ping process
      pingData.forEach((pd) => {
        pd.stop_requested = true;
      });
    }
  });

  refresh_hosts(ws)
    .then(() => new Promise((resolve) => setTimeout(resolve, 500)))
    .then(async () => {
      await ping_all_hosts([ws]).catch((e: unknown) => {
        console.log('error pinging once:', e);
      });
    })
    .catch((e: unknown) => {
      console.log('error refreshing hosts on connect:', e);
    });
});

async function ping_all_hosts(wss: WebSocket[]) {
  if (!hosts_config) return [];
  // assert(hosts_config)
  const pingpromises = hosts_config.hosts.map(async (h) =>
    ping_once(h)
      // assert(hosts_config)
      // const h = hosts_config.hosts[i]
      .then((r) => {
        wss.forEach((ws) => {
          // console.log('h:', h.ip_addr, 'r\n', r)
          sendMessage(ws, {
            kind: 'EndPing',
            data: {
              host: h,
              state: r?.host === undefined ? 'error' : r.alive ? 'on' : 'off',
            },
          });
        });
      })
  );
  const resps = await Promise.all(pingpromises);
  // if (wss){
  //   resps.forEach((r,i)=> {
  //     assert(hosts_config)
  //     const h = hosts_config.hosts[i]
  //     wss.forEach( ws => {
  //       console.log('h:', h.ip_addr, 'r\n', r)
  //       sendMessage(ws, {
  //         kind: 'EndPing',
  //         data: {alive:r.alive, host: h}
  //       })
  //     })
  //   })
  // }
  return resps;
}

async function refresh_hosts(ws: WebSocket) {
  await get_hosts();
  if (hosts_config !== undefined) {
    console.log('Sending refresh hosts');
    sendMessage(ws, {
      kind: 'RefreshHosts',
      data: {
        hosts: hosts_config.hosts,
      },
    });
  } else console.log("Don't have hosts file yet");
}

const interfaces = networkInterfaces();
// Skip loopback interface
const non_lo_interface = Object.keys(interfaces).filter((k) => k !== 'lo');

const this_interface = non_lo_interface
  .flatMap(
    (intf) =>
      interfaces[intf]?.find((i) => i.family === 'IPv4' && !i.internal)?.address
  )
  .filter((add) => !!add);

this_interface.forEach((address) => {
  if (!address) return;
  console.log(`Listening on ws://${address}:${common.SERVER_PORT.toString()}`);
});

function add_host(host: HostConfig) {
  hosts_config?.hosts.push(host);
  save_hosts_config();
}
function update_host(opts: { host: HostConfig; newHost: HostConfig }) {
  const { host, newHost } = opts;
  assert(hosts_config, 'Host config should be defined!');
  const hi = hosts_config.hosts.findIndex((h) => h.mac_addr === host.mac_addr);
  assert(hi >= 0, `Cannot find host with mac address "${host.mac_addr}"`);
  assert(
    hosts_config.hosts[hi],
    `Host with mac address "${host.mac_addr}" not found in local config`
  );
  hosts_config.hosts[hi] = newHost;
  save_hosts_config();
}

function remove_host(mac_addr: string) {
  assert(hosts_config);
  console.log('removing host', mac_addr);
  hosts_config.hosts = hosts_config.hosts.filter(
    (h) => h.mac_addr !== mac_addr
  );
  save_hosts_config();
}

const HOSTS_FILE = 'hosts.json';
let hosts_config: HostsConfig | undefined;

function save_hosts_config() {
  // pretty print
  writeFileSync(HOSTS_FILE, JSON.stringify(hosts_config, null, 2));
  // Standard json print
  // writeFileSync(HOSTS_FILE, JSON.stringify(hosts_config))
}

async function get_hosts() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const file = await readFile(HOSTS_FILE).catch((_err: unknown) => {
    assert(hosts_config === undefined);
    hosts_config = new HostsConfig([]);

    console.log(`Creating \`${HOSTS_FILE}\` config file`);
    save_hosts_config();
    return JSON.stringify(hosts_config);
  });
  const payload: unknown = JSON.parse(String(file));

  hosts_config = payload as HostsConfig;

  assert(hosts_config);
  // if (hosts_config.hosts.every(h => h.name === undefined))
  //  {
  //    for (let hi = 0; hi <  hosts_config.hosts.length; hi++) {
  //       const host = hosts_config.hosts[hi];
  //       host.name = ""
  //       hosts_config.hosts[hi] = host;
  //   }
  //   save_hosts_config()
  // }
}
