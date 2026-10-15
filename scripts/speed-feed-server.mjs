import {WebSocketServer,WebSocket} from 'ws';
import {parseSpeedMessage} from '../speed-feed.js';

const port=Number(process.env.DRIVESCENE_SPEED_PORT||9001),host=process.env.DRIVESCENE_SPEED_HOST||'127.0.0.1';
if(!Number.isInteger(port)||port<0||port>65535)throw Error('DRIVESCENE_SPEED_PORT must be between 0 and 65535.');
let speed=parseSpeedMessage(process.argv[2]||'90');if(speed===null)throw Error('Initial speed must be a finite number in km/h.');
const server=new WebSocketServer({host,port,maxPayload:4096});
const send=client=>{if(client.readyState===WebSocket.OPEN){if(client.bufferedAmount>65536){client.terminate();return;}client.send(JSON.stringify({speedKmh:speed}));}};
server.on('connection',client=>{
 send(client);client.on('error',error=>console.error(`Speed sender: ${error.message}`));
 client.on('message',(data,binary)=>{if(binary)return;const value=parseSpeedMessage(data.toString());if(value===null)return;speed=value;for(const peer of server.clients)send(peer);});
});
server.on('listening',()=>console.log(`Speed feed ready at ws://${host}:${server.address().port} — ${speed} km/h. Send a number or {"speedKmh":90} to update connected scenes.`));
server.on('error',error=>{console.error(`Speed feed: ${error.message}`);process.exitCode=1;});
const stop=()=>{for(const client of server.clients)client.terminate();server.close();};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
