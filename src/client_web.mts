
// import assert from 'assert';
// import { AssertionError } from 'assert';
import * as common from './common.mjs'
import { HostConfig } from './common.mjs';

const SERVER_WS_PORT = 6970;

function sendMessage(ws: WebSocket, msg: common.ToServerMessage) {
  ws.send(JSON.stringify(msg));
}

function send_wol(ws: WebSocket, mac_addr:string){
  console.log('sending wol package')
	sendMessage(ws, {kind: 'WOL', data: mac_addr})
}

type SceneData = {
	timerText: HTMLSpanElement,
	statusText: HTMLSpanElement,
	wolBtn: HTMLButtonElement,
	btnStopPing: HTMLButtonElement,
  hostsList: HTMLUListElement
};

function update_timer(elapsed: number,sceneData:SceneData){
	sceneData.timerText.innerHTML = elapsed.toString()
}
function end_ping(sceneData:SceneData, status: boolean | undefined){
	sceneData.statusText.innerHTML = 'Not Pinging: ' + (status ? 'alive' : 'dead')
}
function start_ping(sceneData:SceneData){
	sceneData.statusText.innerHTML = 'Pinging'
}

const mac_to_id = (mac_addr:string) => mac_addr.replaceAll(/:|-/g,'_')

function host_config_to_html(host: HostConfig, new_host_line: boolean) : HTMLLIElement{
  
  
  const ret = document.createElement('li')
  const id = new_host_line ? "NEW_MAC_ADDR" : mac_to_id(host.mac_addr)
  ret.id = id

  const host_or_new = new_host_line ? {
                ip_addr : "",
                mac_addr : ""
              } : host

  const base_host_scheme = `
    <label for="mac">Mac</label>
    <input type="text" name="mac" id="${id}_mac" value="${host_or_new.mac_addr}"/>
    <label for="ip">Ip</label>
    <input type="text" name="ip"  id="${id}_ip"  value="${host_or_new.ip_addr}" />
  `

  const new_host_tail = `
  <button id="${id}_btn_add" mac_id="${id}">+</button>
  `
  const existing_hosts_tail = `
  <button id="${id}_btn_wake" mac_id="${id}">wake</button>
  <button disabled id="${id}_btn_save" mac_id="${id}">save</button>
  <button id="${id}_btn_remove" mac_id="${id}">-</button>
  `
  
  const tail = new_host_line ? new_host_tail : existing_hosts_tail;
  ret.innerHTML = `
  <div>
  <div>
    ${base_host_scheme}
    ${tail}
  </div>
  </div>
  `
  
  return ret
}

function host_config_to_htmlnode(host: HostConfig, ws: WebSocket, new_host_line: boolean){
  // console.log('new_mac_line: ', new_host_line);
  
  const new_node = host_config_to_html(host, new_host_line)
  if (new_host_line){
    const mac_text = 'NEW_MAC_ADDR';
    const new_btn = new_node.querySelector<HTMLButtonElement>(`[id="${mac_text}_btn_add"]`);
    const new_ip_text = new_node.querySelector<HTMLInputElement>(`[id="${mac_text}_ip"]`);
    const new_mac_text = new_node.querySelector<HTMLInputElement>(`[id="${mac_text}_mac"]`);
    if (new_btn === null)
      {
        // console.error('unreachable!')
        throw Error("unreachable")
      }
      new_btn.addEventListener('click', () => {
        // TODO: add verification
        const mac_addr = new_mac_text?.value
        // console.log(new_mac_text);
        // console.log(mac_addr);
        
        if (!mac_addr)
          throw Error("Cannot have empty mac address")
        let ip_addr = new_ip_text?.value
        
        if (ip_addr === null) ip_addr = undefined;
        
        sendMessage(ws,{
          kind: 'AddHost',
          data: { host: { mac_addr, ip_addr}}
        })
      })
      
  }
  else
  {
    const mac_text = mac_to_id(host.mac_addr);
    const wol_btn = new_node.querySelector<HTMLButtonElement>(`[id="${mac_text}_btn_wake"]`);
    const rem_btn = new_node.querySelector<HTMLButtonElement>(`[id="${mac_text}_btn_remove"]`);
    if (wol_btn === null || rem_btn === null )
    {
      // console.error('unreachable!')
      throw Error("unreachable")
    }
    wol_btn.addEventListener('click', () => {
      send_wol(ws, host.mac_addr)
    })
    
    rem_btn.addEventListener('click', () => {
      sendMessage(ws, {
        kind: 'RemoveHost',
        data: {host}
      })
    })

  }
  return new_node
}


