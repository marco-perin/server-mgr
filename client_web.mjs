import * as common from './common.mjs';
const SERVER_PORT = 6970;
function sendMessage(ws, msg) {
    ws.send(JSON.stringify(msg));
}
function send_wol(ws) {
    sendMessage(ws, { kind: 'WOL', data: '' });
}
function update_timer(elapsed, sceneData) {
    sceneData.timerText.innerHTML = elapsed.toString();
}
function end_ping(sceneData) {
    sceneData.statusText.innerHTML = 'Not Pinging';
}
function start_ping(sceneData) {
    sceneData.statusText.innerHTML = 'Pinging';
}
function manage_msg_client(ws, msg, sceneData) {
    console.log("received message of kind", msg.kind);
    switch (msg.kind) {
        case 'Hello':
            console.log("Client says hello! text:", msg.data);
            return;
        case 'EndPing':
            end_ping(sceneData);
            return;
        case 'StartPing':
            start_ping(sceneData);
            return;
        case 'WaitingFor':
            update_timer(Number.parseFloat(msg.data), sceneData);
            return;
        default:
            common.assertUnreachable(msg.kind);
    }
}
(async () => {
    const ws = new WebSocket(`ws://localhost:${SERVER_PORT}`);
    const statusText = document.getElementById("txtStatus");
    const timerText = document.getElementById('txtTimer');
    const btn = document.getElementById('btnAwake');
    btn.addEventListener('click', () => {
        send_wol(ws);
    });
    const btnStopPing = document.getElementById('btnStopPing');
    btnStopPing.addEventListener('click', () => {
        sendMessage(ws, {
            kind: 'StopPing',
            data: ''
        });
    });
    const sceneData = {
        statusText,
        timerText,
        wolBtn: btn,
        btnStopPing
    };
    console.log('sceneData:', sceneData);
    ws.addEventListener("close", (event) => {
        console.log("got close event", event);
    });
    ws.addEventListener("error", (event) => {
        console.log("got error event", event);
    });
    ws.addEventListener("message", (event) => {
        let obj;
        try {
            obj = JSON.parse(event.data);
        }
        catch {
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
})();
//# sourceMappingURL=client_web.mjs.map