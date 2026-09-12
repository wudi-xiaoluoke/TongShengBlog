// The archived 8-frame viewer owns its legacy assets independently of the live cast.
async function loadGameAssets(){
 const entries=await Promise.all(['shopkeeper','student','neighbor','worker'].map(async name=>{
  const image=new Image();image.src=`/images/game/customers/${name}.png?v=20260908-walk8`;await image.decode();
  if(image.naturalWidth!==256||image.naturalHeight!==240)throw Error(`角色图集尺寸错误：${name}`);
  return [name,image];
 }));return {characters:Object.fromEntries(entries)};
}
import {CHARACTER_SPRITE,spriteCell} from './game-character.mjs?v=20260908-walk8';
const $=s=>document.querySelector(s),names=['↑ 向上','↓ 向下','← 向左','→ 向右'];
const directions=CHARACTER_SPRITE.directions;
$('#directions').innerHTML=directions.map((d,i)=>`<article class="card"><h2>${names[i]}</h2><canvas width="32" height="40" aria-label="${names[i]}角色动画" data-direction="${d}"></canvas><small>${d} · 8 帧循环</small></article>`).join('');
let frame=0,playing=true,accumulator=0,last=0,assets;
function strips(){const v=$('#variant').value;$('#strips').innerHTML=directions.map((d,i)=>`<div class="sequence"><strong>${names[i]}</strong><img class="strip" src="/images/game/customers/${v}/${d}-walk.png?v=20260908-walk8" alt="${names[i]}的八帧序列"><div class="links">${Array.from({length:8},(_,n)=>`<a download href="/images/game/customers/${v}/${d}/walk-${String(n).padStart(2,'0')}.png">第 ${n+1} 帧 ↓</a>`).join('')}</div></div>`).join('');}
function draw(){if(!assets)return;const pose=$('#pose').value;$('#frame').textContent=pose==='walk'?`第 ${frame+1} / 8 帧`:'静止姿态';document.querySelectorAll('canvas').forEach(canvas=>{const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#e4e9dc';ctx.fillRect(0,0,32,40);if($('#guide').checked){ctx.fillStyle='#9ead9c';ctx.fillRect(0,34,32,1);}const cell=spriteCell(canvas.dataset.direction,frame,pose);ctx.drawImage(assets.characters[$('#variant').value],cell.x,cell.y,32,40,0,0,32,40);canvas.dataset.frame=String(frame);});}
function pause(){playing=false;$('#play').textContent='播放';accumulator=0;}
$('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'暂停':'播放';accumulator=0;};
$('#previous').onclick=()=>{pause();frame=(frame+7)%8;draw();};$('#next').onclick=()=>{pause();frame=(frame+1)%8;draw();};
$('#variant').onchange=()=>{strips();draw();};$('#pose').onchange=()=>{frame=0;accumulator=0;draw();};$('#guide').onchange=draw;
function tick(t){const dt=Math.min(100,t-last);last=t;if(playing&&$('#pose').value==='walk'){accumulator+=dt*Number($('#speed').value);while(accumulator>=80){frame=(frame+1)%8;accumulator-=80;}draw();}requestAnimationFrame(tick);}
try{assets=await loadGameAssets();strips();draw();$('#status').textContent='已加载：4 位角色 × 4 个方向 × 8 帧。';document.body.dataset.ready='true';requestAnimationFrame(tick);}catch(e){$('#status').textContent=`图片加载失败，请刷新重试。${e.message}`;}
