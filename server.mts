
import {WebSocketServer} from 'ws';

import * as common from './common.mjs'
import { randomInt } from 'crypto';

var sent: boolean = false;
var awake: boolean = false;

const wss = new WebSocketServer({
  port: common.SERVER_PORT,
});


function wol(){
    console.log("Sending WOL packet")
    
    console.log("done")
}
const pingData: { start_time: [seconds:number,nseconds:number] | undefined } = {
  start_time: undefined,
};

function stop_ping(ws: WebSocket) {
  // clearInterval(intervalID)
  sendMessage(ws, {
    kind: "EndPing",
    data: "",
  });
}

function ping(ws: WebSocket, pinged = false){
    console.log("Ping")
    tell_status(ws)
    if (pinged){
        awake = true;
        stop_ping(ws)
    }
    else {
        const rint = randomInt(1, 10);
        console.log('rint', rint)
        setTimeout(()=>{ ping(ws, rint < 5)}, 1000);
    }
}

function tell_status(ws:WebSocket){
    if (!pingData.start_time) pingData.start_time = process.hrtime();
    const dt = process.hrtime(pingData.start_time);
    sendMessage(ws, {
      kind: "WaitingFor",
      data: dt[0].toFixed(3),
    });

}

 var intervalID: NodeJS.Timeout | undefined = undefined;
//var intervalID: number | undefined = undefined;

function sendMessage(ws:WebSocket, msg: common.ToClientMessage){
    ws.send(JSON.stringify(msg));
}
function manage_msg_server(ws:WebSocket, msg: common.ToServerMessage){
    console.log('received message of kind',msg.kind);
    switch (msg.kind) {
        case "WOL":
            wol();
            ping(ws);
            return;
        case 'Hello':
            console.log('Client says hello! text:', msg.data)
            return
        case 'GetStatus':
            tell_status(ws)
            return;
        case 'StopPing':
            stop_ping(ws);
            return;
        default:
            common.assertUnreachable(msg.kind);
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
          obj = JSON.parse(event.data);
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
});


console.log(`Listening on ws://localhost:${common.SERVER_PORT}`);
// (async ()=>{
    // const text = document.getElementById('txtStatus') as HTMLHeadingElement;
    // const btn =  document.getElementById('btnAwake') as HTMLButtonElement;
    // const btnStopPing =  document.getElementById('btnStopPing') as HTMLButtonElement;
    
    // if(btn){
    //     console.log("Found btn")
    //     btn.addEventListener('click',()=>{
    //         if(!sent && !awake){
    //             sent = true;
    //             wol();
    //             intervalID = setInterval(ping, 1000);
    //             text.innerHTML = "interval ID: " + intervalID
    //         }
    //     })
    // }else{
    //     console.error('button not found');
    // }

    // if(btnStopPing){
    //     // console.log("Found btn stop ping")
    //     console.log(intervalID)
    //     btnStopPing.addEventListener('click',()=>{
    //         if(intervalID){
    //             clearInterval(intervalID)
    //         }
    //     })
    // }

    // if(text)
    // {    console.log("Found text")
    //         text.innerHTML = 'UNDEF'
    // }   else{
    //     console.error('text element not found')
    // }
//     console.log('started script')
// })();
