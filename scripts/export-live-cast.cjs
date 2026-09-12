const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8766/customer-cast.html');
 const output=await page.evaluate(async()=>{
  const {CAST,CAST_DIRECTIONS,loadCastMember}=await import('/js/game/customer-cast.mjs?v=20260909-live');const result=[];
  for(const {id} of CAST){const member=await loadCastMember(id),c=document.createElement('canvas');c.width=1536;c.height=576;const ctx=c.getContext('2d');ctx.drawImage(member.atlas,0,0);const images={},checks=[];
   for(const [row,action]of ['idle','reach'].entries())for(const [column,direction]of CAST_DIRECTIONS.entries()){
    const frame=document.createElement('canvas');frame.width=frame.height=96;const f=frame.getContext('2d');member.render(f,direction,0,action);ctx.drawImage(frame,column*96,(4+row)*96);images[`${direction}/${action}.png`]=frame.toDataURL();
    const d=f.getImageData(0,0,96,96).data;let solid=0,clipped=false;for(let i=3;i<d.length;i+=4)if(d[i]>16)solid++;
    for(let n=0;n<96;n++)if(d[n*4+3]>16||d[(95*96+n)*4+3]>16||d[n*96*4+3]>16||d[(n*96+95)*4+3]>16)clipped=true;
    checks.push({direction,action,solid,clipped});
   }images['game-atlas.png']=c.toDataURL();result.push({id,images,checks});
  }return result;
 });
 for(const {id,images,checks}of output){for(const check of checks){assert.ok(check.solid>200,`${id}: empty pose`);assert.equal(check.clipped,false,`${id}: clipped pose`);}const root=`src/main/resources/static/images/game/cast/${id}`;for(const [name,data]of Object.entries(images))fs.writeFileSync(`${root}/${name}`,Buffer.from(data.split(',')[1],'base64'));
  fs.writeFileSync(`${root}/game-sprites.json`,JSON.stringify({width:96,height:96,anchor:[48,91],atlas:[1536,576],directions:['north','south','west','east'],walk:{rows:[0,1,2,3],frames:16,frameMs:50},idle:{row:4,columns:'directions'},reach:{row:5,columns:'directions'}},null,2));console.log(`PASS ${id}: game atlas and 8 grounded pose PNGs`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
