import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Independent cabin shell: the supplied exterior vehicle has opaque glazing.
// Window apertures remain clear; the body below and around them is solid.
// No steering wheel, dashboard or instrument cluster is modelled.
export function createDriverView(){
 const cabin=new THREE.Group();cabin.name='Driver cabin';cabin.visible=false;
 const trim=new THREE.MeshStandardMaterial({color:'#3b444d',roughness:.94,emissive:'#20262e',emissiveIntensity:.24});
 const liner=new THREE.MeshStandardMaterial({color:'#555d67',roughness:1});
 const inset=new THREE.MeshStandardMaterial({color:'#252c34',roughness:1,emissive:'#151b23',emissiveIntensity:.18});
 const seal=new THREE.MeshStandardMaterial({color:'#12171d',roughness:.96});
 const body=new THREE.MeshStandardMaterial({color:'#e1e6ed',roughness:.34,metalness:.16});
 const mesh=(geometry,material,name)=>{const part=new THREE.Mesh(geometry,material);part.name=name;cabin.add(part);return part;};
 const box=(w,h,d,x,y,z,material,name,radius=.025)=>{
  const part=mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/3,h/3,d/3)),material,name);part.position.set(x,y,z);return part;
 };
 const beam=(a,b,w,d,material,name,taper=1)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),length=start.distanceTo(end);
  const geometry=new RoundedBoxGeometry(w,length,d,3,.018),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){const scale=THREE.MathUtils.lerp(1,taper,(positions.getY(i)+length/2)/length);positions.setX(i,positions.getX(i)*scale);positions.setZ(i,positions.getZ(i)*scale);}
  const part=mesh(geometry,material,name);part.position.copy(start).add(end).multiplyScalar(.5);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return part;
 };
 // Solid side panels use the same continuous outline as the window belt.
 const sidePanel=(points,side,x,depth,material,name)=>{
  const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:2,steps:1});
  const part=mesh(geometry,material,name);part.rotation.y=Math.PI/2;part.position.x=side*x-depth/2;return part;
 };
 const tube=(points,radius,material,name)=>{
  const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));
  return mesh(new THREE.TubeGeometry(path,points.length*8,radius,6,false),material,name);
 };
 for(const side of [-1,1]){
  const lower=[side*.98,.855,-1.51],upper=[side*.84,1.68,-.64];
  beam(lower,upper,.095,.12,trim,'A pillar',.82);
  beam([side*.94,.88,-1.51],[side*.805,1.655,-.66],.023,.028,seal,'Windshield side seal',.9);
  // Overlap the pillar foot, front enclosure and sill: no open corner wedges.
  sidePanel([[-1.53,.20],[-1.53,.88],[-1.05,.97],[.95,.98],[1.12,.90],[1.12,.20]],side,1.025,.19,trim,'Door inner panel');
  sidePanel([[-1.35,.36],[-1.35,.78],[-.92,.88],[.94,.88],[1.00,.36]],side,.919,.014,inset,'Door panel inset');
  beam([side*.973,.895,-1.53],[side*1.015,1.005,-1.03],.065,.085,trim,'Window belt corner');
  box(.10,.075,2.12,side*1.015,.99,.02,trim,'Window belt rail',.018);
  sidePanel([[-1.55,.87],[-1.18,1.015],[-.97,.98],[-1.07,.90]],side,.986,.08,seal,'Mirror sail');
  box(.10,.09,1.90,side*.965,.75,.08,trim,'Door armrest',.025);
  box(.145,.12,2.20,side*.86,1.70,.39,liner,'Roof rail');
  box(.17,1.42,.15,side*.965,.99,1.08,trim,'B pillar');
 }
 box(2.05,.14,1.86,0,1.77,.20,liner,'Headliner');
 box(1.77,.115,.18,0,1.68,-.65,liner,'Windshield header');
 tube([[-.95,.88,-1.53],[-.805,1.64,-.67],[.805,1.64,-.67],[.95,.88,-1.53]],.012,seal,'Windshield perimeter seal');
 box(2.04,.13,2.85,0,.20,-.04,inset,'Floor pan');
 box(2.04,1.43,.15,0,.97,1.12,inset,'Rear enclosure');
 // An inclined body closure leads down into the footwell; keep the upper
 // edge low and narrow instead of introducing a tall dashboard-shaped wall.
 sidePanel([[-1.61,.19],[-1.61,.79],[-1.42,.81],[-.97,.27],[-1.07,.19]],1,0,2.02,inset,'Front bulkhead');
 box(2.00,.065,.16,0,.82,-1.49,trim,'Windshield cowl',.018);
 tube([[-.98,.855,-1.54],[0,.86,-1.54],[.98,.855,-1.54]],.011,seal,'Cowl weather seal');

 // Crown and taper the bonnet, with closed sides and underside instead of a
 // floating rectangular plate. Its rear edge overlaps the windshield cowl.
 const rings=[[-1.55,.97,.825],[-1.95,.96,.785],[-2.64,.88,.73]].map(([z,w,y])=>[
  [-w,y-.09,z],[w,y-.09,z],[w,y,z],[w*.78,y+.02,z],[w*.40,y+.045,z],[0,y+.05,z],[-w*.40,y+.045,z],[-w*.78,y+.02,z],[-w,y,z]
 ]);
 const positions=rings.flat(2),indices=[],count=rings[0].length;
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<count;i++){const a=r*count+i,b=r*count+(i+1)%count,c=a+count,d=b+count;indices.push(a,c,b,b,c,d);}
 for(let i=1;i<count-1;i++){indices.push(0,i,i+1);const end=(rings.length-1)*count;indices.push(end,end+i+1,end+i);}
 const hood=new THREE.BufferGeometry();hood.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));hood.setIndex(indices);hood.computeVertexNormals();mesh(hood,body,'Bonnet');
 cabin.userData={eye:[-.38,1.24,-.38],omits:['steering wheel','instrument cluster','dashboard']};return cabin;
}
