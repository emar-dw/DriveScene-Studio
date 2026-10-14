import test from 'node:test';
import assert from 'node:assert/strict';
import {Driving,normalizeSpeed,roadsideSite} from '../driving.js';

test('speed input is finite, nonnegative and bounded',()=>{
 for(const [input,expected] of [[90,90],['42.5',42.5],[-1,0],[Infinity,0],['invalid',0],[300,200],['',0]])assert.equal(normalizeSpeed(input),expected);
});
test('roadside sequence is repeatable and varies sites without overlaps',()=>{
 const sites=Array.from({length:100},(_,cell)=>roadsideSite(1,cell));
 assert.deepEqual(sites,Array.from({length:100},(_,cell)=>roadsideSite(1,cell)));
 assert.notDeepEqual(roadsideSite(1,0),roadsideSite(-1,0));
 assert.ok(new Set(sites.map(s=>s.height)).size>90);
 for(let i=1;i<sites.length;i++){
  const gap=32+sites[i-1].jitter-sites[i].jitter;
  assert.ok(gap>(sites[i-1].depth+sites[i].depth)/2);
 }
});
test('distance follows speed and elapsed time, with pause, reset and scene suspension',()=>{
 globalThis.document={hidden:false};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 let rendered=0;const applied=[],root={};
 const world={state:{id:'02'},root,preparedRoots:new WeakSet([root]),applyDrivingDistance:d=>applied.push(d),renderFrame:()=>rendered++};
 const drive=new Driving(world,{speed:90});drive.play();
 drive.tick(0);for(let ms=10;ms<=1000;ms+=10)drive.tick(ms);
 assert.ok(Math.abs(drive.distance-25)<1e-9);assert.ok(rendered>0);
 drive.setSpeed(36);drive.tick(1000);drive.tick(1100);assert.ok(Math.abs(drive.distance-26)<1e-9);
 drive.pause();drive.tick(1200);assert.equal(drive.distance,26);
 drive.play();drive.tick(10000);assert.equal(drive.distance,26);
 drive.suspend(true);drive.tick(11000);assert.equal(drive.distance,26);
 drive.suspend(false);drive.tick(12000);drive.tick(12050);assert.equal(drive.distance,26.5);
 document.hidden=true;drive.tick(20000);assert.equal(drive.distance,26.5);
 document.hidden=false;drive.tick(21000);assert.equal(drive.distance,26.5);
 world.state.id='10';drive.tick(22000);assert.equal(drive.distance,26.5);
 world.state.id='20';drive.setSpeed(0);drive.tick(23000);assert.equal(drive.distance,26.5);
 drive.setSpeed(36);drive.suspend(true,'credits');drive.suspend(true,'export');drive.suspend(false,'export');assert.equal(drive.running,false);drive.suspend(false,'credits');assert.equal(drive.running,true);
 drive.reset();assert.equal(drive.distance,0);assert.equal(applied.at(-1),0);drive.dispose();
});
