import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST_IDS,castIdForCustomer,castAnimation,castCell} from '../src/main/resources/static/js/game/game-cast-visuals.mjs';
import {standingPose} from '../src/main/resources/static/js/game/customer-gait.mjs';
test('appearance stays fixed throughout a visit, covers all eight identities and does not mutate simulation data',()=>{
 const seen=new Set();for(let i=0;i<128;i++){
  const c=Object.freeze({id:`customer-${i}`,variant:i%3,phase:'street'}),id=castIdForCustomer(c);seen.add(id);
  assert.ok(CAST_IDS.includes(id));assert.equal(castIdForCustomer({...c,phase:'checkout',variant:2}),id);
 }assert.equal(seen.size,8);assert.equal(castIdForCustomer({appearanceId:'slime'}),'slime');
 assert.ok(CAST_IDS.includes(castIdForCustomer({appearanceId:'invalid'})));
});
test('runtime maps moving routes to 16 frames, waiting to idle and interactions to reach',()=>{
 const c={phase:'waitingQueue',animationMs:150,route:[{x:1,y:1}],waypointIndex:0};
 assert.deepEqual(castAnimation(c),{pose:'walk',frame:3});
 assert.deepEqual(castAnimation({...c,waypointIndex:1}),{pose:'idle',frame:0});
 for(const phase of ['picking','checkout'])assert.deepEqual(castAnimation({...c,phase}),{pose:'reach',frame:0});
 assert.deepEqual(castAnimation({...c,animationMs:800}),{pose:'walk',frame:0});
 assert.deepEqual(castAnimation({...c,frame:1}),castAnimation({...c,frame:0}));
 assert.deepEqual(castCell('east',{pose:'walk',frame:15}),{x:1440,y:288});
 assert.deepEqual(castCell('west',{pose:'idle',frame:0}),{x:192,y:384});
 assert.deepEqual(castCell('south',{pose:'reach',frame:0}),{x:96,y:480});
});
test('stationary pose keeps both feet at ground level with equal bone lengths',()=>{
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 for(const direction of ['north','south','west','east'])for(const action of ['idle','reach']){
  const p=standingPose(direction,action);for(const leg of p.legs){assert.equal(leg.ankle.y,87);assert.equal(leg.ankle.z,0);assert.equal(leg.lift,0);assert.ok(Math.abs(distance(leg.hip,leg.knee)-13)<1e-8);assert.ok(Math.abs(distance(leg.knee,leg.ankle)-13)<1e-8);}
 }
});
