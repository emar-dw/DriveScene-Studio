import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Suspension,normalizeStiffness} from '../suspension.js';
import {SuspensionPose} from '../suspension-pose.js';

function response(delta,stiffness=50,hz=60){const s=new Suspension(stiffness);s.step(0,delta);let peak=0;for(let i=0;i<hz*3;i++){s.step(1/hz);peak=Math.max(peak,Math.abs(s.getState().pitchDegrees));}return {s,peak};}
test('delta-v pitch has the right direction, scales with delta and stiffness, and damps to level',()=>{
 const a=response(10),b=response(20),brake=response(-20);
 assert.ok(a.peak>.1);assert.ok(Math.abs(b.peak/a.peak-2)<1e-8);assert.ok(Math.abs(b.peak-brake.peak)<1e-8);
 const s=new Suspension();s.step(.1,20);assert.ok(s.getState().pitchDegrees>0);assert.ok(s.getState().accelerationPivotZ<0);
 const braking=new Suspension();braking.step(.1,-20);assert.ok(braking.getState().pitchDegrees<0);assert.ok(braking.getState().brakingPivotZ>0);
 assert.ok(response(20,10).peak>response(20,80).peak);assert.equal(response(20,100).peak,0);
 assert.ok(response(300,0).peak<=3);assert.equal(b.s.active,false);assert.equal(b.s.getState().pitchDegrees,0);
 assert.ok(Math.abs(response(20,50,30).peak-response(20,50,120).peak)<.01);
 for(const [v,expected]of [[-1,0],[200,100],['invalid',50],['65',65]])assert.equal(normalizeStiffness(v),expected);
});

test('actual axle centers define pivots 22 cm inside each axle',()=>{
 const s=new Suspension();s.setAxles([{position:'left-front',min:[-.9,.01,-1.9],max:[-.7,.69,-1.2]},{position:'right-rear',min:[.7,.01,1.0],max:[.9,.69,1.7]}]);
 assert.ok(Math.abs(s.accelerationPivotZ-(-1.55+.22))<1e-10);assert.ok(Math.abs(s.brakingPivotZ-(1.35-.22))<1e-10);assert.ok(Math.abs(s.pivotHeight-.35)<1e-10);
});

test('body and driver camera rotate about the requested pivot while wheels and level anchors are preserved',()=>{
 for(const delta of [36,-36]){
  const scene=new THREE.Scene(),car=new THREE.Group(),nested=new THREE.Group(),wheel=new THREE.Mesh(new THREE.BoxGeometry(.2,.6,.6));wheel.name='Object_48';nested.rotation.y=.3;nested.add(wheel);car.add(nested);car.position.set(7.55,8.52,-2);scene.add(car);
  const cabin=new THREE.Group();cabin.position.copy(car.position);scene.add(cabin);
  const camera=new THREE.PerspectiveCamera();camera.position.copy(car.position).add(new THREE.Vector3(-.38,1.24,-.38));scene.add(camera);const aim=camera.position.clone().add(new THREE.Vector3(0,-.02,-100));camera.lookAt(aim);scene.updateMatrixWorld(true);
  const oldWheel=wheel.matrixWorld.clone(),oldEye=camera.position.clone(),oldCar=car.position.clone(),relativeEye=camera.position.clone().sub(cabin.position),s=new Suspension();s.step(.15,delta);const state=s.getState();
  const z=delta>0?state.accelerationPivotZ:state.brakingPivotZ,pivot=new THREE.Vector3(0,state.pivotHeight,z),worldPivot=pivot.clone().add(oldCar);
  const restore=new SuspensionPose().apply({car,cabin,camera,aim,suspension:s,driver:true});
  const posedPivot=pivot.clone().applyQuaternion(car.quaternion).add(car.position);assert.ok(posedPivot.distanceTo(worldPivot)<1e-10);
  assert.ok(wheel.matrixWorld.elements.every((n,i)=>Math.abs(n-oldWheel.elements[i])<1e-9));
  assert.ok(camera.position.clone().sub(cabin.position).applyQuaternion(cabin.quaternion.clone().invert()).distanceTo(relativeEye)<1e-9);
  const nose=new THREE.Vector3(0,1,-2).applyQuaternion(car.quaternion).add(car.position);assert.equal(Math.sign(nose.y-(oldCar.y+1)),Math.sign(delta));
  restore();assert.ok(camera.position.distanceTo(oldEye)<1e-10);assert.ok(car.position.distanceTo(oldCar)<1e-10);assert.ok(Math.abs(car.rotation.x)<1e-10);assert.equal(wheel.matrixAutoUpdate,true);
 }
});
