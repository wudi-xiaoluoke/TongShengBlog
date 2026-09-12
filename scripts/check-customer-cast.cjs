const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{
 const page=await browser.newPage({viewport:{width:1280,height:1180}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8766/customer-cast.html');await page.locator('body[data-ready="true"]').waitFor();
 const ids=(process.env.CAST_IDS||'archer,rogue,cleric,cyber,robot,goblin,slime,doctor').split(',');
 for(const id of ids){await page.locator(`#roster button[data-id="${id}"]`).click();await page.locator(`body[data-ready="true"][data-role="${id}"]`).waitFor();
  if(await page.locator('#play').textContent()==='暂停')await page.locator('#play').click();
  const current=Number(await page.locator('.directions canvas').first().getAttribute('data-frame'));await page.locator('#next').click();assert.equal(Number(await page.locator('.directions canvas').first().getAttribute('data-frame')),(current+1)%16);await page.locator('#previous').click();assert.equal(Number(await page.locator('.directions canvas').first().getAttribute('data-frame')),current);
  fs.mkdirSync('artifacts/cast',{recursive:true});await page.screenshot({path:`artifacts/cast/${id}.png`,fullPage:true});
  const exported=await page.evaluate(()=>{const image=document.querySelector('#sheet'),images={'atlas.png':image.src},checks=[];for(const [row,d] of ['north','south','west','east'].entries()){
   const strip=document.createElement('canvas');strip.width=1536;strip.height=96;strip.getContext('2d').drawImage(image,0,row*96,1536,96,0,0,1536,96);images[`${d}/strip.png`]=strip.toDataURL();
   for(let f=0;f<16;f++){const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');ctx.drawImage(image,f*96,row*96,96,96,0,0,96,96);images[`${d}/walk-${String(f).padStart(2,'0')}.png`]=c.toDataURL();const data=ctx.getImageData(0,0,96,96).data;let solid=0;for(let i=3;i<data.length;i+=4)if(data[i]>16)solid++;let clipped=false;for(let n=0;n<96;n++)if(data[n*4+3]>16||data[(95*96+n)*4+3]>16||data[(n*96)*4+3]>16||data[(n*96+95)*4+3]>16)clipped=true;checks.push({d,f,solid,clipped});}
  }return {images,checks};});
  for(const c of exported.checks){assert.ok(c.solid>200&&c.solid<6500,`${id}/${c.d}/${c.f} invalid silhouette or background`);assert.ok(!c.clipped,`${id}/${c.d}/${c.f} is clipped`);}
  for(const d of ['north','south','west','east']){const unique=new Set(Array.from({length:16},(_,i)=>exported.images[`${d}/walk-${String(i).padStart(2,'0')}.png`])).size;assert.ok(unique>=(id==='slime'?8:16),`${id}/${d} repeated motion`);}
  const root=`src/main/resources/static/images/game/cast/${id}`;for(const [name,data]of Object.entries(exported.images)){const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,Buffer.from(data.split(',')[1],'base64'));}
  fs.writeFileSync(path.join(root,'sprites.json'),JSON.stringify({id,width:96,height:96,anchor:[48,91],frames:16,frameMs:50,cycleMs:800,directions:['north','south','west','east'],motion:id==='slime'?'hop':'walk'},null,2));console.log(`PASS ${id}: 4 directions, 64 unclipped transparent frames, sequence controls, export.`);
 }
 await page.locator('#play').click();const before=await page.locator('.directions canvas').first().getAttribute('data-frame');await page.waitForTimeout(180);assert.notEqual(await page.locator('.directions canvas').first().getAttribute('data-frame'),before);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/cast/mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS playback, mobile fit and no uncaught page errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
