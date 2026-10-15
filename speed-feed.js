import {normalizeSpeed} from './driving.js';

export function parseSpeedMessage(text){
 if(typeof text!=='string'||text.length>4096)return null;
 let value;try{value=JSON.parse(text);}catch{return null;}
 if(value&&typeof value==='object'&&!Array.isArray(value))value=value.speedKmh;
 return typeof value==='number'&&Number.isFinite(value)?normalizeSpeed(value):null;
}

// Native browser WebSocket input. Keep only the newest sample between frames.
export class SpeedFeed {
 constructor({onSpeed,onState=()=>{},onLost=()=>{},createSocket=url=>new WebSocket(url),requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id)}={}){
  Object.assign(this,{onSpeed,onState,onLost,createSocket,requestFrame,cancelFrame});
  this.socket=null;this.status='idle';this.url='';this.error='';this.received=0;this.pending=null;this.frame=0;
 }
 get active(){return this.status==='connecting'||this.status==='connected';}
 get connected(){return this.status==='connected';}
 getState(){return {status:this.status,url:this.url,received:this.received,error:this.error};}
 notify(){this.onState(this.getState());}
 clearPending(){if(this.frame)this.cancelFrame(this.frame);this.frame=0;this.pending=null;}
 connect(value){
  this.disconnect();this.received=0;this.error='';
  let url;try{url=new URL(value);if(!['ws:','wss:'].includes(url.protocol))throw Error();}catch{this.status='error';this.error='Enter a ws:// or wss:// address.';this.notify();return false;}
  this.url=url.href;this.status='connecting';this.notify();
  let socket;try{socket=this.createSocket(this.url);}catch{this.status='error';this.error='Could not open this speed feed.';this.notify();return false;}
  this.socket=socket;
  socket.addEventListener('open',()=>{if(this.socket!==socket)return;this.status='connected';this.notify();});
  socket.addEventListener('message',event=>{
   if(this.socket!==socket||!this.connected)return;
   const speed=parseSpeedMessage(event.data);
   if(speed===null){this.error='Expected a number or {"speedKmh":90}.';this.notify();return;}
   const notify=this.received===0||!!this.error;this.error='';this.received++;this.pending=speed;
   if(!this.frame)this.frame=this.requestFrame(()=>{this.frame=0;const value=this.pending;this.pending=null;if(this.socket===socket&&value!==null)this.onSpeed(value);});
   if(notify)this.notify();
  });
  socket.addEventListener('error',()=>{if(this.socket!==socket)return;this.error='Connection failed. Check the address and sender.';this.notify();});
  socket.addEventListener('close',()=>{
   if(this.socket!==socket)return;const wasConnected=this.connected;this.socket=null;this.clearPending();this.status=this.error?'error':'disconnected';
   if(wasConnected)this.onLost();this.notify();
  });
  return true;
 }
 disconnect(){const socket=this.socket;this.socket=null;this.clearPending();if(socket)socket.close();this.status='idle';this.error='';this.notify();}
}
