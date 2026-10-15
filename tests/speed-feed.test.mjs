import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSpeedMessage,SpeedFeed} from '../speed-feed.js';

test('speed feed accepts finite numbers and explicit km/h JSON, ignoring malformed input',()=>{
 for(const [input,expected] of [['90',90],['90.5',90.5],['{"speedKmh":120}',120],['0',0],['-4',0],['400',300]])assert.equal(parseSpeedMessage(input),expected);
 for(const input of ['not JSON','null','true','"90"','[90]','{}','{"speed":90}','1e309',' '.repeat(4097),new Uint8Array([90])])assert.equal(parseSpeedMessage(input),null);
});
function fixture(){
 const sockets=[],frames=new Map(),speeds=[],states=[];let sequence=0,lost=0;
 class Socket extends EventTarget {
  close(){this.closed=true;this.dispatchEvent(new Event('close'));}
  open(){this.dispatchEvent(new Event('open'));}
  message(data){this.dispatchEvent(Object.assign(new Event('message'),{data}));}
 }
 const feed=new SpeedFeed({onSpeed:s=>speeds.push(s),onState:s=>states.push(s),onLost:()=>lost++,createSocket:url=>{const socket=new Socket();socket.url=url;sockets.push(socket);return socket;},requestFrame:callback=>{frames.set(++sequence,callback);return sequence;},cancelFrame:id=>frames.delete(id)});
 return {feed,sockets,frames,speeds,states,lost:()=>lost,flush(){const entries=[...frames];frames.clear();for(const [,callback]of entries)callback();}};
}
test('feed batches rapid samples, applies zero and cancels pending input on disconnect',()=>{
 const f=fixture();assert.equal(f.feed.connect('ws://localhost:9001'),true);assert.equal(f.feed.status,'connecting');
 f.sockets[0].open();assert.equal(f.feed.connected,true);
 for(let n=0;n<200;n++)f.sockets[0].message(JSON.stringify({speedKmh:n}));
 assert.equal(f.frames.size,1);f.flush();assert.deepEqual(f.speeds,[199]);
 f.sockets[0].message('bad packet');assert.equal(f.frames.size,0);assert.ok(f.feed.error);
 f.sockets[0].message('0');f.flush();assert.equal(f.speeds.at(-1),0);assert.equal(f.feed.error,'');
 f.sockets[0].message('300');f.feed.disconnect();f.flush();assert.equal(f.speeds.at(-1),0);assert.equal(f.feed.active,false);assert.equal(f.lost(),0);
});
test('replacing a connection ignores stale packets and unexpected loss invokes the pause callback',()=>{
 const f=fixture();f.feed.connect('ws://localhost:9001');const old=f.sockets[0];old.open();old.message('90');
 f.feed.connect('ws://localhost:9002');const current=f.sockets[1];current.open();old.message('300');current.message('120');f.flush();assert.deepEqual(f.speeds,[120]);
 current.close();assert.equal(f.feed.status,'disconnected');assert.equal(f.frames.size,0);assert.equal(f.lost(),1);
 assert.equal(f.feed.connect('https://localhost:9001'),false);assert.equal(f.feed.status,'error');assert.equal(f.feed.active,false);
 f.feed.connect('ws://localhost:9001');f.sockets[2].dispatchEvent(new Event('error'));f.sockets[2].close();assert.equal(f.feed.status,'error');assert.match(f.feed.error,/Connection failed/);
});
