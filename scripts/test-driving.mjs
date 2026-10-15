import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';

const root=new URL('../',import.meta.url).pathname,output='/private/tmp/drivescene-verification';
await mkdir(output,{recursive:true});
let executablePath=process.env.CHROMIUM_PATH;
if(!executablePath)try{await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';}catch{}
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const results=[],errors=[],missing=[];
async function createPage(viewport={width:1440,height:1000}){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('https://drivescene.test/**',async route=>{
  const relative=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'')||'index.html',file=path.resolve(root,relative);
  if(!file.startsWith(root))return route.fulfill({status:403});
  try{
   let body=await readFile(file);
   if(relative==='app.bundle.js')body=Buffer.from(body.toString().replace(/([\w$]+)\.onCameraFrame=/,'globalThis.__testWorld=$1;$1.onCameraFrame='));
   const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
   await route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body});
  }catch{missing.push(relative);await route.fulfill({status:404});}
 });
 return page;
}
async function ready(page){await page.waitForFunction(()=>document.querySelector('#preview').dataset.vehicleReady==='true',null,{timeout:60000});}
async function settled(page,id,view){await page.waitForFunction(([id,view])=>{const w=window.__testWorld;return w.state?.id===id&&(!view||w.state.cameraView===view)&&!w.cameraMotion&&!w.environmentMotion&&!w.layoutTransition&&document.querySelector('#preview').dataset.renderPending!=='true';},[id,view]);}
async function shot(page,name){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>{const w=__testWorld;return !w.cameraMotion&&!w.environmentMotion&&!w.layoutMotion&&!w.layoutTransition&&!document.querySelector('.frame-cover')&&document.querySelector('#preview').dataset.renderPending!=='true';});await page.screenshot({path:`${output}/${name}.png`,fullPage:true});}
try{
 const page=await createPage();
 await page.goto('https://drivescene.test/?scene=02&mode=light&lanes=6&trees=1&perf=1');await ready(page);
 const gpu=await page.evaluate(()=>{const gl=__testWorld.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};});
 results.push({gpu});
 const initial=await page.evaluate(()=>__testWorld.audit());assert.equal(initial.driving.poolSize,40);
 await shot(page,'road-desktop');
 await page.locator('#driving-speed').fill('90');await page.locator('#driving-play').click();await page.waitForTimeout(1000);
 const moving=await page.evaluate(()=>driveScene.getState());assert.ok(moving.distanceMetres>15&&moving.distanceMetres<40);
 const sliderPlayback=await page.evaluate(async()=>{
  const slider=document.querySelector('#driving-speed-range'),deltas=[];
  let previous=driveScene.getState().distanceMetres,frame=0;
  await new Promise(resolve=>{
   const sample=()=>{
    const distance=driveScene.getState().distanceMetres;
    if(frame>0)deltas.push(distance-previous);previous=distance;
    for(let update=0;update<4;update++){slider.value=String(90+frame%40+update);slider.dispatchEvent(new Event('input',{bubbles:true}));}
    if(++frame<60)requestAnimationFrame(sample);else resolve();
   };requestAnimationFrame(sample);
  });
  slider.dispatchEvent(new Event('change',{bubbles:true}));
  return {frames:deltas.length,stalledFrames:deltas.filter(d=>d<=0).length,distanceMetres:deltas.reduce((a,b)=>a+b,0),urlSpeed:Number(new URLSearchParams(location.search).get('speed')),speed:driveScene.getState().speedKmh};
 });
 assert.equal(sliderPlayback.stalledFrames,0);assert.ok(sliderPlayback.distanceMetres>10);assert.equal(sliderPlayback.urlSpeed,sliderPlayback.speed);results.push({sliderPlayback});
 await page.evaluate(()=>driveScene.setSpeedKmh(90));
 await page.locator('#driving-play').click();const paused=await page.evaluate(()=>driveScene.getState());await page.waitForTimeout(250);
 assert.equal((await page.evaluate(()=>driveScene.getState())).distanceMetres,paused.distanceMetres);
 await page.locator('#driving-reset').click();assert.equal((await page.evaluate(()=>driveScene.getState())).distanceMetres,0);
 const pool=await page.evaluate(()=>{
  const w=__testWorld,baseline=w.drivingRoad.pool.map(p=>({cell:p.cell,width:p.site.width})),geometries=w.renderer.info.memory.geometries,ids=w.drivingRoad.pool.map(p=>p.group.uuid),car=w.car.position.toArray();
  for(const distance of [100,1000,10000,100000]){w.driving.distance=distance;w.applyDrivingDistance(distance);w.renderFrame();}
  const final=w.drivingRoad.pool.map(p=>({cell:p.cell,width:p.site.width,z:p.group.position.z}));
  const result={baseline,final,geometries,finalGeometries:w.renderer.info.memory.geometries,ids,finalIds:w.drivingRoad.pool.map(p=>p.group.uuid),car,finalCar:w.car.position.toArray()};driveScene.reset();return result;
 });
 assert.deepEqual(pool.ids,pool.finalIds);assert.equal(pool.geometries,pool.finalGeometries);assert.deepEqual(pool.car,pool.finalCar);
 assert.notDeepEqual(pool.baseline.map(p=>p.width),pool.final.map(p=>p.width));assert.ok(pool.final.every(p=>p.z>-560&&p.z<140));
 results.push({recycling:{distanceMetres:100000,poolSize:pool.ids.length,geometriesBefore:pool.geometries,geometriesAfter:pool.finalGeometries}});
 await page.locator('[data-road-preset=highway]').click();await settled(page,'20');
 const highway=await page.evaluate(()=>__testWorld.audit());assert.equal(highway.dividedRoad.travelLanes,4);assert.equal(highway.dividedRoad.safetyLanes,2);assert.equal(highway.dividedRoad.safetyLaneWidth,3);assert.equal(highway.dividedRoad.markings,'white');
 assert.equal(await page.locator('[data-road=laneCount][data-value="4"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#waterfront').isVisible(),false);
 const yellow=await page.evaluate(()=>{let count=0;__testWorld.root.traverse(o=>{if(o.isMesh&&[__testWorld.mat.yellow,__testWorld.mat.yellowPaint].includes(o.material))count++;});return count;});assert.equal(yellow,0);
 const dashSpan=await page.evaluate(()=>__testWorld.drivingRoad.dashes.map(mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.max.z-mesh.geometry.boundingBox.min.z;}));assert.ok(dashSpan.length>=2&&dashSpan.every(span=>span>900));
 await shot(page,'highway-desktop');
 await page.locator('[data-road=cameraView][data-value=driver]').click();await settled(page,'20','driver');
 const driver=await page.evaluate(()=>({audit:__testWorld.audit(),externalVisible:__testWorld.car.visible,near:__testWorld.camera.near}));
 assert.equal(driver.externalVisible,false);assert.equal(await page.locator('#vehicle').isVisible(),false);assert.equal(driver.audit.driverView.fov,75);assert.equal(driver.near,.12);assert.ok(driver.audit.driverView.parts.includes('A pillar'));assert.ok(!driver.audit.driverView.parts.some(p=>/wheel|instrument|dashboard/i.test(p)));
 assert.ok(Math.abs(driver.audit.driverView.eye[0]-(driver.audit.car[0]-.38))<1e-8);
 await shot(page,'highway-driver-desktop');
 await page.locator('#theme-toggle').click();await page.waitForFunction(()=>__testWorld.state.mode==='dark');await page.waitForTimeout(500);await shot(page,'highway-driver-dark');
 await page.evaluate(()=>{driveScene.setSpeedKmh(0);driveScene.play();});const stopped=await page.evaluate(()=>driveScene.getState());await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>driveScene.getState())).distanceMetres,stopped.distanceMetres);
 await page.evaluate(()=>{driveScene.setSpeedKmh(100);driveScene.play();});await page.waitForTimeout(150);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
 const png=await readFile(await download.path());assert.equal(png.readUInt32BE(16),1920);assert.equal(png.readUInt32BE(20),1080);assert.ok((await page.evaluate(()=>driveScene.getState())).playing);results.push({export:{width:1920,height:1080,bytes:png.length}});
 await page.evaluate(()=>driveScene.pause());
 await page.reload();await ready(page);assert.equal((await page.evaluate(()=>__testWorld.state.cameraView)),'driver');assert.equal((await page.evaluate(()=>driveScene.getState())).speedKmh,100);assert.equal(await page.locator('[data-road-preset=highway]').getAttribute('aria-pressed'),'true');
 // Static scenarios retain their existing geometry and suspend driving distance.
 await page.locator('[data-structure=parking]').click();await settled(page,'10');assert.equal(await page.locator('#driving-controls').isVisible(),false);
 await page.evaluate(()=>driveScene.play());const beforeParking=(await page.evaluate(()=>driveScene.getState())).distanceMetres;await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>driveScene.getState())).distanceMetres,beforeParking);
 await page.locator('[data-structure=junction]').click();await settled(page,'05');await page.locator('#junction-play').click();await page.waitForFunction(()=>!__testWorld.cameraMotion&&__testWorld.state.junctionPosition==='near');
 await page.locator('[data-structure=ramp]').click();await settled(page,'06');assert.equal(await page.locator('[data-ramp-view=driver]').isVisible(),false);
 await page.locator('[data-structure=elevated]').click();await settled(page,'03');await page.evaluate(()=>driveScene.pause());
 await page.locator('[data-ramp-view=driver]').click();await settled(page,'03','driver');assert.equal((await page.evaluate(()=>__testWorld.audit())).roadElevation,8.5);
 await page.locator('[data-ramp-view=low]').click();await settled(page,'03','low');assert.equal((await page.evaluate(()=>__testWorld.camera.fov)),38);assert.equal((await page.evaluate(()=>__testWorld.car.visible)),true);assert.equal(await page.locator('#vehicle').isVisible(),true);assert.equal(await page.locator('#vehicle').isEnabled(),true);await shot(page,'elevated-desktop');
 await page.locator('[data-structure=road]').click();await settled(page,'20');await page.locator('[data-road-preset=urban]').click();await settled(page,'02');
 await page.locator('[data-road=laneCount][data-value="2"]').click();await settled(page,'09');assert.equal((await page.evaluate(()=>__testWorld.state.laneCount)),2);
 await page.locator('#waterfront').check();await page.waitForFunction(()=>__testWorld.state.waterfront&&!__testWorld.environmentMotion);await shot(page,'coast-driver-desktop');
 const mobile=await createPage({width:390,height:844});await mobile.goto('https://drivescene.test/?scene=20&mode=light&view=driver&trees=1&speed=80');await ready(mobile);await shot(mobile,'highway-driver-mobile');
 assert.equal(await mobile.locator('#driving-speed').isVisible(),true);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mobile.locator('#driving-speed-range').focus();await mobile.keyboard.press('ArrowRight');assert.equal((await mobile.evaluate(()=>driveScene.getState())).speedKmh,81);
 await mobile.locator('#driving-play').click();await mobile.waitForTimeout(250);assert.ok((await mobile.evaluate(()=>driveScene.getState())).distanceMetres>0);
 await mobile.locator('.credits').evaluate(el=>el.click());const creditsDistance=(await mobile.evaluate(()=>driveScene.getState())).distanceMetres;await mobile.waitForTimeout(200);assert.equal((await mobile.evaluate(()=>driveScene.getState())).distanceMetres,creditsDistance);
 await mobile.locator('#credits-back').click();await mobile.waitForTimeout(200);assert.ok((await mobile.evaluate(()=>driveScene.getState())).distanceMetres>creditsDistance);
 await mobile.emulateMedia({reducedMotion:'reduce'});await mobile.reload();await ready(mobile);assert.equal((await mobile.evaluate(()=>driveScene.getState())).playing,false);
 await mobile.locator('#driving-play').click();await mobile.waitForTimeout(150);assert.ok((await mobile.evaluate(()=>driveScene.getState())).distanceMetres>0);
 await mobile.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hiddenDistance=(await mobile.evaluate(()=>driveScene.getState())).distanceMetres;await mobile.waitForTimeout(200);assert.equal((await mobile.evaluate(()=>driveScene.getState())).distanceMetres,hiddenDistance);
 await mobile.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));driveScene.pause();});
 // A user's pause during asset loading must override the URL's autoplay request.
 const loading=await createPage();
 await loading.route('**/ego-vehicle-ready.glb.gz*',async route=>{await new Promise(resolve=>setTimeout(resolve,1500));await route.fulfill({contentType:'application/octet-stream',body:await readFile(path.join(root,'ego-vehicle-ready.glb.gz'))});});
 await loading.goto('https://drivescene.test/?scene=20&drive=1&speed=90',{waitUntil:'domcontentloaded'});
 await loading.waitForFunction(()=>!!window.driveScene);await loading.evaluate(()=>driveScene.pause());await ready(loading);assert.equal((await loading.evaluate(()=>driveScene.getState())).playing,false);
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);results.push({checks:'speed, pause, reset, 100 km recycling, highway, driver camera, themes, export, URL restore, parking, junction, ramp, elevated, coast, mobile, reduced motion, visibility',errors,missing});
 await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
