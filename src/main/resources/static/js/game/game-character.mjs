// Original pixel artwork. The PNG exporter and runtime fallback share these exact frames.
export const CHARACTER_SPRITE = Object.freeze({width:32,height:40,anchorX:16,anchorY:34,frames:8,frameMs:80,directions:['north','south','west','east']});
export const CHARACTER_PALETTES = Object.freeze({
  shopkeeper:{hair:'#49342f',shine:'#77503a',top:'#b93239',light:'#e66558',pants:'#38404b',skin:'#edbb91'},
  student:{hair:'#303641',shine:'#505061',top:'#37658a',light:'#7a9ab2',pants:'#394456',skin:'#e8b795'},
  neighbor:{hair:'#574134',shine:'#856045',top:'#6c8569',light:'#a8b98b',pants:'#695864',skin:'#edc49f'},
  worker:{hair:'#363039',shine:'#59515a',top:'#c2bba7',light:'#f0e6ce',pants:'#465467',skin:'#dca982'}
});
const INK='#39454d';
const STRIDE=[-2,-1,0,1,2,1,0,-1];
const LIFT_A=[0,0,1,1,0,0,0,0],LIFT_B=[0,0,0,0,0,0,1,1];
export function characterPose(direction,frame=0,pose='walk') {
  const i=((Math.floor(frame)%8)+8)%8,walking=pose==='walk';
  const side=direction==='east'||direction==='west';
  const stride=walking?STRIDE[i]:0;
  const lifts=walking&&!side?[LIFT_A[i],LIFT_B[i]]:[0,0];
  let xs=side?[-2+stride,-2-stride]:[-5,2];
  if(direction==='west') xs=xs.map(x=>-x-3);
  return {
    side,direction,pose,
    bob:walking&&[1,2,5,6].includes(i)?-1:0,
    arms:walking?[stride,-stride]:[0,0],
    legs:xs.map((x,j)=>({x,y:-7-lifts[j],width:3,height:5,lift:lifts[j]}))
  };
}
export function characterAnimation(c,time=0) {
  if(c.phase==='picking'||c.phase==='checkout') return {pose:'reach',frame:0};
  const canWalk=['street','entering','browsing','queueing','waitingShelf','waitingQueue','leaving'].includes(c.phase);
  const hasRoute=!Array.isArray(c.route)||(c.waypointIndex??0)<c.route.length;
  const moving=canWalk&&hasRoute;
  return {pose:moving?'walk':'idle',frame:moving?Math.floor(Math.max(0,c.animationMs??time)/CHARACTER_SPRITE.frameMs)%8:0};
}
export function spriteCell(direction,frame=0,pose='walk') {
  const d=Math.max(0,CHARACTER_SPRITE.directions.indexOf(direction));
  return pose==='walk'?{x:((Math.floor(frame)%8+8)%8)*32,y:d*40}:{x:d*32,y:(pose==='reach'?5:4)*40};
}

export function drawCharacterFrame(ctx,variant='student',direction='south',frame=0,x=16,y=34,scale=1,pose='walk') {
  const p=CHARACTER_PALETTES[variant]??CHARACTER_PALETTES.student;
  const gait=characterPose(direction,frame,pose),north=direction==='north',side=gait.side;
  const r=(a,b,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x+a*scale),Math.round(y+b*scale),w*scale,h*scale);};
  const body=(a,b,w,h,color)=>r(a,b+gait.bob,w,h,color);
  // Whole five-pixel legs translate. Never change a limb's height to simulate walking.
  gait.legs.forEach((leg,index)=>{
    r(leg.x,leg.y,leg.width,leg.height,INK);
    r(leg.x+1,leg.y,1,leg.height,index===0&&side?'#303a49':p.pants);
    r(leg.x-1,leg.y+leg.height,5,2,index===0&&side?'#303740':'#444b55');
    r(leg.x,leg.y+leg.height,3,1,index===0&&side?'#3e4d58':'#697983');
  });
  const arm=(a,offset,far=false)=>{
    const b=pose==='reach'?-17:-14+Math.sign(offset);
    body(a,b,3,6,INK);body(a+1,b+1,2,3,far?'#435b65':p.top);body(a+1,b+4,2,2,p.skin);
  };
  if(side) arm(direction==='east'?-3:1,gait.arms[1],true);
  else arm(-8,gait.arms[0]);
  body(side?-4:-6,-15,side?9:12,10,INK);
  body(side?-3:-5,-14,side?7:10,8,p.top);body(-3,-13,2,6,p.light);
  body(3,-13,1,6,INK);body(-4,-6,8,1,INK);body(-2,-15,4,2,p.skin);body(-2,-13,4,1,p.light);
  if(variant==='shopkeeper'){body(-4,-12,8,6,'#c53239');body(-2,-10,4,2,'#f9e6d1');}
  if(north&&variant==='student'){body(-4,-14,8,7,'#384451');body(-3,-13,6,5,'#9b7e51');body(-2,-11,4,1,'#ceb77c');}
  if(side) arm(direction==='east'?3:-6,gait.arms[0]);else arm(6,gait.arms[1]);
  // A single coherent head moves with the torso, not independently on a stretched neck.
  body(-5,-27,10,1,p.hair);body(-6,-26,12,2,p.hair);body(-7,-24,14,8,p.hair);
  body(-6,-16,12,1,p.hair);body(-4,-15,8,1,p.hair);
  body(-5,-23,10,7,p.skin);body(-4,-16,8,1,p.skin);
  body(-6,-25,12,3,p.hair);body(-4,-26,5,1,p.shine);body(-6,-24,2,6,p.hair);
  body(-3,-23,3,1,p.hair);body(2,-23,3,2,p.hair);body(5,-24,1,6,p.hair);
  if(north){body(-6,-25,12,9,p.hair);body(-4,-25,5,2,p.shine);body(-6,-19,2,2,p.shine);}
  else if(side){
    const east=direction==='east';
    body(east?-6:1,-24,5,8,p.hair);body(east?3:-5,-21,2,2,INK);body(east?3:-5,-21,1,1,'#fff5db');
    body(east?5:-7,-19,2,2,p.skin);body(east?3:-5,-18,2,1,'#d99789');
  }else{
    body(-4,-21,2,2,INK);body(2,-21,2,2,INK);body(-4,-21,1,1,'#fff7e2');body(2,-21,1,1,'#fff7e2');
    body(-5,-18,2,1,'#df9c91');body(3,-18,2,1,'#df9c91');body(-1,-17,2,1,'#b9766b');
  }
  if(variant==='worker'&&!north&&!side){body(-5,-22,5,4,'#51505a');body(1,-22,5,4,'#51505a');body(-4,-21,3,2,p.skin);body(2,-21,3,2,p.skin);body(0,-21,1,1,'#51505a');body(-3,-21,1,1,INK);body(3,-21,1,1,INK);}
}
