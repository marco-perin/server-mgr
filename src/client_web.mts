
// import assert from 'assert';
// import { AssertionError } from 'assert';
import * as common from './common.mjs'
import { HostConfig as HostConfigCommon, HostState } from './common.mjs';

const SERVER_WS_PORT = 6970;

function sendMessage(ws: WebSocket, msg: common.ToServerMessage) {
  ws.send(JSON.stringify(msg));
}

function send_wol(ws: WebSocket, mac_addr:string){
  console.log('sending wol package')
	sendMessage(ws, {kind: 'WOL', data: mac_addr})
}

interface HostConfig extends HostConfigCommon {
  state: HostState
}

interface SceneData {
  hostsList: HTMLUListElement,
  hostDataList: HostConfig[]
};

const mac_to_id = (mac_addr:string) => mac_addr.replaceAll(/:|-/g,'_')

function host_config_to_html(host: HostConfig, new_host_line: boolean) : HTMLDivElement{
  
  const ret = document.createElement('div')
  const id = new_host_line ? "NEW_MAC_ADDR" : mac_to_id(host.mac_addr)
  ret.id = id

  const host_or_new: HostConfig = new_host_line ? {
                ip_addr : "",
                mac_addr : "",
                name: "",
                state: undefined
              } : host

  const btn_classes = 'class="btn btn-secondary"'

  const base_host_scheme = `
    <div class="row">
      <div class="col-4 col-md input-group">
      <label class="input-group-text" for="${id}_mac">Mac</label>
      <input class="form-control" type="text" name="mac" id="${id}_mac" value="${host_or_new.mac_addr}"/>
      </div>
      <div class="col-4 col-md input-group">
      <label class="input-group-text" for="${id}_ip">Ip</label>
      <input class="form-control" type="text" name="ip"  id="${id}_ip" value="${host_or_new.ip_addr}" />
      </div>
      <div class="col-4 col-md input-group">
      <label class="input-group-text" for="${id}_name">Name</label>
      <input class="form-control" type="text" name="name"  id="${id}_name" value="${host_or_new.name}" />
      </div>
    </div>
  `
  
  const new_host_tail = `
  <button ${btn_classes} id="${id}_btn_add" mac_id="${id}" disabled>+</button>
  `

  // https://fonts.google.com/icons
  const started_icon = '<span class="material-symbols-outlined input-group-text" style="color:green">radio_button_checked</span>'
  // const started_icon = '<span class="material-symbols-outlined" style="color:green">screen_record</span>'
  const unknown_icon = '<span class="material-symbols-outlined input-group-text" style="color:gray">help</span>'
  const starting_icon = '<span class="material-symbols-outlined input-group-text" style="color:grey">radio_button_partial</span>'
  const stopped_icon = '<span class="material-symbols-outlined input-group-text" style="color:grey">radio_button_unchecked</span>'
  const error_icon = '<span class="material-symbols-outlined input-group-text" style="color:red">running_with_errors</span>'

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
    case 'error':
      status_icon = error_icon
    break;
  }
  const wake_str = host_or_new.state === 'starting' ? 'abort ping' : 'wake'
  // TODO: manage abort ping
  // const wake_disabled = (host_or_new.state === 'starting' || host_or_new.state === 'off') ? '' : 'disabled'
  const wake_disabled = ( host_or_new.state === 'off') ? '' : 'disabled'
  const wake_btn = `<button ${btn_classes} id="${id}_btn_wake" mac_id="${id}" ${wake_disabled}>${wake_str}</button>`
  const delete_text = '<span class="material-symbols-outlined">delete</span>'
  const existing_hosts_tail = `
  <div class="btn-group">
    ${wake_btn}
    <button ${btn_classes} disabled id="${id}_btn_save" mac_id="${id}">save</button>
    <button ${btn_classes} id="${id}_btn_remove" mac_id="${id}">${delete_text}</button>
  </div>
  `

  const tail = new_host_line ? new_host_tail : existing_hosts_tail;
  
  if (new_host_line)
    status_icon = '<span class="material-symbols-outlined input-group-text" style="color:grey">add_to_queue</span>'

  ret.innerHTML = `
    <div class="col-auto">
    ${status_icon}
    </div>
    <div class="col-md order-last order-md-2">
    ${base_host_scheme}
    </div>
    <div class="col-2 order-md-last">
    ${tail}
    </div>
  `
  ret.classList.add('row')
  ret.classList.add('mb-3')
  ret.classList.add('mb-md-1')
  
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
    const fields =  [new_ip_text,new_mac_text,new_name_text];
    
    fields.forEach(field =>{
      field?.addEventListener('input', _ => {
        const mac_addr = new_mac_text?.value
        // const ip_addr = new_ip_text?.value
        // const name = new_name_text?.value
        
        if(mac_addr)
        {
          if(new_btn.hasAttribute('disabled'))
            new_btn.removeAttribute('disabled')
        }
        else
          if(!new_btn.hasAttribute('disabled'))
            new_btn.setAttribute('disabled', 'true')
      })
    })
  }
  else
  {
    const mac_text = mac_to_id(host.mac_addr);
    const wol_btn = new_node.querySelector<HTMLButtonElement>(`[id="${mac_text}_btn_wake"]`);
    const rem_btn = new_node.querySelector<HTMLButtonElement>(`[id="${mac_text}_btn_remove"]`);
    const save_btn = new_node.querySelector<HTMLButtonElement>(`[id="${mac_text}_btn_save"]`);

    const new_ip_text = new_node.querySelector<HTMLInputElement>(`[id="${mac_text}_ip"]`);
    const new_mac_text = new_node.querySelector<HTMLInputElement>(`[id="${mac_text}_mac"]`);
    const new_name_text = new_node.querySelector<HTMLInputElement>(`[id="${mac_text}_name"]`);
    

    if (wol_btn === null || rem_btn === null || save_btn === null )
    {
      // console.error('unreachable!')
      throw Error("malformed row")
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

    save_btn.addEventListener('click', ()=> {
      if(!new_mac_text?.value)
          throw Error("Cannot have empty mac address")
      const newHost: HostConfig = {
        mac_addr: new_mac_text?.value,
        ip_addr: new_ip_text?.value,
        name: new_name_text?.value,
        state:undefined
      }
      sendMessage(ws, {
        kind: 'UpdateHost',
        data: { host, newHost}
      })
    })
    const fields =  [new_ip_text,new_mac_text,new_name_text];
    fields.forEach(field =>{
      field?.addEventListener('input', _ => {
        const mac_addr = new_mac_text?.value
        const ip_addr = new_ip_text?.value
        const name = new_name_text?.value
        
        if(mac_addr !== host.mac_addr || ip_addr !== host.ip_addr || name !== host.name)
        {
          if(save_btn.hasAttribute('disabled'))
            save_btn.removeAttribute('disabled')
        }
        else
          if(!save_btn.hasAttribute('disabled'))
            save_btn.setAttribute('disabled', 'true')
      })
    })
  }
  return new_node
}


function refresh_hosts(ws: WebSocket, sceneData: SceneData, overwrite_mac: string | undefined){
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
    if(overwrite_mac)
    {
      if(overwrite_mac !== host.mac_addr)
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
      sceneData.hostDataList[hostidx].state = msg.data.state
      refresh_hosts(ws, sceneData, msg.data.host.mac_addr)
    }
    return;
    case 'WaitingFor':
      const hostidx = sceneData.hostDataList.findIndex(h => h.mac_addr === msg.data.host.mac_addr)
      if(hostidx < 0){
        console.error("no host for waiting mac addr")
        throw Error("host for waiting for not existing")
      }
      sceneData.hostDataList[hostidx].state = 'starting'
      refresh_hosts(ws, sceneData, msg.data.host.mac_addr)
      return;

    case 'RefreshHosts':
      sceneData.hostDataList = common_hosts_to_client(msg.data.hosts, sceneData.hostDataList)
      refresh_hosts(ws, sceneData, undefined);
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

  const hostsList = document.getElementById('hosts_list') as HTMLUListElement
  
  const sceneData: SceneData = {
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
