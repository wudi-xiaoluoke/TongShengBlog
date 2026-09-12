import {CAST_IDS,castIdForCustomer} from './game-cast-visuals.mjs?v=20260909-live';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PRODUCTS, GROUPS_PER_CABINET, SLOTS_PER_GROUP, shopPlanogram, unitsPerSlot, productCapacity } from './game-config.mjs';
import { shelfDisplayState } from './game-state.mjs';
import { CHECKOUT_COUNTER, SHOPKEEPER_POINT, buildWorld } from './game-world.mjs';
import { rect as r, label, RED, INK, drawTree, drawCharacter, drawProductIcon, sceneEnvironment, weatherPixels } from './game-art.mjs?v=20260909-live';
export { drawCharacter, drawProductIcon, sceneEnvironment, weatherPixels };

// One coordinate system for drawing, hit testing, routes, seasons and all day phases.
const ROOM = Object.freeze({ wall:84, floor:428, sidewalk:444, road:478, door:612, doorWidth:88 });
export function canvasPointFromEvent(canvas, event) {
  const b=canvas.getBoundingClientRect();
  return {x:(event.clientX-b.left)/b.width*CANVAS_WIDTH,y:(event.clientY-b.top)/b.height*CANVAS_HEIGHT};
}
export async function loadGameAssets() {
  const entries=await Promise.all(CAST_IDS.map(name=>new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>image.naturalWidth===1536&&image.naturalHeight===576
      ?resolve([name,{image,layout:'cast',id:name}]):reject(new Error(`角色图集尺寸错误：${name}`));
    image.onerror=()=>reject(new Error(`角色图集加载失败：${name}`));
    image.src=new URL(`../../images/game/cast/${name}/game-atlas.png?v=20260909-live`,import.meta.url).href;
  })));
  return {characters:Object.fromEntries(entries)};
}

/** Allocate real on-shelf units once across all physical slots (never duplicate stock). */
export function shelfDisplayCells(state, plan=shopPlanogram(state)) {
  const capacity=unitsPerSlot(state);
  const cells=plan.rows.map(rows=>Array.from({length:GROUPS_PER_CABINET},(_,row)=>{
    const productId=rows[row]??null;
    return Array.from({length:SLOTS_PER_GROUP},()=>({productId,quantity:0}));
  }));
  for(const productId of new Set(plan.rows.flat().filter(Boolean))) {
    let remaining=Math.max(0,state.shelfInventory?.[productId]??0);
    const primary=plan.primaryCabinet.get(productId);
    const cabinets=[...cells.keys()].sort((a,b)=>Number(b===primary)-Number(a===primary));
    for(const cabinet of cabinets) for(const cell of cells[cabinet].flat()) {
      if(cell.productId!==productId) continue;
      cell.quantity=Math.min(capacity,remaining);remaining-=cell.quantity;
    }
  }
  return cells;
}

function windowScene(ctx,e) {
  r(ctx,222,4,194,64,'#819391');r(ctx,226,8,186,56,e.sky);
  // Stable skyline and two window mullions; weather changes, geometry does not.
  for(let i=0;i<9;i++) {
    const h=12+(i*7)%19;
    r(ctx,228+i*21,64-h,17,h,e.hour>=19?'#3f5669':'#9ebac1');
    for(let j=0;j<2;j++) r(ctx,231+i*21,68-h+j*7,3,3,e.hour>=19?'#f5d899':'#cfe4e5');
  }
  if(e.hour>=19) {r(ctx,373,15,10,10,'#f4edce');r(ctx,378,13,7,9,e.sky);}
  for(const p of weatherPixels(e.season,0).filter(p=>p.y<84)) r(ctx,p.x,p.y,2,2,p.color);
  r(ctx,316,8,4,56,'#eef0df');r(ctx,226,38,186,3,'#eef0df');r(ctx,220,66,198,4,'#b1bbb6');
  for(let i=0;i<5;i++) r(ctx,242+i*4,16+i*5,4,8,'#e7f2ec');
}

