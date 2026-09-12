import {createCustomerRig} from './customer-rig.mjs?v=20260909-arms';
import {GAIT_FRAMES,GAIT_DURATION} from './customer-gait.mjs?v=20260909-arms';
const $=s=>document.querySelector(s),labels=['↑ 向上 · 背面','↓ 向下 · 正面','← 向左 · 侧面','→ 向右 · 侧面'],directions=['north','south','west','east'];
$('.cards').innerHTML=labels.map((label,row)=>`<article class="card"><h2>${label}</h2><canvas width="288" height="288" data-row="${row}" aria-label="${label}行走动画"></canvas><small>${GAIT_FRAMES} 帧循环 · 0.8 秒 / 周期</small></article>`).join('');
const sheet=$('#sheet');let frame=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,accumulator=0,frames;
const syncButton=()=>{$('#play').textContent=playing?'暂停':'播放';};syncButton();
function draw(){if(!frames)return;$('#frame').textContent=`第 ${frame+1} / ${GAIT_FRAMES} 帧`;for(const canvas of document.querySelectorAll('.cards canvas')){const ctx=canvas.getContext('2d'),row=Number(canvas.dataset.row);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#e9eddf';ctx.fillRect(0,0,288,288);if($('#guide').checked){ctx.fillStyle='#bdc8b4';ctx.fillRect(12,273,264,1);}ctx.drawImage(frames[row][frame],0,0,288,288);canvas.dataset.frame=String(frame);}}
function pause(){playing=false;accumulator=0;syncButton();}
$('#play').onclick=()=>{playing=!playing;accumulator=0;syncButton();};$('#previous').onclick=()=>{pause();frame=(frame+GAIT_FRAMES-1)%GAIT_FRAMES;draw();};$('#next').onclick=()=>{pause();frame=(frame+1)%GAIT_FRAMES;draw();};$('#guide').onchange=draw;
function tick(t){const delta=Math.min(100,t-last);last=t;if(playing){accumulator+=delta*Number($('#speed').value);while(accumulator>=GAIT_DURATION/GAIT_FRAMES){frame=(frame+1)%GAIT_FRAMES;accumulator-=GAIT_DURATION/GAIT_FRAMES;}draw();}requestAnimationFrame(tick);}
try{
 const image=new Image();image.src='/images/game/customer-animation-source.png?v=20260909-arms';await image.decode();const render=createCustomerRig(image);
 const atlas=document.createElement('canvas');atlas.width=96*GAIT_FRAMES;atlas.height=96*4;
 frames=directions.map((direction,row)=>Array.from({length:GAIT_FRAMES},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=96;render(c.getContext('2d'),direction,i/GAIT_FRAMES);atlas.getContext('2d').drawImage(c,i*96,row*96);return c;}));
 sheet.src=atlas.toDataURL();await sheet.decode();const download=$('#atlas-download');download.href=sheet.src;download.download='customer-walk-4directions-16frames.png';
 draw();document.body.dataset.ready='true';$('#status').textContent='16 帧完整步态 · 固定人物基准 · 透明背景';requestAnimationFrame(tick);
}catch(error){$('#status').textContent=`加载失败，请刷新重试。${error.message}`;}
