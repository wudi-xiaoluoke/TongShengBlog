import test from 'node:test';
import assert from 'node:assert/strict';
import {slimePose} from '../src/main/resources/static/js/game/customer-slime.mjs';
test('slime hop closes cleanly, keeps its volume and never goes below ground',()=>{
 assert.deepEqual(slimePose(0),slimePose(1));
 const poses=Array.from({length:16},(_,i)=>slimePose(i/16));
 assert.ok(poses.some(p=>p.lift>7));assert.ok(poses.some(p=>p.scaleY<1));
 for(const p of poses){assert.ok(Math.abs(p.scaleX*p.scaleY-1)<1e-9);assert.ok(p.lift>=0);assert.ok(p.scaleY>.7&&p.scaleY<1.3);}
 for(let i=0;i<16;i++)assert.ok(Math.abs(poses[i].lift-poses[(i+1)%16].lift)<4);
});
