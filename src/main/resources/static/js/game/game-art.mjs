import {castAnimation,castCell} from './game-cast-visuals.mjs?v=20260909-live';
import {characterAnimation,drawCharacterFrame,spriteCell,CHARACTER_SPRITE} from './game-character.mjs?v=20260908-walk8';
export {characterAnimation,characterPose,drawCharacterFrame} from './game-character.mjs?v=20260908-walk8';
import { gameClock } from './game-config.mjs';

export const INK = '#39454d';
export const RED = '#c83235';
export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function label(ctx, text, x, y, size = 10, color = INK, align = 'left') {
  ctx.font = `bold ${size}px "Microsoft YaHei", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(x), Math.round(y));
}

const LIGHT = [
  [9, '#c6e5ee', '#d5d9d7', 0, 0.16],
  [12, '#b1dce9', '#d9ddda', 0, 0.12],
  [16, '#ecd7ad', '#d4d4cb', 0.02, 0.20],
  [18, '#efa68b', '#a49fad', 0.04, 0.24],
  [19, '#596b90', '#727e93', 0.07, 0.08],
  [21, '#243b5b', '#586a7e', 0.10, 0]
];
function blend(a, b, t) {
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i,i+2),16) * (1-t) + parseInt(b.slice(i,i+2),16) * t).toString(16).padStart(2,'0')).join('');
}
export function sceneEnvironment(state) {
  const clock = gameClock(state);
  const hour = state.dayBreak ? 21 : Math.max(9, Math.min(21, clock.hour + clock.minute / 60));
  let index = LIGHT.findIndex((entry, i) => i < LIGHT.length - 1 && hour <= LIGHT[i+1][0]);
  if (index < 0) index = LIGHT.length - 2;
  const a = LIGHT[index], b = LIGHT[index+1], t = (hour-a[0])/(b[0]-a[0]);
  return {
    season: ['spring','summer','autumn','winter'].includes(state.season?.id) ? state.season.id : 'spring',
    hour, clock: clock.clock, sky: blend(a[1],b[1],t), pavement: blend(a[2],b[2],t),
    interiorShade: state.dayBreak ? 0.16 : a[3] * (1-t) + b[3]*t,
    sunlight: a[4] * (1-t) + b[4]*t,
    lamp: Math.max(0, Math.min(1, (hour-17)/3))
  };
}

// Analytic particles: frame rate independent and reproducible in comparison screenshots.
export function weatherPixels(season, elapsedMs) {
  if (season === 'summer') return [];
  const color = { spring:'#f2b7ca', autumn:'#d5a144', winter:'#f7fcff' }[season] ?? '#f2b7ca';
  return Array.from({length:season === 'winter' ? 28 : 16}, (_, i) => {
    const window = i < 7;
    const travel = elapsedMs / (season === 'winter' ? 160 : 240);
    return {
      x: window ? 228 + (i*27 + Math.floor(travel/4))%180 : (i*137 + Math.floor(travel/3))%764,
      y: window ? 10 + (i*11+Math.floor(travel))%50 : 446 + (i*17+Math.floor(travel))%62,
      color
    };
  });
}

const PACKS = {
  candy: ['#d74769','#f6a9bd','#fff0d8'], chips: ['#d99a32','#f4ca61','#fff3b8'],
  seaweed: ['#326b56','#72a35f','#f5e3aa'], soda: ['#da7536','#f8be56','#f8f3d7'],
  cookies: ['#326b9d','#629ed0','#f3d68c'], jelly: ['#8863a9','#bf9dcc','#e4f0c7'],
  peanut: ['#a86b38','#d9a65d','#fff2cc'], marshmallow: ['#bf729a','#f1b8cb','#fff7ec'],
  latiao: ['#b23835','#e26743','#f7d080'], chocolate: ['#4a3645','#80616a','#ddc5a1']
};

export function drawProductIcon(ctx, id, x, y, size=18, width=size) {
  const p = PACKS[id] ?? PACKS.candy;
  const s = size/16, sx=width/16;
  const r = (a,b,w,h,c) => rect(ctx,x+a*sx,y+b*s,w*sx,h*s,c);
  if (id === 'soda') {
    r(6,0,5,2,INK); r(6,2,5,3,'#e8edf0'); r(4,5,9,11,p[0]);
    r(5,5,2,9,p[1]); r(4,9,9,4,p[2]); r(8,10,3,2,p[0]); r(5,15,7,1,'#995433');
  } else if (id === 'jelly') {
    r(2,4,12,2,p[2]); r(3,6,10,8,p[0]); r(4,7,3,6,p[1]); r(5,14,6,2,p[1]); r(8,9,3,3,p[2]);
  } else {
    r(2,0,12,16,INK); r(3,1,10,14,p[0]); r(3,1,10,2,p[1]); r(3,13,10,2,p[1]);
    r(4,3,1,9,p[1]); r(12,3,1,10,'#313a432e'); r(6,5,6,5,p[2]); r(7,4,4,7,p[2]);
    r(8,6,3,2,p[1]); r(7,10,4,1,p[0]); r(6,12,5,1,'#f9f7e9');
    if (id === 'seaweed') { r(7,5,3,5,'#285344'); r(10,7,1,4,'#4a7445'); }
    if (id === 'chocolate') { for (let a=0;a<2;a++) for(let b=0;b<3;b++) r(6+a*3,4+b*3,2,2,p[0]); }
    if (id === 'candy') { r(8,4,2,2,'#568456'); r(7,6,4,3,'#da5870'); }
    for(let i=0;i<4;i++) {r(4+i*2,1,1,1,'#fff7dd');r(4+i*2,14,1,1,p[0]);}
    if(id==='cookies'||id==='peanut') {r(8,6,1,1,p[0]);r(10,8,1,1,p[0]);r(7,9,1,1,p[0]);}
  }
}

export function drawCharacter(ctx,c,row=1,fallbackTime=0,atlas=null) {
  const cx=Math.round(c.x),cy=Math.round(c.y);
  const variant=c.role==='shopkeeper'?'shopkeeper':['student','neighbor','worker'][Math.max(0,Math.min(2,row-1))];
  const direction=CHARACTER_SPRITE.directions.includes(c.direction)?c.direction:'south';
  const animation=characterAnimation(c,fallbackTime);
  const r=(a,b,w,h,color)=>rect(ctx,cx+a*2,cy+b*2,w*2,h*2,color);
  r(-7,-2,14,3,'#89928b');r(-5,0,10,1,'#a0a59b');
  if(atlas?.layout==='cast') {
    const cell=castCell(direction,castAnimation(c,fallbackTime));
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(atlas.image,cell.x,cell.y,96,96,cx-36,cy-68,72,72);
  } else if(atlas) {
    const cell=spriteCell(direction,animation.frame,animation.pose);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(atlas,cell.x,cell.y,32,40,cx-32,cy-68,64,80);
  } else {
    drawCharacterFrame(ctx,variant,direction,animation.frame,cx,cy,2,animation.pose);
  }
  if(c.phase==='leaving'&&!c.angry) {r(6,-6,5,5,'#a87d4b');r(7,-5,3,3,'#e6ca91');r(7,-8,3,2,INK);}
  const statusOffset=atlas?.layout==='cast'&&atlas.id==='slime'?28:0;
  const mark=(a,b,w,h,color)=>r(a,b+statusOffset/2,w,h,color);
  if(c.vip) {mark(-5,-30,10,2,'#d8a132');mark(-5,-33,2,3,'#f6cf60');mark(-1,-34,2,4,'#f6cf60');mark(3,-33,2,3,'#f6cf60');}
  if(c.angry||c.phase==='outOfStock') {label(ctx,'!',cx+17,cy+statusOffset-59,14,RED);}
  if(['waitingShelf','waitingQueue','queueing'].includes(c.phase)&&c.maxPatienceMs) {
    const ratio=Math.max(0,1-(c.patienceMs??0)/c.maxPatienceMs);
    const barY=cy+statusOffset-(c.vip?78:64);
    if(ratio<0.9) {rect(ctx,cx-14,barY,28,5,INK);rect(ctx,cx-12,barY+1,24*ratio,2,ratio>0.5?'#77a56b':ratio>0.25?'#ebbc54':RED);}
  }
  if(c.phase==='checkout'&&c.checkoutDurationMs) {
    const ratio=Math.max(0,Math.min(1,(c.phaseMs??0)/c.checkoutDurationMs));
    const ringY=cy+statusOffset-(c.vip?84:70);
    ctx.beginPath();ctx.arc(cx,ringY,9,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio);
    ctx.strokeStyle='#bd8930';ctx.lineWidth=3;ctx.stroke();label(ctx,'¥',cx,ringY,9,'#855c26','center');
  }
}

export function drawTree(ctx,x,y,season) {
  rect(ctx,x-22,y-4,48,8,'#929f98');
  rect(ctx,x-17,y-11,34,12,'#68776f');rect(ctx,x-15,y-10,30,7,'#b4beb0');
  rect(ctx,x-3,y-52,6,43,'#665747');rect(ctx,x-1,y-52,2,38,'#9a8059');
  const winter=season==='winter';
  const colors=season==='autumn'?['#aa7131','#d69738','#efc35a']:season==='spring'?['#5d965c','#8eb666','#b7ce83']:['#397b5c','#559764','#84b778'];
  for(let i=0;i<6;i++) {
    const dx=[-22,-10,4,-27,-4,16][i], dy=[-59,-72,-67,-45,-48,-50][i];
    if(winter) {
      rect(ctx,x+dx/2,y+dy+9,Math.abs(dx/2)+3,3,'#796751');
      rect(ctx,x+dx/2,y+dy+7,12,2,'#f4fbff');
    } else {
      rect(ctx,x+dx,y+dy,24,18,colors[0]);rect(ctx,x+dx+2,y+dy-4,18,8,colors[1]);
      rect(ctx,x+dx+4,y+dy,12,6,colors[2]);rect(ctx,x+dx+10,y+dy+11,12,5,colors[1]);
      for(let j=0;j<7;j++) {
        const lx=(i*7+j*11)%22,ly=(i*3+j*7)%18;
        rect(ctx,x+dx+lx,y+dy+ly,2+(j%2)*2,2,colors[(j+i)%3]);
      }
      if(season==='spring'&&i%2===0) {rect(ctx,x+dx+6,y+dy+4,4,4,'#f3c2cc');rect(ctx,x+dx+14,y+dy+10,4,2,'#f8ded5');}
    }
  }
  if(winter) {rect(ctx,x-17,y-12,34,4,'#f5fbfc');rect(ctx,x-22,y,40,3,'#e8f1f5');}
}
