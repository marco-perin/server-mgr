
// import assert from 'assert';
// import { AssertionError } from 'assert';
import * as common from './common.mjs'
import { HostConfig as HostConfigCommon } from './common.mjs';

const SERVER_WS_PORT = 6970;

function sendMessage(ws: WebSocket, msg: common.ToServerMessage) {
  ws.send(JSON.stringify(msg));
}

function send_wol(ws: WebSocket, mac_addr:string){
  console.log('sending wol package')
	sendMessage(ws, {kind: 'WOL', data: mac_addr})
}

interface HostConfig extends HostConfigCommon {
  state: 'off' | 'on' | 'starting' | undefined
}

interface SceneData {
	timerText: HTMLSpanElement,
	statusText: HTMLSpanElement,
	wolBtn: HTMLButtonElement,
	btnStopPing: HTMLButtonElement,
  hostsList: HTMLUListElement,
  hostDataList: HostConfig[]
};

// function update_timer(elapsed: number,sceneData:SceneData){
// 	sceneData.timerText.innerHTML = elapsed.toString()
// }
// function end_ping(sceneData:SceneData, status: boolean | undefined){
// 	sceneData.statusText.innerHTML = 'Not Pinging: ' + (status ? 'alive' : 'dead')
// }
// function start_ping(sceneData:SceneData){
// 	sceneData.statusText.innerHTML = 'Pinging'
// }

const mac_to_id = (mac_addr:string) => mac_addr.replaceAll(/:|-/g,'_')

function host_config_to_html(host: HostConfig, new_host_line: boolean) : HTMLLIElement{
  
  
  const ret = document.createElement('li')
  const id = new_host_line ? "NEW_MAC_ADDR" : mac_to_id(host.mac_addr)
  ret.id = id

  // console.log('doing host:', host);

  const host_or_new: HostConfig = new_host_line ? {
                ip_addr : "",
                mac_addr : "",
                name: "",
                state: undefined
              } : host

  const base_host_scheme = `
    <label for="${id}_mac">Mac</label>
    <input type="text" name="mac" id="${id}_mac" value="${host_or_new.mac_addr}"/>
    <label for="${id}_ip">Ip</label>
    <input type="text" name="ip"  id="${id}_ip" value="${host_or_new.ip_addr}" />
    <label for="${id}_name">Name</label>
    <input type="text" name="name"  id="${id}_name" value="${host_or_new.name}" />
  `

  const new_host_tail = `
  <button id="${id}_btn_add" mac_id="${id}">+</button>
  `
  const started_icon = '<span class="material-symbols-outlined" style="color:green">radio_button_checked</span>'
  // const started_icon = '<span class="material-symbols-outlined" style="color:green">play_ciecle</span>'
  // const started_icon = '<span class="material-symbols-outlined" style="color:green">screen_record</span>'
  // const stopped_icon = '<span class="material-symbols-outlined" style="color:red">radio_button_unchecked</span>'
  const unknown_icon = '<span class="material-symbols-outlined" style="color:red">radio_button_unchecked</span>'
  const starting_icon = '<span class="material-symbols-outlined" style="color:grey">radio_button_partial</span>'
  // const starting_icon = '<span class="material-symbols-outlined" style="color:red">radio_button_checked</span>'
  const stopped_icon = '<span class="material-symbols-outlined" style="color:grey">radio_button_unchecked</span>'
  // const unknown_icon = '<span class="material-symbols-outlined" style="color:grey">radio_button_unchecked</span>'

  let status_icon = unknown_icon;
  switch(host_or_new.state){
    case 'off':
      status_icon = stopped_icon
    break;
    case 'on':
      status_icon = started_icon
    break;
    case 'starting':
      status_icon = starting_icon
    break;
  }
  const wake_str = host_or_new.state === 'starting' ? 'abort wake' : 'wake'
  const existing_hosts_tail = `
  <button id="${id}_btn_wake" mac_id="${id}">${wake_str}</button>
  <button disabled id="${id}_btn_save" mac_id="${id}">save</button>
  <button id="${id}_btn_remove" mac_id="${id}">-</button>
  `

  const tail = new_host_line ? new_host_tail : existing_hosts_tail;
  
  if (new_host_line)
    status_icon = '<span class="material-symbols-outlined" style="color:grey">add_to_queue</span>'

  ret.innerHTML = `
  <div>
  <div>
    ${status_icon}
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
    const new_name_text = new_node.querySelector<HTMLInputElement>(`[id="${mac_text}_name"]`);
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
        let name = new_name_text?.value
        
        if (ip_addr === null) ip_addr = undefined;
        if (name  === null) name = undefined;
        
        sendMessage(ws,{
          kind: 'AddHost',
          data: { host: { mac_addr, ip_addr, name}}
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


function refresh_hosts(ws: WebSocket, sceneData: SceneData, overwrite: boolean ){
  const childs = sceneData.hostsList.children;
  const hosts = sceneData.hostDataList;

  const cl = childs.length;
  // console.log('child length:', cl);
  // console.log('new hosts:', hosts);
  
  // + 1 for the last entry empty, to add an host
  const hl_total = hosts.length+1;
  const dl = cl - hl_total;


  for(let i = 0; i < cl && i < hosts.length; i++ ){
    const ci = childs[i] as HTMLLIElement;

    const host = hosts[i]
    
    if (!overwrite && ci.id == mac_to_id(host.mac_addr)){
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
    case 'EndPing':
    {
      // end_ping(sceneData, msg.data.alive);
      const hostidx = sceneData.hostDataList.findIndex(h => h.mac_addr === msg.data.host.mac_addr)
      if(hostidx < 0){
        console.error("no host for waiting mac addr")
        throw Error("host for waiting for not existing")
      }
      if (msg.data.alive === undefined)
        sceneData.hostDataList[hostidx].state = undefined
      else
        sceneData.hostDataList[hostidx].state = msg.data.alive ? 'on' : 'off'
      refresh_hosts(ws, sceneData, true)
    }
    return;
    case 'WaitingFor':
      const hostidx = sceneData.hostDataList.findIndex(h => h.mac_addr === msg.data.host.mac_addr)
      if(hostidx < 0){
        console.error("no host for waiting mac addr")
        throw Error("host for waiting for not existing")
      }
      sceneData.hostDataList[hostidx].state = 'starting'
      refresh_hosts(ws, sceneData, true)
      return;

    case 'RefreshHosts':
      sceneData.hostDataList = common_hosts_to_client(msg.data.hosts, sceneData.hostDataList)
      refresh_hosts(ws, sceneData, false);
      return;
    default:
      common.assertUnreachable(msg);
  }
}

function common_hosts_to_client(commonHosts: HostConfigCommon[], current_hosts: HostConfig[]){
  return commonHosts.map((chost:HostConfigCommon): HostConfig => {
    const existingHost = current_hosts.find(c_h => c_h.mac_addr === chost.mac_addr)
    return {
      ...chost,
      state: existingHost?.state
    }
  })
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
  
  const sceneData: SceneData = {
		statusText,
		timerText,
		wolBtn: btn,
		btnStopPing,
    hostsList,
    hostDataList: []
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
