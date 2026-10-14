import * as THREE from 'three';

// A purpose-built open cabin: the delivery car has opaque glass and no interior.
// No wheel, dashboard or instrument cluster is modelled.
export function createDriverView(){
 const cabin=new THREE.Group();cabin.name='Driver cabin';cabin.visible=false;
 const trim=new THREE.MeshStandardMaterial({color:'#252a31',roughness:.92}),body=new THREE.MeshStandardMaterial({color:'#e1e6ed',roughness:.3,metalness:.16});
 const box=(w,h,d,x,y,z,material=trim,name='Cabin trim')=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);cabin.add(mesh);return mesh;};
 const beam=(a,b,width,name)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),mesh=box(width,start.distanceTo(end),width,0,0,0,trim,name);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());};
 for(const side of [-1,1]){
  beam([side*.96,.76,-1.50],[side*.78,1.69,-.48],.09,'A pillar');
  box(.11,.32,1.75,side*1.02,.72,-.40,trim,'Door sill');
  box(.14,.12,2.1,side*.82,1.71,.28,trim,'Roof rail');
 }
 box(1.68,.12,1.4,0,1.76,.40,trim,'Headliner');
 box(1.68,.08,.12,0,1.69,-.46,trim,'Windshield header');
 box(1.9,.07,1.05,0,.75,-2.02,body,'Bonnet');
 cabin.userData={eye:[-.38,1.24,-.38],omits:['steering wheel','instrument cluster','dashboard']};return cabin;
}
