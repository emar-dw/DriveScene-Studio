// Physical distance is independent of render cadence and the scene's geometry.
import {Suspension} from './suspension.js';
export const drivingIds=new Set(['02','09','03','20']);
export function normalizeSpeed(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(300,n)):0;}
export function seededRandom(seed){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function roadsideSite(side,cell,seed=73){
 const random=seededRandom(Math.imul(cell,73856093)^Math.imul(side,19349663)^seed);
 return {side,cell,jitter:(random()-.5)*12,setback:8+random()*8,width:8+random()*8,depth:9+random()*7,height:5+random()*18,treeScale:.8+random()*.7,treeOffset:(random()-.5)*10};
}
export class Driving {
 constructor(world,{speed=60,stiffness=50,onChange=()=>{}}={}){this.world=world;this.speed=normalizeSpeed(speed);this.suspension=new Suspension(stiffness);this.suspension.setAxles(world.car?.userData.vehicleSpec?.wheels);this.pendingDelta=0;this.playing=false;this.distance=0;this.last=null;this.frame=0;this.suspensions=new Set();this.onChange=onChange;this.tick=this.tick.bind(this);}
 get suspended(){return this.suspensions.size>0;}
 get supported(){return drivingIds.has(this.world.state?.id);}
 get running(){return this.playing&&this.speed>0&&this.supported&&!this.suspended&&!document.hidden&&!this.world.initializingScene;}
 get animating(){return this.playing&&this.supported&&!this.suspended&&!document.hidden&&!this.world.initializingScene&&(this.speed>0||this.suspension.active||this.pendingDelta!==0);}
 // Continuous input preserves the frame clock; sync() resets it when stopped.
 setSpeed(value){const speed=normalizeSpeed(value);if(this.playing&&this.supported&&!this.suspended&&!document.hidden&&!this.world.initializingScene)this.pendingDelta+=speed-this.speed;this.speed=speed;this.sync();return this.speed;}
 setSuspensionStiffness(value){const stiffness=this.suspension.setStiffness(value);if(this.world.state)this.world.renderFrame();this.sync();return stiffness;}
 play(){this.playing=true;this.last=null;this.sync();}
 pause(){this.playing=false;this.last=null;this.sync();}
 suspend(value,reason='manual'){if(value)this.suspensions.add(reason);else this.suspensions.delete(reason);this.last=null;this.sync();}
 reset(){this.distance=0;this.last=null;this.pendingDelta=0;this.suspension.reset();this.world.applyDrivingDistance?.(0);if(this.world.state)this.world.renderFrame();this.sync();}
 sync(){if(!this.supported){this.pendingDelta=0;this.suspension.reset();}this.onChange(this);if(this.animating&&!this.frame)this.frame=requestAnimationFrame(this.tick);if(!this.animating&&this.frame){cancelAnimationFrame(this.frame);this.frame=0;}if(!this.animating)this.last=null;}
 tick(now){
  this.frame=0;if(!this.animating){this.last=null;this.onChange(this);return;}
  const dt=this.last===null?0:Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;
  const w=this.world;
  // Leave shader preparation and scene construction exclusive access to rendering.
  if(w.preparedRoots.has(w.root)&&!w.layoutTransition){
   this.suspension.step(dt,this.pendingDelta);this.pendingDelta=0;
   this.distance+=this.speed/3.6*dt;w.applyDrivingDistance(this.distance);
   if(!w.cameraMotion&&!w.environmentMotion&&!w.layoutMotion&&!w.structureMotion)w.renderFrame(true);
  }
  this.onChange(this);if(this.animating)this.frame=requestAnimationFrame(this.tick);else this.last=null;
 }
 dispose(){cancelAnimationFrame(this.frame);this.frame=0;this.playing=false;}
}
