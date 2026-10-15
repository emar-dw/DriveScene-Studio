import {chromium} from 'playwright';
import {readFile,mkdir,access,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),output='/private/tmp/drivescene-suspension';await mkdir(output,{recursive:true});
let executablePath=process.env.CHROMIUM_PATH;if(!executablePath)try{await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';}catch{}
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://suspension.test/**',async route=>{
  const relative=decodeURIComponent(new URL(route.request().url()).pathname).slice(1)||'index.html';
  try{let body=await readFile(path.join(root,relative));if(relative==='app.bundle.js')body=Buffer.from(body.toString().replace(/([\w$]+)\.onCameraFrame=/,'globalThis.__testWorld=$1;$1.onCameraFrame='));const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};await route.fulfill({contentType:types[path.extname(relative)]||'application/octet-stream',body});}catch{missing.push(relative);await route.fulfill({status:404});}
 });
 const shot=async name=>{await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>!document.documentElement.classList.contains('theme-changing')&&!document.querySelector('.frame-cover')&&!__testWorld.cameraMotion&&!__testWorld.environmentMotion&&!__testWorld.layoutMotion&&!__testWorld.structureMotion&&!__testWorld.layoutTransition&&document.querySelector('#preview').dataset.renderPending!=='true');await page.waitForTimeout(100);await page.screenshot({path:`${output}/${name}.png`,fullPage:true,animations:'disabled'});};
 const ready=()=>page.waitForFunction(()=>document.querySelector('#preview').dataset.vehicleReady==='true'&&window.__testWorld&&!__testWorld.cameraMotion&&!__testWorld.environmentMotion&&!__testWorld.layoutTransition&&document.querySelector('#preview').dataset.renderPending!=='true',null,{timeout:60000});
 await page.goto('https://suspension.test/?scene=20&view=driver&speed=60&stiffness=50&trees=1');await ready();
 await page.evaluate(()=>{
  const w=__testWorld,body=w.car.getObjectByName('Object_4'),wheel=w.car.getObjectByName('Object_48');w.renderFrame();const base=wheel.matrixWorld.elements.slice();
  const record=()=>{const relative=w.camera.position.clone().sub(w.driverCabin.position).applyQuaternion(w.driverCabin.quaternion.clone().invert());window.__poseSample={pitch:w.car.rotation.x,eye:w.camera.position.toArray(),localEye:relative.toArray(),wheelDelta:Math.max(...wheel.matrixWorld.elements.map((n,i)=>Math.abs(n-base[i])))};};
  body.onBeforeRender=record;w.driverCabin.children[0].onBeforeRender=record;
 });
 await page.locator('#driving-play').click();
 await page.locator('#driving-speed-range').evaluate(input=>{input.value='96';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>driveScene.getState().suspension.pitchDegrees>.3);await page.evaluate(()=>driveScene.pause());
 const acceleration=await page.evaluate(()=>{__testWorld.renderFrame();return {state:driveScene.getState(),rendered:__poseSample,baseEye:__testWorld.camera.position.toArray()};});
 assert.ok(acceleration.rendered.pitch>0);assert.ok(acceleration.rendered.wheelDelta<1e-7);assert.ok(acceleration.rendered.localEye.every((n,i)=>Math.abs(n-[-.38,1.24,-.38][i])<1e-8));assert.ok(Math.abs(acceleration.rendered.eye[1]-acceleration.baseEye[1])>.001);
 await shot('acceleration-driver-desktop');
 const frozen=acceleration.state.suspension.pitchDegrees;await page.waitForTimeout(120);assert.equal((await page.evaluate(()=>driveScene.getState().suspension.pitchDegrees)),frozen);
 await page.evaluate(()=>{driveScene.reset();driveScene.setSpeedKmh(120);driveScene.play();driveScene.setSpeedKmh(0);});
 await page.waitForFunction(()=>driveScene.getState().suspension.pitchDegrees<-.4);await page.evaluate(()=>driveScene.pause());
 const braking=await page.evaluate(()=>{__testWorld.renderFrame();return {state:driveScene.getState(),rendered:__poseSample};});assert.ok(braking.rendered.pitch<0);assert.ok(braking.rendered.wheelDelta<1e-7);assert.equal(braking.state.distanceMetres,0);
 await page.locator('#theme-toggle').click();await page.waitForTimeout(500);await shot('braking-driver-dark');
 await page.evaluate(()=>driveScene.play());await page.waitForFunction(()=>driveScene.getState().suspension.pitchDegrees===0,null,{timeout:5000});assert.equal((await page.evaluate(()=>driveScene.getState().distanceMetres)),0);
 // Exterior body also pitches; the camera stays outside and the wheels stay planted.
 await page.locator('[data-road=cameraView][data-value=low]').click();await ready();
 await page.evaluate(()=>{driveScene.pause();driveScene.reset();driveScene.setSuspensionStiffness(0);driveScene.setSpeedKmh(60);driveScene.play();driveScene.setSpeedKmh(96);});
 await page.waitForFunction(()=>driveScene.getState().suspension.pitchDegrees>.6);await page.evaluate(()=>driveScene.pause());
 const exterior=await page.evaluate(()=>{__testWorld.renderFrame();return {state:driveScene.getState(),rendered:__poseSample};});assert.ok(exterior.rendered.pitch>0);assert.ok(exterior.rendered.wheelDelta<1e-7);
 await shot('acceleration-exterior-dark');
 await page.locator('#suspension-stiffness').evaluate(input=>{input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal((await page.evaluate(()=>driveScene.getState().suspension.pitchDegrees)),0);assert.equal(await page.locator('#suspension-stiffness-value').textContent(),'100%');assert.equal(await page.evaluate(()=>new URLSearchParams(location.search).get('stiffness')),'100');
 await page.reload();await ready();assert.equal((await page.evaluate(()=>driveScene.getState().suspension.stiffness)),100);
 await page.evaluate(()=>{driveScene.play();driveScene.setSpeedKmh(36);});await page.waitForTimeout(120);assert.equal((await page.evaluate(()=>driveScene.getState().suspension.pitchDegrees)),0);await page.evaluate(()=>driveScene.pause());
 await page.setViewportSize({width:390,height:844});await page.locator('#theme-toggle').click();await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('mobile-stiffness');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);const results={acceleration,braking,exterior,stiffnessURLRestore:true,rigidSetting:true,settlesAtZeroSpeed:true,errors,missing};await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
