
import {writeFileSync, readFileSync, read} from 'node:fs'
import { readFile } from 'node:fs/promises';
import {WebSocketServer, WebSocket} from 'ws';

import { networkInterfaces }from 'node:os'

import * as common from './common.mjs'

import {wake} from 'wake_on_lan'

import ping_pkg from 'ping'
import { HostConfig } from './common.mjs';
import assert from 'node:assert';
const {promise: ping_promise} = ping_pkg

const wss = new WebSocketServer({
  port: common.SERVER_PORT,
});

class HostsConfig implements common.HostsConfig{
  hosts: common.HostConfig[];
  constructor(hosts: HostConfig[]){
    this.hosts = hosts
  }
}

function wol(mac_address: string){
  const address = broadcast_addr;
  console.log(`Sending WOL packet to ${mac_address} (${address})`)
  // address: string | undefined = '255.255.255.255'
  wake(mac_address, {address: address})
  console.log("done")
}
const pingData: { start_time: [seconds:number, nseconds:number] | undefined } = {
  start_time: undefined,
};

function stop_ping(ws: WebSocket, host: HostConfig, alive: boolean | undefined) {
  // TODO: Actually stop pinging
  // clearInterval(intervalID)
  sendMessage(ws, {
    kind: "EndPing",
    data: {host, alive},
  });
}

const broadcast_addr: string = '192.168.2.255'

async function ping_once(host:HostConfig){
  assert(host.ip_addr)
  return await ping_promise.probe(host.ip_addr)
}
function ping(ws: WebSocket, host: HostConfig){
    tell_status(host, ws)
    const ip_addr = host.ip_addr;

    if (!ip_addr){
      stop_ping(ws, host, undefined)
    }
    else
      ping_once(host).then(response => {
        // pinged = (randomInt(5) > 3) || response.alive;
        console.log('h:', host.ip_addr, 'r\n', response)
        const pinged = response.alive;
        console.log(`Pinging ${ip_addr}: ${pinged}`)
        if (pinged){
            // awake = true;
            stop_ping(ws, host, pinged)
        }
        else {
            setTimeout(()=>{ ping(ws, host)}, 1000);
        }
      });
}

function tell_status(host: HostConfig,ws: WebSocket){
    if (!pingData.start_time) pingData.start_time = process.hrtime();
    const dt = process.hrtime(pingData.start_time);
    sendMessage(ws, {
      kind: "WaitingFor",
      data: { host, time: dt[0]}
    });

}

function sendMessage(ws: WebSocket, msg: common.ToClientMessage){
    ws.send(JSON.stringify(msg));
}
async function manage_msg_server(ws: WebSocket, msg: common.ToServerMessage){
    console.log('received message of kind',msg.kind);
    switch (msg.kind) {
        case "WOL":
        {
          wol(msg.data);
          assert(hosts_config !== undefined)
          const host = hosts_config?.hosts.find(h => h.mac_addr === msg.data)
          assert(host !== undefined, `host for MAC addr ${msg.data} not existing`)
          ping(ws, host);
        }
        return;
        case 'Hello':
          console.log('Client says hello! text:', msg.data)
          return
        case 'GetStatus':
        {
          const host = hosts_config?.hosts.find(h=>h.mac_addr === msg.data)
          assert(host)
          tell_status(host,ws)
        }
        return;
        case 'StopPing':
          stop_ping(ws, msg.data.host, undefined);
          return;
        case 'AddHost':
          // throw Error('Not Implemented');
          add_host(msg.data.host)
          wss.clients.forEach((client: WebSocket) => {
            refresh_hosts(client)
          });
          await ping_all_hosts(Array.from(wss.clients))
          return;
        case 'RemoveHost':
          remove_host(msg.data.host.mac_addr)
          
          wss.clients.forEach((client: WebSocket) => {
            refresh_hosts(client)
          });
          return;
        default:
            common.assertUnreachable(msg);
    }
}

wss.on('connection',(ws: WebSocket) => {
	console.log('client connected!');
  
    
    sendMessage(ws, {
       kind: 'Hello',
       data: 'LOOL' 
    })
    
    ws.addEventListener('message', (event) => {
        let obj: undefined | common.Message;

        try {
          obj = JSON.parse(String(event.data));
        } catch {
          console.log("GOT INVALID MESSAGE (not json)", obj);
          return;
        }

        if (!common.isToServerMessage(obj)) {
          console.log("GOT INVALID MESSAGE (not correct message struct)", obj);
          return;
        }
        manage_msg_server(ws, obj)
    })

    ws.addEventListener('close', (event)=>{
      console.log('client disconnected')
    })
    
    refresh_hosts(ws).then(_=> ping_all_hosts([ws]))
});

async function ping_all_hosts(wss: WebSocket[]){
  if(!hosts_config) return []
  // assert(hosts_config)
  const pingpromises = hosts_config.hosts.map(async h => ping_once(h)
      // assert(hosts_config)
      // const h = hosts_config.hosts[i]
      .then( r=> {
      wss.forEach( ws => {
        // console.log('h:', h.ip_addr, 'r\n', r)
        sendMessage(ws, {
          kind: 'EndPing',
          data: {
            host: h,
            alive: r.host === undefined ? undefined : r.alive,
          }
        })
      })
    })
  )
  const resps = await Promise.all(pingpromises)
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
  return resps
}

function refresh_hosts(ws: WebSocket){
  return get_hosts().then( _=>{
      if (hosts_config !== undefined)
        sendMessage(ws,{
          kind: 'RefreshHosts',
          data: {
            hosts: hosts_config.hosts
          }
        })
      else
      console.log("Don't have hosts file yet")
    })
}

const interfaces = networkInterfaces()
// Skip loopback interface
const non_lo_interface = Object.keys(interfaces).filter(k => k !== 'lo')

const this_interface = non_lo_interface.flatMap(
  intf => interfaces[intf]?.
      find(i => i.family === 'IPv4' && i.internal == false)?.address)
      .filter(add => !!add)

this_interface.forEach(address => {
  console.log(`Listening on ws://${address}:${common.SERVER_PORT}`);
});

function add_host(host: HostConfig){
  hosts_config?.hosts.push(host)
  save_hosts_config()
}

function remove_host(mac_addr: string){
  assert(hosts_config)
  console.log('removing host', mac_addr);
  hosts_config.hosts = hosts_config?.hosts.filter(h => h.mac_addr !== mac_addr)
  save_hosts_config()
}

const HOSTS_FILE = 'hosts.json'
let hosts_config : HostsConfig | undefined;

function save_hosts_config()
{
  // pretty print
  writeFileSync(HOSTS_FILE, JSON.stringify(hosts_config, null, 2))
  // Standard json print
  // writeFileSync(HOSTS_FILE, JSON.stringify(hosts_config))
}

async function get_hosts(){
  const file = await readFile(HOSTS_FILE).catch(err =>{
      assert(hosts_config === undefined)
      hosts_config = new HostsConfig([])
      
      console.log(`Creating \`${HOSTS_FILE}\` config file`)
      save_hosts_config();
      return JSON.stringify(hosts_config);
  })
  hosts_config = JSON.parse(String(file))
  
  assert(hosts_config)
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