function refresh_hosts(hosts: HostConfig[], ws: WebSocket, sceneData:SceneData){
  const childs = sceneData.hostsList.children;

  const cl = childs.length;
  // console.log('child length:', cl);
  // console.log('new hosts:', hosts);
  
  // + 1 for the last entry empty, to add an host
  const hl_total = hosts.length+1;
  const dl = cl - hl_total;


  for(let i = 0; i < cl && i < hosts.length; i++ ){
    const ci = childs[i] as HTMLLIElement;

    const host = hosts[i]
    
    if (ci.id == mac_to_id(host.mac_addr)){
      continue
    }
    const new_node = host_config_to_htmlnode(host, ws, i >= hosts.length)
    sceneData.hostsList.replaceChild(new_node, ci)
  }

  if (dl < 0){// less hosts on html
    for(let i = 0; i < -dl; i++){
      // console.log('i:',i)
      // console.log(hosts);
      const host = hosts[cl + i];
      // console.log('host', host);
      const new_node = host_config_to_htmlnode(host, ws, i >= -dl-1)
      sceneData.hostsList.appendChild(new_node)
    }
  }
  else{
    // TODO: remove additional hosts
    // console.error('NOT IMPLEMENTED')
    for(let i = dl; i > 0; i-- ){
      let c_t_remove = childs[hl_total+i-2]
      sceneData.hostsList.removeChild(c_t_remove)
    }
  }
}

function manage_msg_client(ws: WebSocket, msg: common.ToClientMessage, sceneData: SceneData) {
  
	console.log("received message of kind", msg.kind);
  
	switch (msg.kind) {
    case 'Hello':
      console.log("Client says hello! text:", msg.data);
      return;
    case 'StartPing':
      start_ping(sceneData);
      return;
    case 'EndPing':
      end_ping(sceneData, msg.data.alive);
      return;
    case 'WaitingFor':
      update_timer(msg.data.time, sceneData);
      return;
    case 'RefreshHosts':
      refresh_hosts(msg.data.hosts, ws, sceneData);
      return;
    default:
      common.assertUnreachable(msg);
  }
}

(async () => {
  const ws = new WebSocket(`ws://${window.location.hostname}:${SERVER_WS_PORT}`);

  const statusText = document.getElementById("txtStatus") as HTMLSpanElement;
  const timerText = document.getElementById('txtTimer') as HTMLSpanElement
  const btn =  document.getElementById('btnAwake') as HTMLButtonElement;
  // btn.addEventListener('click', ()=>{
	//   send_wol(ws);
  // })
  const btnStopPing =  document.getElementById('btnStopPing') as HTMLButtonElement;
  // btnStopPing.addEventListener('click',()=>{
	// sendMessage(ws,{
	// 	kind: 'StopPing',
	// 	data: ''
	// });
  // });
  const hostsList = document.getElementById('hosts_list') as HTMLUListElement
  
  const sceneData:SceneData = {
		statusText,
		timerText,
		wolBtn: btn,
		btnStopPing,
    hostsList
  }
  console.log('sceneData:', sceneData)
  ws.addEventListener("close", (event) => {
    console.log("got close event", event);
  });

  ws.addEventListener("error", (event) => {
    console.log("got error event", event);
  });

  ws.addEventListener("message", (event) => {
    let obj: undefined | common.ToClientMessage;

    try {
      obj = JSON.parse(event.data);
    } catch {
      console.log("GOT INVALID MESSAGE (not json)", obj);
      return;
    }

    if (!common.isToClientMessage(obj)) {
      console.log("GOT INVALID MESSAGE (not correct message struct)", obj);
      return;
    }

    manage_msg_client(ws, obj, sceneData);
  });

  ws.addEventListener("open", (event) => {
    console.log("got open event", event);
  });

  console.log("Hello from web client");
})()