function drawInterior(ctx,e) {
  r(ctx,0,0,768,84,'#f0f0e5');
  for(let x=0;x<768;x+=64) r(ctx,x,0,1,78,'#d9ddd3');
  r(ctx,0,0,768,3,'#bfc7bd');
  for(const x of [22,434,636]) {r(ctx,x,6,52,3,'#cdd2c5');r(ctx,x+2,6,48,2,'#fffbed');}
  r(ctx,0,73,768,7,RED);r(ctx,0,80,768,4,'#8d9994');
  r(ctx,18,14,185,46,'#972b34');r(ctx,20,14,181,41,RED);
  label(ctx,'同生零食铺',110,30,20,'#fff7e6','center');
  label(ctx,'好零食 · 好日常',110,49,9,'#ffe7ca','center');
  windowScene(ctx,e);
  for(const [x,title,note] of [[440,'每日好食','SNACK MARKET'],[526,'好吃不贵','FRESH & DAILY']]) {
    r(ctx,x,15,70,43,'#c5c9bc');r(ctx,x,13,68,42,'#fff8e7');r(ctx,x,13,68,5,RED);
    label(ctx,title,x+34,31,11,RED,'center');label(ctx,note,x+34,45,6,'#8a8173','center');
  }
  r(ctx,636,15,110,39,'#fbf8eb');label(ctx,'收银台',691,27,13,RED,'center');label(ctx,'CHECKOUT',691,44,8,INK,'center');
  r(ctx,0,84,768,344,'#dcded5');
  for(let y=84,row=0;y<428;y+=32,row++) for(let x=0;x<768;x+=48) {
    r(ctx,x+1,y+1,46,30,(row+x/48)%3===0?'#e4e4d9':'#d9ddd4');
    r(ctx,x,y,48,1,'#bfc8bf');r(ctx,x,y,1,32,'#bfc8bf');
    r(ctx,x+2,y+2,42,1,'#edefe3');
  }
  r(ctx,0,84,768,6,'#b5bfb4');r(ctx,0,90,768,4,'#c9d0c4');
  // Pixel window light is clipped to the floor, drawn underneath objects.
  if(e.sunlight>0) {
    const shift=Math.round((e.hour-9)*8);
    for(let band=0;band<12;band++) {
      const alpha=e.sunlight*(1-band/18);
      r(ctx,230+shift+band*4,88+band*8,72,8,`rgba(255,244,184,${alpha})`);
      r(ctx,316+shift+band*4,88+band*8,68,8,`rgba(255,244,184,${alpha})`);
    }
  }
  // Red tile inlays identify aisles without obstructing the world routes.
  label(ctx,'01  /  零食精选',22,221,9,'#8e9b93');
  label(ctx,'02  /  今日好食',22,372,9,'#8e9b93');
  for(let y=245;y<365;y+=38) {r(ctx,711,y,14,2,'#b7beb3');r(ctx,725,y,2,8,'#b7beb3');}
  r(ctx,716,382,32,24,RED);label(ctx,'入口',732,394,10,'#fff3dc','center');
  // Floor service details, painted below actors and outside shelf collision boxes.
  r(ctx,721,221,36,25,'#a6b1a5');r(ctx,724,219,30,24,'#b8383b');
  for(let i=0;i<3;i++) {r(ctx,724,222+i*6,30,2,'#eb9a7b');r(ctx,730+i*8,220,2,20,'#812e3a');}
  label(ctx,'购物篮',739,253,7,'#8b9890','center');
  // Permanent backroom locker; decorative only, outside customer routes.
  r(ctx,736,270,24,90,'#a0aaa1');r(ctx,738,270,20,86,'#c4cec3');
  for(let i=0;i<3;i++) {r(ctx,739,274+i*27,18,23,'#dae0d4');r(ctx,741,282+i*27,3,2,'#7d9187');}
}

