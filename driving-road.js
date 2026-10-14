import * as THREE from 'three';
import {roadsideSite} from './driving.js';

const SPACING=32,COUNT=20,BACK=100;
export function buildDrivingRoad(world,width,deck,{highway=false}={}){
 const {root}=world,data={width,deck,highway,pool:[],dashes:[],distance:0};world.drivingRoad=data;
 const start=180,end=-800;
 if(highway){
  const lanes=7.4,shoulder=3,innerShoulder=.5,median=3,outer=median/2+innerShoulder+lanes+shoulder;
  for(const side of [-1,1]){
   world.road(side*(median/2+(innerShoulder+lanes+shoulder)/2),innerShoulder+lanes+shoulder,start,end,0);
   for(const x of [2,9.4,outer-.2])world.line(side*x,start,end,0,'white',.15);
   world.dashed(side*5.7,start,end);
   world.box(.14,.65,start-end,side*(outer+.35),.65,(start+end)/2,'curb');
  }
  world.box(median,.3,start-end,0,.12,(start+end)/2,'pavement');
  world.dividedRoad={lanesPerDirection:2,travelLanes:4,laneWidth:3.7,medianWidth:median,safetyLanes:2,safetyLaneWidth:shoulder,markings:'white',egoCenter:7.55,directions:2};
  data.width=outer*2;
 }else{
  world.road(0,width,start,end,deck);world.marks(width,3.7,start,end,deck,deck===0,deck===0);
  if(deck===0)world.curbs(width,start,end,deck);
  else{
   // The bridge's uniform deck stays continuous; only its repeated supports move.
   const median=1.6,opposite=-(width+median),total=width*2+median,center=opposite/2;
   world.road(opposite,width,start,end,deck);
   const before=root.children.length;world.marks(width,3.7,start,end,deck,false,false);
   for(const mesh of root.children.slice(before)){mesh.position.x+=opposite;mesh.userData.laneOffset=undefined;}
   for(const x of [width/2-.25,-width/2+.25,opposite+width/2-.25,opposite-width/2+.25])world.line(x,start,end,deck);
   world.box(total+.6,.95,start-end,center,deck-.48,(start+end)/2,'curb').castShadow=false;
   for(const x of [width/2+.12,opposite-width/2-.12,center])world.box(.24,.65,start-end,x,deck+.31,(start+end)/2,'curb').castShadow=false;
   world.dividedRoad={lanesPerDirection:3,medianWidth:median,oppositeCenter:opposite,egoCenter:0,directions:2};
   data.width=total;data.center=center;
  }
 }
 for(const side of [-1,1])for(let index=0;index<COUNT;index++){
  const group=new THREE.Group(),before=root.children.length;
  world.building(0,0,10,12,14,index%3);
  const placement=world.buildingPlacements.at(-1);
  for(const mesh of root.children.slice(before)){mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.shoreSide=side;group.add(mesh);}
  root.add(group);
  world.tree(0,0);const tree=world.vegetation.children.at(-1);
  const lawn=world.plane(5,18,0,0,.025,'grass');world.lawns.push(lawn);
  data.pool.push({index,side,group,tree,lawn,placement,cell:null});
 }
 // Shared buffers with a moving phase preserve the 10 m dash rhythm at wrap.
 data.dashes=root.children.filter(mesh=>mesh.userData.laneDash);
 if(deck>0){
  data.supports=[];
  for(let i=0;i<14;i++){
   const group=new THREE.Group(),before=root.children.length;
   world.box(data.width-2,.8,2.6,data.center,deck-1.3,0,'building').castShadow=false;
   for(const side of [-1,1])world.box(1.65,deck-1.7,1.9,data.center+side*6,(deck-1.7)/2,0,'building').castShadow=false;
   for(const mesh of root.children.slice(before))group.add(mesh);root.add(group);data.supports.push(group);
  }
 }
 updateDrivingRoad(world,0);
}

export function updateDrivingRoad(world,distance){
 const data=world.drivingRoad;if(!data)return;
 data.distance=distance;
 const baseCell=Math.floor((distance-BACK)/SPACING),center=data.center||0;
 for(const item of data.pool){
  // Each fixed slot receives a new site only after leaving the rear of the view.
  const cell=baseCell+((item.index-baseCell)%COUNT+COUNT)%COUNT;
  if(item.cell!==cell){
   item.cell=cell;item.site=roadsideSite(item.side,cell);
   const s=item.site,x=center+item.side*(data.width/2+s.setback+s.width/2);
   item.group.position.x=x;item.group.scale.set(s.width/10,s.height/14,s.depth/12);
   item.tree.position.x=center+item.side*(data.width/2+3.4);item.tree.scale.setScalar(s.treeScale);
   item.lawn.position.x=item.tree.position.x;item.lawn.scale.y=(s.depth+8)/18;
   item.placement.x=x;item.placement.width=s.width;item.placement.depth=s.depth;
  }
  const z=distance-item.cell*SPACING+item.site.jitter;
  item.group.position.z=z;item.tree.position.z=z+item.site.treeOffset;item.lawn.position.z=z;item.placement.z=z;
 }
 for(const dash of data.dashes)dash.position.z=(dash.userData.drivingBaseZ??=dash.position.z)+distance%10;
 data.supports?.forEach((group,i)=>{group.position.z=100-((i*45-distance)%630+630)%630;});
}
