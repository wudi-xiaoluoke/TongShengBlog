// One complete stride, not independent generated pictures. Units are logical pixels.
export const GAIT_FRAMES=16,GAIT_DURATION=800;
export function walkPose(direction,phase){
 const t=((phase%1)+1)%1;
 const legs=[0,1].map(i=>{
  const u=(t+i*.5)%1,angle=u*Math.PI*2;
  const lift=5*Math.max(0,Math.sin(angle));
  const hip={x:i?5:-5,y:62.2+.4*Math.cos(t*Math.PI*4),z:0};
  // +z faces forward: recover rear -> front while raised, push front -> rear grounded.
  const ankle={x:hip.x,y:87-lift,z:-8*Math.cos(angle)};
  const dy=ankle.y-hip.y,dz=ankle.z,distance=Math.hypot(dy,dz);
  const bend=Math.sqrt(13**2-(distance/2)**2);
  const knee={x:hip.x,y:hip.y+dy/2-dz/distance*bend,z:dz/2+dy/distance*bend};
  return {hip,knee,ankle,lift,armSwing:Math.cos(angle)*.28};
 });
 return {direction,phase:t,bob:.4*Math.cos(t*Math.PI*4),legs};
}
export function projectJoint(point,direction){
 const side=direction==='east'||direction==='west';
 return {x:48+(side?point.z*(direction==='east'?1:-1)+point.x*.14:point.x),y:point.y};
}
export function standingPose(direction,action='idle'){
 const legs=[0,1].map(i=>{
  const hip={x:i?5:-5,y:62.2,z:0},ankle={x:hip.x,y:87,z:0};
  const half=(ankle.y-hip.y)/2;
  const knee={x:hip.x,y:hip.y+half,z:Math.sqrt(13**2-half**2)};
  return {hip,knee,ankle,lift:0,armSwing:action==='reach'?(i?-.1:.36):0};
 });
 return {direction,phase:0,bob:0,legs};
}
