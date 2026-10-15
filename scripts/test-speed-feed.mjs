import {WebSocketServer,WebSocket} from 'ws';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {readFile,mkdir,access} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),output='/private/tmp/drivescene-speed-feed';await mkdir(output,{recursive:true});
const http=createServer(async(request,response)=>{
 const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname).slice(1)||'index.html';
 const file=path.resolve(root,relative);
 if(!file.startsWith(root)){response.writeHead(403);response.end();return;}
 try{const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};const body=await readFile(file);response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});response.end(body);}catch{response.writeHead(404);response.end();}
});
const server=new WebSocketServer({server:http}),peers=[];server.on('connection',socket=>peers.push(socket));
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${http.address().port}`,url=origin.replace('http:','ws:');
let executablePath=process.env.CHROMIUM_PATH;
if(!executablePath)try{await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';}catch{}
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER ERROR',m.text());});
 await page.goto(`${origin}/?scene=20&view=driver&trees=1&mode=light`);await page.waitForFunction(()=>document.querySelector('#preview').dataset.vehicleReady==='true');
 await page.locator('#speed-feed-url').fill(url);await page.locator('#speed-feed-connect').click();await page.waitForFunction(()=>driveScene.getState().speedFeed.status==='connected',null,{timeout:10000}).catch(async error=>{console.log(JSON.stringify({feed:await page.evaluate(()=>driveScene.getState()),peers:peers.length}));throw error;});
 assert.equal(await page.locator('#driving-speed-range').isEnabled(),false);
 peers[0].send(JSON.stringify({speedKmh:137.5}));await page.waitForFunction(()=>driveScene.getState().speedKmh===137.5);assert.equal((await page.evaluate(()=>driveScene.getState())).playing,false);
 await page.locator('#driving-play').click();await page.waitForTimeout(150);
 const before=await page.evaluate(()=>driveScene.getState().distanceMetres);
 for(let n=0;n<80;n++){peers[0].send(JSON.stringify({speedKmh:90+n%100}));await new Promise(resolve=>setTimeout(resolve,5));}
 await page.waitForFunction(()=>driveScene.getState().speedKmh===169);
 const during=await page.evaluate(()=>driveScene.getState());assert.ok(during.distanceMetres>before+5);assert.equal(during.playing,true);assert.equal(during.speedFeed.received,81);
 peers[0].send('not JSON');await page.waitForTimeout(50);assert.equal((await page.evaluate(()=>driveScene.getState())).speedKmh,during.speedKmh);
 peers[0].send('0');await page.waitForFunction(()=>driveScene.getState().speedKmh===0);const zero=await page.evaluate(()=>driveScene.getState().distanceMetres);await page.waitForTimeout(150);assert.equal((await page.evaluate(()=>driveScene.getState().distanceMetres)),zero);
 peers[0].send('{"speedKmh":400}');await page.waitForFunction(()=>driveScene.getState().speedKmh===300);
 await page.screenshot({path:`${output}/desktop-connected.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${output}/mobile-connected.png`,fullPage:true});
 peers[0].close();await page.waitForFunction(()=>driveScene.getState().speedFeed.status==='disconnected');assert.equal((await page.evaluate(()=>driveScene.getState())).playing,false);assert.equal(await page.locator('#driving-speed-range').isEnabled(),true);
 await page.locator('#speed-feed-url').fill('https://invalid.test');await page.locator('#speed-feed-connect').click();assert.match(await page.locator('#speed-feed-status').textContent(),/ws:\/\//);
 await page.locator('#speed-feed-url').fill(url);await page.locator('#speed-feed-connect').click();await page.waitForFunction(()=>driveScene.getState().speedFeed.status==='connected');
 await page.locator('#speed-feed-connect').click();assert.equal((await page.evaluate(()=>driveScene.getState())).speedFeed.status,'idle');assert.equal(await page.locator('#driving-speed').isEnabled(),true);
 // Exercise the optional relay with a separate native-style sender and browser.
 const relay=spawn(process.execPath,[path.join(root,'scripts/speed-feed-server.mjs'),'90'],{env:{...process.env,DRIVESCENE_SPEED_PORT:'0',DRIVESCENE_SPEED_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 let sender;
 try{
  const relayURL=await new Promise((resolve,reject)=>{
   let log='';const timer=setTimeout(()=>reject(Error('Relay did not start')),10000);
   relay.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/Speed feed ready at (ws:\/\/127\.0\.0\.1:[0-9]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
   relay.once('error',error=>{clearTimeout(timer);reject(error);});relay.once('exit',code=>{clearTimeout(timer);reject(Error(`Relay exited: ${code}`));});
  });
  sender=new WebSocket(relayURL);const received=[];sender.on('message',packet=>received.push(JSON.parse(packet.toString()).speedKmh));await once(sender,'open');
  await page.locator('#speed-feed-url').fill(relayURL);await page.locator('#speed-feed-connect').click();await page.waitForFunction(()=>driveScene.getState().speedKmh===90&&driveScene.getState().speedFeed.status==='connected');
  await page.evaluate(()=>{driveScene.reset();driveScene.play();});
  sender.send('{"speedKmh":175}');await page.waitForFunction(()=>driveScene.getState().speedKmh===175);assert.equal(received[0],90);
  await page.waitForFunction(()=>driveScene.getState().suspension.pitchDegrees>.1);
  sender.send('400');await page.waitForFunction(()=>driveScene.getState().speedKmh===300);assert.ok(received.includes(175));
  sender.send('bad packet');await page.waitForTimeout(50);assert.equal((await page.evaluate(()=>driveScene.getState())).speedKmh,300);
  sender.send('0');await page.waitForFunction(()=>driveScene.getState().speedKmh===0&&driveScene.getState().suspension.pitchDegrees<-.1);
  await page.locator('#speed-feed-connect').click();
 }finally{sender?.terminate();const exited=once(relay,'exit');relay.kill('SIGTERM');await exited;}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({endpoint:url,receivedPackets:during.speedFeed.received,distanceDuringFeed:during.distanceMetres-before,zeroStops:true,clampedTo300:true,disconnectPauses:true,manualRestored:true,relayNativeSender:true,relaySuspension:true,mobileOverflow:false,pageErrors:errors}));
}finally{await browser.close();for(const peer of peers)peer.terminate();await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>http.close(resolve));}
