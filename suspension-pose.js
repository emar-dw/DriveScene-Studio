import * as THREE from 'three';

const wheelNames=['Object_14','Object_47','Object_48','Object_49','Object_50','Object_51'];
// Apply only during a render. Scene/layout/framing retain their level anchors;
// the body and driver's eye share one rigid transform, and tire/rim meshes retain
// their unpitched world matrices. Restoring also keeps cached cameras unpitched.
export class SuspensionPose {
 apply({car,cabin,camera,aim,suspension,driver}){
  const state=suspension?.getState();
  if(!state||(!state.accelerationAngle&&!state.brakingAngle))return ()=>{};
  if(this.car!==car){this.car=car;this.wheels=wheelNames.map(name=>car.getObjectByName(name)).filter(Boolean);}
  car.updateWorldMatrix(true,true);
  const wheels=this.wheels.map(part=>({part,world:part.matrixWorld.clone(),local:part.matrix.clone(),auto:part.matrixAutoUpdate}));
  const parts=[car,cabin,...(driver?[camera]:[])].map(part=>({part,position:part.position.clone(),quaternion:part.quaternion.clone()}));
  const oldAim=aim.clone(),anchor=car.position.clone(),basis=car.quaternion.clone(),inverse=basis.clone().invert();
  const a=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),state.accelerationAngle);
  const b=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),state.brakingAngle);
  const front=new THREE.Vector3(0,state.pivotHeight,state.accelerationPivotZ),rear=new THREE.Vector3(0,state.pivotHeight,state.brakingPivotZ);
  const offset=front.clone().sub(front.clone().applyQuaternion(a)).applyQuaternion(b).add(rear).sub(rear.clone().applyQuaternion(b));
  const rotation=b.clone().multiply(a),worldRotation=basis.clone().multiply(rotation).multiply(inverse);
  const transform=point=>point.sub(anchor).applyQuaternion(inverse).applyQuaternion(rotation).add(offset).applyQuaternion(basis).add(anchor);
  for(const {part}of parts){transform(part.position);part.quaternion.premultiply(worldRotation);}
  if(driver){transform(aim);camera.updateMatrixWorld(true);}
  car.updateWorldMatrix(true,true);cabin.updateMatrixWorld(true);
  for(const {part,world}of wheels){part.matrixAutoUpdate=false;part.matrix.copy(part.parent.matrixWorld).invert().multiply(world);part.updateMatrixWorld(true);}
  return ()=>{
   for(const {part,position,quaternion}of parts){part.position.copy(position);part.quaternion.copy(quaternion);}
   aim.copy(oldAim);
   for(const {part,local,auto}of wheels){part.matrix.copy(local);part.matrixAutoUpdate=auto;}
   car.updateWorldMatrix(true,true);cabin.updateMatrixWorld(true);if(driver)camera.updateMatrixWorld(true);
  };
 }
}
