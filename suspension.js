const DEG=Math.PI/180,MAX_ANGLE=3*DEG;
export function normalizeStiffness(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;}

// Delta-v impulses drive critically damped springs. Summing samples per frame
// makes the response independent of the sender's packet rate. Separate channels
// retain their own axle pivots when acceleration changes directly into braking.
export class Suspension {
 constructor(stiffness=50){this.stiffness=normalizeStiffness(stiffness);this.acceleration={angle:0,velocity:0};this.braking={angle:0,velocity:0};this.setAxles([]);}
 setAxles(wheels=[]){
  const centers=kind=>wheels.filter(w=>w.position?.includes(kind)&&w.min?.length===3&&w.max?.length===3).map(w=>({z:(w.min[2]+w.max[2])/2,y:(w.min[1]+w.max[1])/2}));
  const front=centers('front'),rear=centers('rear'),mean=(list,key,fallback)=>list.length?list.reduce((n,p)=>n+p[key],0)/list.length:fallback;
  this.accelerationPivotZ=mean(front,'z',-1.547)+.22;this.brakingPivotZ=mean(rear,'z',1.3605)-.22;this.pivotHeight=mean([...front,...rear],'y',.346);
 }
 get strength(){return 1-this.stiffness/100;}
 get active(){return this.strength>0&&[this.acceleration,this.braking].some(s=>s.angle!==0||s.velocity!==0);}
 setStiffness(value){this.stiffness=normalizeStiffness(value);if(this.stiffness===100)this.reset();return this.stiffness;}
 reset(){for(const s of [this.acceleration,this.braking]){s.angle=0;s.velocity=0;}}
 step(dt,deltaKmh=0){
  if(!this.strength){this.reset();return;}
  const omega=4+this.stiffness*.05;
  if(deltaKmh){const s=deltaKmh>0?this.acceleration:this.braking;s.velocity=Math.min(omega*Math.E*MAX_ANGLE,s.velocity+Math.abs(deltaKmh)*.014);}
  const decay=Math.exp(-omega*dt);
  for(const s of [this.acceleration,this.braking]){
   const c=s.velocity+omega*s.angle;
   s.angle=(s.angle+c*dt)*decay;s.velocity=(s.velocity-omega*c*dt)*decay;
   if(s.angle>MAX_ANGLE){s.angle=MAX_ANGLE;s.velocity=Math.min(0,s.velocity);}
   if(s.angle<.00001&&Math.abs(s.velocity)<.0001){s.angle=0;s.velocity=0;}
  }
 }
 getState(){const accelerationAngle=this.acceleration.angle*this.strength,brakingAngle=-this.braking.angle*this.strength;return {stiffness:this.stiffness,pitchDegrees:(accelerationAngle+brakingAngle)/DEG,accelerationAngle,brakingAngle,accelerationPivotZ:this.accelerationPivotZ,brakingPivotZ:this.brakingPivotZ,pivotHeight:this.pivotHeight};}
}
