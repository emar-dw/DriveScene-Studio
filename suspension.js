const DEG=Math.PI/180,MAX_ANGLE=3*DEG,MAX_STEP=1/960,MAX_VELOCITY=300*.014;
const PROGRESSION=4,BUMP_START=.65,BUMP_STRENGTH=600,COMPRESSION_DAMPING=.72,REBOUND_DAMPING=1.08;
export function normalizeStiffness(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;}

// Cubic springs stiffen with travel; a smooth bump stop starts at 65% travel.
// Damping follows tangent stiffness, with a more controlled rebound than compression.
function angularAcceleration(angle,velocity,omega){
 const travel=Math.abs(angle)/MAX_ANGLE,bumpTravel=Math.max(0,(travel-BUMP_START)/(1-BUMP_START));
 const bump=BUMP_STRENGTH*bumpTravel**3;
 const tangent=1+3*PROGRESSION*travel*travel+bump+travel*3*BUMP_STRENGTH*bumpTravel*bumpTravel/(1-BUMP_START);
 const damping=angle*velocity>=0?COMPRESSION_DAMPING:REBOUND_DAMPING;
 return -omega*omega*angle*(1+PROGRESSION*travel*travel+bump)-2*damping*omega*Math.sqrt(tangent)*velocity;
}

// Delta-v impulses excite the springs. Summing samples per frame avoids making
// the response depend on the sender's packet count. Separate channels
// retain their own axle pivots when acceleration changes directly into braking.
export class Suspension {
 constructor(stiffness=50){this.stiffness=normalizeStiffness(stiffness);this.acceleration={angle:0,velocity:0};this.braking={angle:0,velocity:0};this.setAxles([]);}
 setAxles(wheels=[]){
  const centers=kind=>wheels.filter(w=>w.position?.includes(kind)&&w.min?.length===3&&w.max?.length===3).map(w=>({z:(w.min[2]+w.max[2])/2,y:(w.min[1]+w.max[1])/2}));
  const front=centers('front'),rear=centers('rear'),mean=(list,key,fallback)=>list.length?list.reduce((n,p)=>n+p[key],0)/list.length:fallback;
  this.accelerationPivotZ=mean(front,'z',-1.547);this.brakingPivotZ=mean(rear,'z',1.3605);this.pivotHeight=mean([...front,...rear],'y',.346);
  this.accelerationPivotHeight=mean(front,'y',this.pivotHeight);this.brakingPivotHeight=mean(rear,'y',this.pivotHeight);
 }
 get strength(){return 1-this.stiffness/100;}
 get active(){return this.strength>0&&[this.acceleration,this.braking].some(s=>s.angle!==0||s.velocity!==0);}
 setStiffness(value){this.stiffness=normalizeStiffness(value);if(this.stiffness===100)this.reset();return this.stiffness;}
 reset(){for(const s of [this.acceleration,this.braking]){s.angle=0;s.velocity=0;}}
 step(dt,deltaKmh=0){
  if(!this.strength){this.reset();return;}
  const omega=4+this.stiffness*.05;
  if(Number.isFinite(deltaKmh)&&deltaKmh){const s=deltaKmh>0?this.acceleration:this.braking;s.velocity=Math.min(MAX_VELOCITY,s.velocity+Math.abs(deltaKmh)*.014);}
  if(!Number.isFinite(dt)||dt<=0)return;
  const steps=Math.ceil(dt/MAX_STEP),h=dt/steps;
  for(const s of [this.acceleration,this.braking]){
   if(s.angle===0&&s.velocity===0)continue;
   // RK4 substeps keep the nonlinear response stable across browser frame rates.
   for(let i=0;i<steps;i++){
    const x=s.angle,v=s.velocity,a=angularAcceleration(x,v,omega);
    const vb=v+a*h/2,b=angularAcceleration(x+v*h/2,vb,omega);
    const vc=v+b*h/2,c=angularAcceleration(x+vb*h/2,vc,omega);
    const vd=v+c*h,d=angularAcceleration(x+vc*h,vd,omega);
    s.angle=x+h*(v+2*vb+2*vc+vd)/6;
    s.velocity=v+h*(a+2*b+2*c+d)/6;
    // Last-resort bounds for repeated extreme impulses, beyond normal bump-stop travel.
    if(s.angle>MAX_ANGLE){s.angle=MAX_ANGLE;s.velocity=Math.min(0,s.velocity);}
    if(s.angle<0){s.angle=0;s.velocity=Math.max(0,s.velocity);}
   }
   if(s.angle<.00001&&Math.abs(s.velocity)<.0001){s.angle=0;s.velocity=0;}
  }
 }
 getState(){const accelerationAngle=this.acceleration.angle*this.strength,brakingAngle=-this.braking.angle*this.strength;return {stiffness:this.stiffness,pitchDegrees:(accelerationAngle+brakingAngle)/DEG,accelerationAngle,brakingAngle,accelerationPivotZ:this.accelerationPivotZ,brakingPivotZ:this.brakingPivotZ,accelerationPivotHeight:this.accelerationPivotHeight,brakingPivotHeight:this.brakingPivotHeight,pivotHeight:this.pivotHeight};}
}
