import {CAST,loadCastMember} from './customer-cast.mjs?v=20260909-live';
const $=s=>document.querySelector(s),labels=['↑ 向上','↓ 向下','← 向左','→ 向右'];
$('#roster').innerHTML=CAST.map(c=>`<button type="button" data-id="${c.id}" aria-pressed="false"><canvas width="96" height="96" aria-hidden="true"></canvas><span><strong>${c.name}</strong><small>${c.group}</small></span></button>`).join('');
$('.directions').innerHTML=labels.map((label,row)=>`<article class="direction"><h3>${label}</h3><canvas width="288" height="288" data-row="${row}" aria-label="${label}动画"></canvas><small>16 帧 / 0.8 秒</small></article>`).join('');
let active=null,selected='archer',frame=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,accumulator=0;const cache=new Map();
function get(id){if(!cache.has(id))cache.set(id,loadCastMember(id).catch(e=>{cache.delete(id);throw e;}));return cache.get(id);}
function draw(){if(!active)return;$('#frame').textContent=`第 ${frame+1} / 16 帧`;for(const c of document.querySelectorAll('.directions canvas')){const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#e8eddf';ctx.fillRect(0,0,288,288);if($('#guide').checked){ctx.fillStyle='#bcc8b2';ctx.fillRect(10,273,268,1);}ctx.drawImage(active.frames[Number(c.dataset.row)][frame],0,0,288,288);c.dataset.frame=frame;}}
async function select(id){selected=id;document.body.dataset.ready='false';$('#status').textContent='正在载入角色…';try{const member=await get(id);if(selected!==id)return;active=member;frame=0;accumulator=0;$('#name').textContent=member.name;$('#group').textContent=member.group;$('#description').textContent=member.note;$('#sheet').src=member.atlas.toDataURL();$('#atlas-download').href=$('#sheet').src;$('#atlas-download').download=`${id}-4directions-16frames.png`;$('#member-download').href=`/images/game/cast/${id}.zip?v=20260909-live`;$('#source').href=member.image.src;document.querySelectorAll('#roster button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));document.body.dataset.role=id;document.body.dataset.ready='true';$('#status').textContent=id==='slime'?'史莱姆 · 四方向弹跳与形变':'四方向行走 · 使用已定稿的步态与摆臂';draw();}catch(e){if(selected===id)$('#status').textContent=`角色载入失败：${e.message}，请重试。`;}}
document.querySelectorAll('#roster button').forEach(b=>b.onclick=()=>select(b.dataset.id));
function sync(){ $('#play').textContent=playing?'暂停':'播放'; }sync();
$('#play').onclick=()=>{playing=!playing;accumulator=0;sync();};
function step(delta){playing=false;accumulator=0;sync();frame=(frame+delta+16)%16;draw();}
$('#previous').onclick=()=>step(-1);$('#next').onclick=()=>step(1);$('#guide').onchange=draw;
function tick(t){const delta=Math.min(100,t-last);last=t;if(playing&&active){accumulator+=delta*Number($('#speed').value);while(accumulator>=50){frame=(frame+1)%16;accumulator-=50;}draw();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
await select('archer');
await Promise.allSettled(CAST.map(async member=>{const c=await get(member.id),canvas=document.querySelector(`#roster button[data-id="${member.id}"] canvas`),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(c.frames[1][0],0,0);}));
