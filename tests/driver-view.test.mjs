import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDriverView} from '../driver-view.js';

function fixture(){
 const cabin=createDriverView();cabin.updateMatrixWorld(true);
 const eye=new THREE.Vector3(...cabin.userData.eye),ray=new THREE.Raycaster();
 const hits=target=>{ray.set(eye,target.clone().sub(eye).normalize());ray.far=eye.distanceTo(target);return ray.intersectObject(cabin,true);};
 return {cabin,eye,ray,hits};
}

test('opaque cabin panels block street sightlines below both side windows and around pillar feet',()=>{
 const {hits}=fixture();
 for(const side of [-1,1])for(const z of [-1.5,-1.35,-1.1,-.7,0,.7,1.1])for(const y of [.3,.5,.7,.8]){
  assert.ok(hits(new THREE.Vector3(side*1.3,y,z)).length,`Body leak at side=${side}, z=${z}, y=${y}`);
 }
 // Forward sightlines below the windshield must meet a solid enclosure.
 for(const x of [-.9,-.45,0,.45,.9])for(const y of [.1,.4,.65])assert.ok(hits(new THREE.Vector3(x,y,-1.65)).length,`Front body leak at ${x}, ${y}`);
});

test('the lower driver-camera frame is enclosed while windshield and side-window apertures stay open',()=>{
 const {cabin,eye,ray,hits}=fixture();
 const camera=new THREE.PerspectiveCamera(75,16/9,.12,100);camera.position.copy(eye);camera.lookAt(eye.x,eye.y-.02,eye.z-100);camera.updateMatrixWorld();
 for(let iy=0;iy<5;iy++)for(let ix=0;ix<=50;ix++){
  const x=-1+ix*.04,y=-1+iy*.02;ray.setFromCamera(new THREE.Vector2(x,y),camera);ray.near=camera.near;ray.far=10;
  assert.ok(ray.intersectObject(cabin,true).length,`Open lower frame at NDC ${x}, ${y}`);
 }
 for(const x of [-.25,0,.25])for(const y of [0,.15,.30]){
  ray.setFromCamera(new THREE.Vector2(x,y),camera);ray.far=10;assert.equal(ray.intersectObject(cabin,true).length,0,'Forward aperture must keep the road visible');
 }
 ray.near=0;
 for(const side of [-1,1])assert.equal(hits(new THREE.Vector3(side*1.3,1.25,-.5)).length,0,'Side windows must remain open');
});
