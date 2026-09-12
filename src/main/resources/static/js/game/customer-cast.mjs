import {createCustomerRig} from './customer-rig.mjs?v=20260909-live';
import {normalizeTurnaround} from './customer-textures.mjs?v=cast1';
import {createSlimeRig} from './customer-slime.mjs?v=20260909-live';
export const CAST=Object.freeze([
 {id:'archer',name:'弓箭手',group:'奇幻',note:'绿衣精灵 · 箭袋'},
 {id:'rogue',name:'盗贼',group:'奇幻',note:'紫发兜帽 · 皮甲'},
 {id:'cleric',name:'神官',group:'奇幻',note:'银发白金 · 日轮徽章'},
 {id:'cyber',name:'赛博士兵',group:'科幻',note:'战术护甲 · 青色灯光'},
 {id:'robot',name:'机器人',group:'科幻',note:'橙白机身 · 电子眼'},
 {id:'goblin',name:'哥布林',group:'怪物',note:'绿皮尖耳 · 小钱袋'},
 {id:'slime',name:'史莱姆',group:'怪物',note:'薄荷果冻 · 弹跳移动'},
 {id:'doctor',name:'医生',group:'现代',note:'白衣青绿 · 听诊器'}
]);
export const CAST_DIRECTIONS=['north','south','west','east'];
export async function loadCastMember(id){
 const member=CAST.find(c=>c.id===id);if(!member)throw Error('未知角色');
 const image=new Image();image.src=`/images/game/cast/sources/${id}.png?v=cast1`;await image.decode();
 const cells=normalizeTurnaround(image,{slime:id==='slime'});
 const render=id==='slime'?createSlimeRig(cells):createCustomerRig(image,{cells,neutral:true});
 const atlas=document.createElement('canvas');atlas.width=1536;atlas.height=384;const a=atlas.getContext('2d');
 const frames=CAST_DIRECTIONS.map((direction,row)=>Array.from({length:16},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=96;render(c.getContext('2d'),direction,i/16);a.drawImage(c,i*96,row*96);return c;}));
 return {...member,atlas,frames,image,render};
}
