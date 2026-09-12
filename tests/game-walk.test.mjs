import test from 'node:test';
import assert from 'node:assert/strict';
import * as art from '../src/main/resources/static/js/game/game-art.mjs';

test('all four directions have eight poses with equal fixed-length legs and a stable ground anchor',()=>{
  assert.equal(typeof art.characterPose,'function');
  for(const direction of ['north','south','west','east']) {
    const poses=Array.from({length:8},(_,i)=>art.characterPose(direction,i));
    for(const pose of poses) {
      assert.equal(pose.legs[0].height,pose.legs[1].height);
      assert.equal(pose.legs[0].height,5);
      assert.ok(pose.legs.every(leg=>leg.y+leg.height+2<=0),'shoe pixels never extend below the foot anchor');
    }
    assert.ok(new Set(poses.map(p=>JSON.stringify(p))).size>=6,'a complete gait, not two stretched frames');
    assert.deepEqual(art.characterPose(direction,8),poses[0],'loop seam wraps');
  }
});

test('a completed route stops feet while waiting customers with a route still walk',()=>{
  assert.equal(typeof art.characterAnimation,'function');
  const moving={phase:'waitingShelf',animationMs:250,route:[{x:1,y:1}],waypointIndex:0};
  assert.equal(art.characterAnimation(moving).pose,'walk');
  assert.equal(art.characterAnimation({...moving,waypointIndex:1}).pose,'idle');
  assert.equal(art.characterAnimation({...moving,phase:'checkout'}).pose,'reach');
  assert.equal(art.characterAnimation({...moving,phase:'picking'}).pose,'reach');
  assert.equal(art.characterAnimation({...moving,frame:1}).frame,art.characterAnimation({...moving,frame:0}).frame,'ignore old two-frame simulation field');
});

test('opposite profile directions mirror gait and PNG frame output uses whole pixel coordinates',()=>{
  assert.equal(typeof art.characterPose,'function');
  assert.equal(typeof art.drawCharacterFrame,'function');
  for(let frame=0;frame<8;frame++) {
    const west=art.characterPose('west',frame),east=art.characterPose('east',frame);
    assert.equal(west.legs[0].x,-east.legs[0].x-east.legs[0].width);
    const calls=[];
    const ctx={fillRect:(...args)=>calls.push(args)};
    art.drawCharacterFrame(ctx,'student','south',frame,16,34,1);
    assert.ok(calls.length>20);
    assert.ok(calls.flat().every(Number.isInteger));
    assert.ok(calls.every(([x,y,w,h])=>x>=0&&y>=0&&x+w<=32&&y+h<=40),'every frame fits the same transparent cell');
  }
});
