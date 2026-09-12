// Presentation-only identity: never change economic customer variants or save data.
export const CAST_IDS=Object.freeze(['archer','rogue','cleric','cyber','robot','goblin','slime','doctor']);
const DIRECTIONS=['north','south','west','east'];
const MOVING=new Set(['street','entering','browsing','queueing','waitingShelf','waitingQueue','leaving']);
export function castIdForCustomer(customer){
 if(CAST_IDS.includes(customer.appearanceId))return customer.appearanceId;
 let hash=2166136261;
 for(const char of String(customer.id??`variant-${customer.variant??0}`))hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return CAST_IDS[(hash>>>0)%CAST_IDS.length];
}
export function castAnimation(customer,fallbackTime=0){
 if(['picking','checkout'].includes(customer.phase))return {pose:'reach',frame:0};
 const moving=MOVING.has(customer.phase)&&(!Array.isArray(customer.route)||(customer.waypointIndex??0)<customer.route.length);
 const elapsed=Number.isFinite(customer.animationMs)?customer.animationMs:fallbackTime;
 return moving?{pose:'walk',frame:Math.floor(Math.max(0,elapsed)/50)%16}:{pose:'idle',frame:0};
}
export function castCell(direction,animation){
 const row=Math.max(0,DIRECTIONS.indexOf(direction));
 if(animation.pose==='idle'||animation.pose==='reach')return {x:row*96,y:(animation.pose==='idle'?4:5)*96};
 return {x:animation.frame*96,y:row*96};
}
