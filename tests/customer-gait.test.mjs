import test from 'node:test';
import assert from 'node:assert/strict';
import {walkPose,projectJoint} from '../src/main/resources/static/js/game/customer-gait.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
test('both legs preserve their bone lengths across the complete loop',()=>{
 for(const direction of ['north','south','west','east']) for(let i=0;i<=128;i++){
  const p=walkPose(direction,i/128);
  for(const leg of p.legs){assert.ok(Math.abs(distance(leg.hip,leg.knee)-13)<1e-8);assert.ok(Math.abs(distance(leg.knee,leg.ankle)-13)<1e-8);assert.ok(leg.ankle.y<=87.001);}
 }
});
test('side feet recover forwards in the air and push backwards on the ground',()=>{
 for(const direction of ['west','east']) for(let frame=0;frame<16;frame++){
  const a=walkPose(direction,frame/16),b=walkPose(direction,(frame+1)/16),mid=walkPose(direction,(frame+.5)/16);
  for(let i=0;i<2;i++){
   const start=projectJoint(a.legs[i].ankle,direction),end=projectJoint(b.legs[i].ankle,direction);
   const forward=(end.x-start.x)*(direction==='east'?1:-1);
   if(mid.legs[i].lift>0.001)assert.ok(forward>0,`${direction} frame ${frame}: raised foot must travel towards facing direction`);
   else {assert.ok(forward<0,`${direction} frame ${frame}: planted foot must travel backwards relative to torso`);assert.equal(a.legs[i].ankle.y,87);}
  }
 }
});
test('cycle closes continuously, alternates support, and passes beneath the hips',()=>{
 for(const d of ['north','south','west','east']){
  assert.deepEqual(walkPose(d,0),walkPose(d,1));
  for(let i=0;i<16;i++){
   const a=walkPose(d,i/16),b=walkPose(d,(i+1)/16);
   a.legs.forEach((leg,j)=>assert.ok(distance(leg.ankle,b.legs[j].ankle)<5));
  }
 }
 const a=walkPose('east',.125),b=walkPose('east',.625);
 assert.equal(a.legs[0].lift,b.legs[1].lift);assert.ok(a.legs[0].lift!==a.legs[1].lift);
 const passing=walkPose('east',.25);assert.ok(Math.abs(passing.legs[0].ankle.z-passing.legs[1].ankle.z)<1);
});