function drawExterior(ctx,e) {
  // One fixed glazed storefront, with a clear opening at the actual entrance route.
  for(let x=8;x<604;x+=74) {
    r(ctx,x,399,70,29,'#89a8a655');
    r(ctx,x,398,3,31,'#839a95');r(ctx,x+3,399,64,2,'#edf4e9');
    r(ctx,x+8,403,2,19,'#f2f8e888');r(ctx,x+11,403,2,16,'#f2f8e866');
    if(x%3===0) {r(ctx,x+19,404,29,18,'#b6333c');label(ctx,'好食',x+34,413,8,'#ffe8c9','center');}
  }
  r(ctx,704,399,64,29,'#89a8a655');r(ctx,706,398,3,31,'#839a95');
  r(ctx,0,428,768,16,'#b6c1b8');r(ctx,0,428,768,4,RED);r(ctx,0,439,768,5,'#899b96');
  for(let x=10;x<768;x+=64) {
    if(x>600&&x<704) continue;
    r(ctx,x,433,54,5,'#d8e6e0');r(ctx,x,437,54,2,'#eff1e6');
  }
  r(ctx,612,428,88,16,'#dbded2');r(ctx,608,428,4,16,'#f5f3e8');r(ctx,700,428,4,16,'#f5f3e8');
  r(ctx,607,396,5,32,'#759089');r(ctx,700,396,5,32,'#759089');
  r(ctx,607,396,98,3,'#f3f3df');r(ctx,611,398,2,28,'#d9e7d6');r(ctx,698,398,2,28,'#d9e7d6');
  r(ctx,0,444,768,34,e.pavement);
  for(let x=0;x<768;x+=32) r(ctx,x,444,1,34,e.hour>=19?'#4b5f76':'#aebdb6');
  r(ctx,0,460,768,1,e.hour>=19?'#4b5f76':'#aebdb6');
  r(ctx,0,478,768,34,e.hour>=19?'#35495f':'#6d7c82');r(ctx,0,476,768,3,'#c3d0ca');
  for(let x=12;x<768;x+=60) r(ctx,x,496,30,3,e.hour>=19?'#9eafb3':'#e3e5d4');
  if(e.lamp>0) {
    for(let i=0;i<5;i++) r(ctx,606-i*3,444+i*6,96+i*6,6,`rgba(255,219,141,${e.lamp*(0.26-i*0.035)})`);
    r(ctx,0,428,604,2,'#ed6c58');r(ctx,706,428,62,2,'#ed6c58');
  }
  r(ctx,618,448,76,22,'#842b32');r(ctx,620,448,72,18,RED);label(ctx,'欢迎光临',656,457,10,'#fff1cf','center');
  if(e.season==='winter') {
    for(let x=8;x<600;x+=68) {r(ctx,x,444,40,4,'#edf5f6');r(ctx,x+5,448,28,2,'#edf5f6');}
    r(ctx,10,476,580,3,'#e2edf0');
  }
  // Fixed tree locations clear of the entry/exit route at x=650, y=470.
  drawTree(ctx,44,469,e.season);drawTree(ctx,555,469,e.season);
  if(e.season==='autumn'||e.season==='spring') {
    for(let i=0;i<19;i++) r(ctx,70+i*25,449+(i*7)%22,4,2,e.season==='autumn'?'#c39642':'#e6b4c0');
  }
  // Clipped weather is outdoor-only, never snow on interior shelf tops.
}

