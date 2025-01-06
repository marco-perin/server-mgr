
import {writeFileSync, readFileSync, read} from 'node:fs'
import { readFile } from 'node:fs/promises';
import {WebSocketServer, WebSocket} from 'ws';

import * as common from './common.mjs'

import {wake} from 'wake_on_lan'

import ping_pkg from 'ping'
import { HostConfig } from './common.mjs';
import assert from 'node:assert';
const {promise: ping_promise} = ping_pkg

var sent: boolean = false;
var awake: boolean = false;

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
  // clearInterval(intervalID)
  // TODO: Actually stop pinging
  sendMessage(ws, {
    kind: "EndPing",
    data: {host, alive},
  });
}

const broadcast_addr: string = '192.168.2.255'

function ping(ws: WebSocket, host: HostConfig, pinged = false){
    tell_status(ws)
    const ip_addr = host.ip_addr;

    if (!ip_addr){
      stop_ping(ws, host, undefined)
    }
    else
      ping_promise.probe(ip_addr).then(response => {
        // console.log('pinged: ', response)
        pinged = response.alive;
        console.log(`Pinging ${ip_addr}: ${response.alive}`)
        if (pinged){
            awake = true;
            stop_ping(ws, host, response.alive)
        }
        else {
            // const rint = randomInt(1, 10);
            // console.log('rint', rint)
            setTimeout(()=>{ ping(ws, host, false)}, 1000);
        }
      });
}

function tell_status(ws: WebSocket){
    if (!pingData.start_time) pingData.start_time = process.hrtime();
    const dt = process.hrtime(pingData.start_time);
    sendMessage(ws, {
      kind: "WaitingFor",
      data: { time: dt[0]}
    });

}

var intervalID: NodeJS.Timeout | undefined = undefined;

function sendMessage(ws: WebSocket, msg: common.ToClientMessage){
    ws.send(JSON.stringify(msg));
}
function manage_msg_server(ws: WebSocket, msg: common.ToServerMessage){
    console.log('received message of kind',msg.kind);
    switch (msg.kind) {
        case "WOL":
            wol(msg.data);
            assert(hosts_config !== undefined)
            const host = hosts_config?.hosts.find(h => h.mac_addr === msg.data)
            assert(host !== undefined, `host for MAC addr ${msg.data} not existing`)
            ping(ws, host);
            return;
        case 'Hello':
            console.log('Client says hello! text:', msg.data)
            return
        case 'GetStatus':
            tell_status(ws)
            return;
        case 'StopPing':
            stop_ping(ws, msg.data.host, undefined);
            return;
        case 'AddHost':
          // throw Error('Not Implemented');
          add_host(msg.data.host.mac_addr,msg.data.host.ip_addr)
          wss.clients.forEach((client: WebSocket) => {
            refresh_hosts(client)
          });
          return;
        case 'RemoveHost':
          remove_host(msg.data.host.mac_addr,msg.data.host.ip_addr)
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
    
    ws.addEventListener('message',(event)=>{
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
    
    refresh_hosts(ws)
});

function refresh_hosts(ws: WebSocket){
  get_hosts().then( _=>{
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

console.log(`Listening on ws://localhost:${common.SERVER_PORT}`);

function add_host(mac_addr: string, ip_addr: string | undefined){
  hosts_config?.hosts.push({mac_addr, ip_addr})
  save_hosts_config()
}

function remove_host(mac_addr: string, ip_addr: string | undefined){
  assert(hosts_config)
  console.log('removing host', mac_addr, ip_addr);
  hosts_config.hosts = hosts_config?.hosts.filter(h => h.mac_addr !== mac_addr)
  save_hosts_config()
}

const HOSTS_FILE = 'hosts.json'
let hosts_config : HostsConfig | undefined;

function save_hosts_config()
{
  // pretty print
  writeFileSync(HOSTS_FILE, JSON.stringify(hosts_config, null, 2))
  // writeFileSync(HOSTS_FILE, JSON.stringify(hosts_config))
}

async function get_hosts(){  
  const file = await readFile(HOSTS_FILE).catch(err=>{
      if (hosts_config === undefined ){
        hosts_config = new HostsConfig([])
      }
      console.error(err)
      console.log(`Creating \`${HOSTS_FILE}\` config file`)
      save_hosts_config();
      return hosts_config;
  })
  
  hosts_config = JSON.parse(String(file))
}