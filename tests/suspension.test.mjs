import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Suspension,normalizeStiffness} from '../suspension.js';
import {SuspensionPose} from '../suspension-pose.js';

function response(delta,stiffness=50,hz=60){const s=new Suspension(stiffness);s.step(0,delta);let peak=0;for(let i=0;i<hz*3;i++){s.step(1/hz);peak=Math.max(peak,Math.abs(s.getState().pitchDegrees));}return {s,peak};}
test('delta-v pitch is progressive, directional, stiffness-controlled and settles to level',()=>{
 const a=response(10),b=response(20),brake=response(-20);
 assert.ok(a.peak>.1);assert.ok(b.peak>a.peak&&b.peak<2*a.peak);assert.ok(Math.abs(b.peak-brake.peak)<1e-8);
 const medium=response(40),large=response(80);
 assert.ok(medium.peak>b.peak&&large.peak>medium.peak);
 assert.ok(medium.peak/b.peak<b.peak/a.peak);assert.ok(large.peak/medium.peak<medium.peak/b.peak);
 const s=new Suspension();s.step(.1,20);assert.ok(s.getState().pitchDegrees>0);assert.ok(s.getState().accelerationPivotZ<0);
 const braking=new Suspension();braking.step(.1,-20);assert.ok(braking.getState().pitchDegrees<0);assert.ok(braking.getState().brakingPivotZ>0);
 assert.ok(response(20,10).peak>response(20,80).peak);assert.equal(response(20,100).peak,0);
 assert.ok(response(300,0).peak<=3);assert.equal(b.s.active,false);assert.equal(b.s.getState().pitchDegrees,0);
 assert.ok(Math.abs(response(20,50,30).peak-response(20,50,120).peak)<.01);
 for(const [v,expected]of [[-1,0],[200,100],['invalid',50],['65',65]])assert.equal(normalizeStiffness(v),expected);
});

test('bump stop absorbs a full-range speed step without hitting the safety limit',()=>{
 for(const stiffness of [0,50,99]){
  const s=new Suspension(stiffness);s.step(0,300);let peak=0,previous=0,returning=false;
  for(let i=0;i<960*5;i++){
   s.step(1/960);const angle=s.acceleration.angle;
   assert.ok(Number.isFinite(angle)&&Number.isFinite(s.acceleration.velocity));
   assert.ok(angle>=0&&angle<3*Math.PI/180);
   if(angle<previous-1e-12)returning=true;
   if(returning)assert.ok(angle<=previous+1e-12,'rebound returns without a second compression');
   previous=angle;peak=Math.max(peak,angle);
  }
  assert.ok(peak>0);assert.equal(s.active,false);
 }
});

test('nonlinear integration follows the same motion at different frame rates',()=>{
 const make=()=>{const s=new Suspension(0);s.step(0,160);assert.equal(s.getState().pitchDegrees,0);assert.ok(s.active);return s;};
 const a=make(),b=make(),c=make();
 for(let i=0;i<90;i++){
  a.step(1/30);for(let j=0;j<4;j++)b.step(1/120);
  c.step(.007);c.step(1/30-.007);
  assert.ok(Math.abs(a.getState().pitchDegrees-b.getState().pitchDegrees)<.005);
  assert.ok(Math.abs(a.getState().pitchDegrees-c.getState().pitchDegrees)<.005);
 }
 const slow=make(),fast=make();slow.step(.1);for(let i=0;i<12;i++)fast.step(1/120);
 assert.ok(Math.abs(slow.getState().pitchDegrees-fast.getState().pitchDegrees)<.005);
});

test('rapid direction changes stay finite and preserve both axle channels',()=>{
 const s=new Suspension(0);
 for(let i=0;i<600;i++){
  s.step(.1,i%2?300:-300);const state=s.getState();
  assert.ok(Number.isFinite(state.pitchDegrees));assert.ok(Math.abs(state.pitchDegrees)<=3);
  assert.ok(state.accelerationAngle>=0&&state.brakingAngle<=0);
 }
 assert.ok(s.acceleration.angle>0&&s.braking.angle>0);
 for(let i=0;i<300;i++)s.step(1/60);
 assert.equal(s.active,false);s.step(0,20);s.setStiffness(100);assert.equal(s.active,false);
});

test('acceleration and braking pivots match the front and rear axle centers',()=>{
 const s=new Suspension();s.setAxles([{position:'left-front',min:[-.9,.01,-1.9],max:[-.7,.69,-1.2]},{position:'right-rear',min:[.7,.02,1.0],max:[.9,.72,1.7]}]);
 assert.ok(Math.abs(s.accelerationPivotZ-(-1.55))<1e-10);assert.ok(Math.abs(s.brakingPivotZ-1.35)<1e-10);
 assert.ok(Math.abs(s.accelerationPivotHeight-.35)<1e-10);assert.ok(Math.abs(s.brakingPivotHeight-.37)<1e-10);
});

test('body and driver camera rotate about the requested pivot while wheels and level anchors are preserved',()=>{
 for(const delta of [36,-36]){
  const scene=new THREE.Scene(),car=new THREE.Group(),nested=new THREE.Group(),wheel=new THREE.Mesh(new THREE.BoxGeometry(.2,.6,.6));wheel.name='Object_48';nested.rotation.y=.3;nested.add(wheel);car.add(nested);car.position.set(7.55,8.52,-2);scene.add(car);
  const cabin=new THREE.Group();cabin.position.copy(car.position);scene.add(cabin);
  const camera=new THREE.PerspectiveCamera();camera.position.copy(car.position).add(new THREE.Vector3(-.38,1.24,-.38));scene.add(camera);const aim=camera.position.clone().add(new THREE.Vector3(0,-.02,-100));camera.lookAt(aim);scene.updateMatrixWorld(true);
  const oldWheel=wheel.matrixWorld.clone(),oldEye=camera.position.clone(),oldCar=car.position.clone(),relativeEye=camera.position.clone().sub(cabin.position),s=new Suspension();s.step(.15,delta);const state=s.getState();
  const z=delta>0?state.accelerationPivotZ:state.brakingPivotZ,height=delta>0?state.accelerationPivotHeight:state.brakingPivotHeight,pivot=new THREE.Vector3(0,height,z),worldPivot=pivot.clone().add(oldCar);
  const restore=new SuspensionPose().apply({car,cabin,camera,aim,suspension:s,driver:true});
  const posedPivot=pivot.clone().applyQuaternion(car.quaternion).add(car.position);assert.ok(posedPivot.distanceTo(worldPivot)<1e-10);
  assert.ok(wheel.matrixWorld.elements.every((n,i)=>Math.abs(n-oldWheel.elements[i])<1e-9));
  assert.ok(camera.position.clone().sub(cabin.position).applyQuaternion(cabin.quaternion.clone().invert()).distanceTo(relativeEye)<1e-9);
  const nose=new THREE.Vector3(0,1,-2).applyQuaternion(car.quaternion).add(car.position);assert.equal(Math.sign(nose.y-(oldCar.y+1)),Math.sign(delta));
  restore();assert.ok(camera.position.distanceTo(oldEye)<1e-10);assert.ok(car.position.distanceTo(oldCar)<1e-10);assert.ok(Math.abs(car.rotation.x)<1e-10);assert.equal(wheel.matrixAutoUpdate,true);
 }
});