function drawShelf(ctx,shelf,cells) {
  const {x,y,width:w,height:h}=shelf;
  r(ctx,x+5,y+h-2,w,7,'#a8b1a5');r(ctx,x+8,y+h+5,w-5,2,'#c2cabe');r(ctx,x+w,y+10,3,h-8,'#a6b2ad');
  r(ctx,x,y,w,20,'#e6e9df');r(ctx,x+2,y+2,w-4,6,'#f7f7eb');
  r(ctx,x,y+12,w,8,RED);label(ctx,`零食精选  ${String(shelf.slot+1).padStart(2,'0')}`,x+5,y+16,6,'#fff4d9');
  r(ctx,x,y+20,w,h-20,'#a3b2ab');r(ctx,x+3,y+20,w-6,h-24,'#edf0e5');
  for(let row=0;row<4;row++) {
    const top=y+21+row*18;
    r(ctx,x+4,top,w-8,14,'#c9d3c7');r(ctx,x+4,top,w-8,2,'#b4c2b7');
    for(let peg=x+7;peg<x+w-5;peg+=8) {r(ctx,peg,top+3,1,1,'#acbbb0');r(ctx,peg,top+8,1,1,'#acbbb0');}
    for(let col=0;col<3;col++) {
      const cell=cells?.[row]?.[col];const left=x+9+col*30;
      r(ctx,left-1,top+11,25,2,'#aebbb0');
      if(cell?.quantity>0) {
        drawProductIcon(ctx,cell.productId,left,top,13,26);
        if(cell.quantity>1) {r(ctx,left+2,top,20,1,'#faf0d2');r(ctx,left+22,top+2,2,9,'#778b7977');}
      } else {
        r(ctx,left+7,top+7,9,1,'#b2bfb4');r(ctx,left+10,top+4,3,1,'#b2bfb4');
      }
    }
    r(ctx,x+3,top+14,w-6,3,RED);
    for(let col=0;col<3;col++) {r(ctx,x+10+col*30,top+14,12,3,'#fff6da');r(ctx,x+12+col*30,top+15,5,1,'#a3634a');}
  }
  r(ctx,x,y+20,3,h-20,'#faf8ea');r(ctx,x+w-3,y+20,3,h-20,'#929f9c');
  for(const cy of [y+23,y+h-8]) {r(ctx,x+1,cy,1,1,'#83968c');r(ctx,x+w-2,cy,1,1,'#e8eddf');}
  r(ctx,x,y+h-3,w,3,'#778b86');
}

function shelfOverlay(ctx,shelf,state,selected,plan) {
  if(selected===shelf.id) {
    ctx.strokeStyle='#d99e3f';ctx.lineWidth=3;ctx.strokeRect(shelf.x-3,shelf.y-3,shelf.width+6,shelf.height+6);
  }
  const kinds=[...new Set((plan.rows[shelf.slot]??[]).filter(Boolean))];
  const statuses=kinds.map(id=>shelfDisplayState(state.shelfInventory?.[id]??0,productCapacity(state,id)));
  const status=statuses.includes('empty')||!kinds.length?'empty':statuses.includes('low')?'low':'full';
  if(status!=='full') {
    r(ctx,shelf.x+shelf.width-33,shelf.y+5,28,18,status==='empty'?'#942f3a':'#ae7831');
    label(ctx,status==='empty'?'缺货':'偏少',shelf.x+shelf.width-19,shelf.y+14,9,'#fff9e6','center');
  }
}

function counterBack(ctx) {
  const {x,y,width:w}=CHECKOUT_COUNTER;
  r(ctx,x,y,w,58,'#dce3db');r(ctx,x+2,y+2,w-4,52,'#f5f4e7');r(ctx,x,y,w,3,'#aebcb3');
  r(ctx,x+8,y+8,42,31,'#374650');r(ctx,x+11,y+11,36,23,'#819c96');r(ctx,x+14,y+14,30,15,'#bdd3b6');
  label(ctx,'¥',x+29,y+23,10,'#4f6b59','center');r(ctx,x+23,y+38,14,5,'#38454b');r(ctx,x+10,y+44,40,8,'#596a6e');
  for(let i=0;i<6;i++) r(ctx,x+13+i*6,y+45,4,2,'#adbbb5');
  r(ctx,x+116,y+15,15,21,'#bfa778');r(ctx,x+119,y+12,9,4,'#8b765b');r(ctx,x+118,y+19,11,4,'#eee2c0');
}
function counterFront(ctx) {
  const {x,y,width:w,height:h}=CHECKOUT_COUNTER;
  r(ctx,x-4,y+58,w+8,8,'#f4f1e3');r(ctx,x,y+66,w,h-66,RED);
  r(ctx,x,y+68,3,h-68,'#e96955');r(ctx,x+w-3,y+68,3,h-68,'#942f38');
  label(ctx,'同生零食铺',x+w/2,y+83,15,'#fff4df','center');
  label(ctx,'CHECKOUT',x+w/2,y+99,7,'#f5c9b5','center');r(ctx,x,y+h-4,w,4,'#879791');
}

