import {walkPose,standingPose,projectJoint} from './customer-gait.mjs?v=20260909-live';
const directions=['north','south','west','east'];
// Runtime texture regions use the original transparent artwork without rewriting it.
// The same head and jacket are reused for every pose to avoid identity/scale flicker.
export function createCustomerRig(image,options={}){
 const cells=options.cells??directions.map((_,row)=>{
  const canvas=document.createElement('canvas');canvas.width=222;canvas.height=222;
  canvas.getContext('2d').drawImage(image,0,Math.round(row*image.height/4),Math.round(image.width/8),Math.round(image.height/4),0,0,222,222);
  return canvas;
 });
 const layer=(source,polygon)=>{const c=document.createElement('canvas');c.width=c.height=222;const ctx=c.getContext('2d');ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.drawImage(source,0,0);return c;};
 const torsos=cells.map((c,row)=>layer(c,options.neutral
  ?(row<2?[[0,0],[222,0],[222,94],[148,94],[144,124],[140,150],[110,150],[106,124],[102,94],[0,94]]:[[0,0],[222,0],[222,94],[141,94],[133,108],[132,150],[105,150],[105,108],[108,94],[0,94]])
  :(row<2?[[0,0],[222,0],[222,88],[149,88],[150,150],[100,150],[98,88],[0,88]]:[[0,0],[222,0],[222,89],[143,89],[143,150],[104,150],[105,89],[0,89]])));
 // Uniform pant texture; the joints carry geometry and never stretch a whole leg.
 const pant=cells[1],shoe=cells[1];
 return function draw(ctx,direction,phase,action='walk'){
  // Use the exact same side silhouette in both directions, including its arm cutout.
  if(direction==='east'){ctx.save();ctx.translate(96,0);ctx.scale(-1,1);draw(ctx,'west',phase,action);ctx.restore();return;}
  const row=directions.indexOf(direction),side=row>1,pose=action==='walk'?walkPose(direction,phase):standingPose(direction,action),cell=cells[row];
  ctx.imageSmoothingEnabled=false;
  const limb=(a,b,width,far)=>{
   const angle=Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2,len=Math.hypot(b.x-a.x,b.y-a.y);
   ctx.save();ctx.translate(a.x,a.y);ctx.rotate(angle);
   ctx.drawImage(pant,106,153,13,16,-width/2,-.5,width,len+1);
   if(far){ctx.fillStyle='rgba(18,26,39,.18)';ctx.fillRect(-width/2,0,width,len+1);}
   ctx.restore();
  };
  const order=side?(direction==='east'?[0,1]:[1,0]):[0,1];
  for(const i of order){const leg=pose.legs[i],hip=projectJoint(leg.hip,direction),knee=projectJoint(leg.knee,direction),ankle=projectJoint(leg.ankle,direction);const far=side&&i===order[0];
   ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=7;ctx.strokeStyle='#25242b';ctx.beginPath();ctx.moveTo(hip.x,hip.y);ctx.lineTo(knee.x,knee.y);ctx.lineTo(ankle.x,ankle.y);ctx.stroke();ctx.restore();
   limb(hip,knee,5,far);limb(knee,ankle,4.5,far);
   ctx.save();ctx.translate(Math.round(ankle.x),Math.round(ankle.y));if(direction==='west')ctx.scale(-1,1);
   ctx.drawImage(shoe,98,198,25,16,-5,-2,10,6);ctx.restore();
  }
  const s=.375,baseX=48-125*s,baseY=62.2-145*s+pose.bob;
  if(side){
   // A neutral sleeve gives equal forward/backward travel about the shoulder.
   // Far arm sits behind the jacket; near arm must cross in front of it.
   const arm=(legIndex,shoulderX)=>{
    ctx.save();ctx.translate(baseX+shoulderX*s,baseY+99*s);
    ctx.rotate(Math.atan2(6,44)+pose.legs[legIndex].armSwing*(.65/.28));
    ctx.drawImage(cells[1],146,94,25,56,-4*s,-5*s,25*s,56*s);ctx.restore();
   };
   arm(1,122);
   ctx.drawImage(torsos[row],baseX,baseY,222*s,222*s);
   arm(0,128);
  }else{
   const arms=[{x:82,y:94,w:25,h:56,pivotX:101,pivotY:99},{x:146,y:94,w:25,h:56,pivotX:150,pivotY:99}];
   arms.forEach((arm,i)=>{ctx.save();ctx.translate(baseX+arm.pivotX*s,baseY+arm.pivotY*s);ctx.rotate(pose.legs[i].armSwing*.65);ctx.drawImage(cell,arm.x,arm.y,arm.w,arm.h,(arm.x-arm.pivotX)*s,(arm.y-arm.pivotY)*s,arm.w*s,arm.h*s);ctx.restore();});
   ctx.drawImage(torsos[row],baseX,baseY,222*s,222*s);
  }
 };
}