function requestBubble(ctx,c,statusOffset=0) {
  const items=c.request??[];const missing=c.phase==='outOfStock';
  const width=Math.max(46,items.length*22+14+(missing?12:0));
  const x=Math.max(4,Math.min(764-width,c.x-width/2)), y=Math.max(4,c.y+statusOffset-(c.vip?110:104));
  r(ctx,x+2,y+2,width,26,'#768881');r(ctx,x,y,width,26,'#fff8e6');
  r(ctx,x,y,width,2,missing?RED:'#b99c69');r(ctx,c.x-3,y+26,6,4,'#fff8e6');
  items.forEach((item,i)=>drawProductIcon(ctx,item.productId,x+6+i*22,y+5,16));
  if(missing) label(ctx,'!',x+width-8,y+14,12,RED,'center');
}

export function createSceneRenderer(canvas, assets) {
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  let worldKey='',world;
  const owner={...SHOPKEEPER_POINT,role:'shopkeeper',phase:'manning',direction:'south',frame:0};
  return function renderScene({state,customers=[],selectedShelfId=null,elapsedMs=0}) {
    const key=JSON.stringify([state.cabinetCount,state.shelves,state.shelfPlan]);
    if(key!==worldKey) {world=buildWorld(state);worldKey=key;}
    const env=sceneEnvironment(state),plan=shopPlanogram(state),cells=shelfDisplayCells(state,plan);
    ctx.clearRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);ctx.imageSmoothingEnabled=false;
    drawInterior(ctx,env);drawExterior(ctx,env);
    const layers=[
      ...world.shelves.map(s=>({z:s.zBase,draw:()=>drawShelf(ctx,s,cells[s.slot])})),
      {z:CHECKOUT_COUNTER.y,draw:()=>counterBack(ctx)},
      {z:owner.y-10,draw:()=>drawCharacter(ctx,owner,0,elapsedMs,assets?.characters?.shopkeeper)},
      {z:CHECKOUT_COUNTER.zBase,draw:()=>counterFront(ctx)},
      ...customers.filter(c=>c.phase!=='done').map(c=>({z:c.y,draw:()=>drawCharacter(ctx,c,1+((c.variant??0)%3),elapsedMs,assets?.characters?.[castIdForCustomer(c)])}))
    ];
    layers.sort((a,b)=>a.z-b.z).forEach(layer=>layer.draw());
    // Interior lighting never darkens the store beyond a small readable shade.
    if(env.interiorShade) r(ctx,0,0,768,ROOM.floor,`rgba(39,48,72,${env.interiorShade})`);
    if(env.lamp>0) {
      for(const x of [76,452,678]) {r(ctx,x,6,32,3,'#fff4d0');r(ctx,x-2,9,36,2,'#e7e8cb');}
    }
    for(const p of weatherPixels(env.season,elapsedMs)) r(ctx,p.x,p.y,env.season==='winter'?2:3,2,p.color);
    for(const shelf of world.shelves) shelfOverlay(ctx,shelf,state,selectedShelfId,plan);
    for(const c of customers) if(['browsing','picking','waitingShelf','outOfStock'].includes(c.phase)) requestBubble(ctx,c,assets?.characters?.[castIdForCustomer(c)]?.id==='slime'?28:0);
  };
}
