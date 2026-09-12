const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1060}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/customer-style-sample.html');await page.locator('body[data-ready="true"]').waitFor();
  assert.equal(await page.locator('canvas').count(),4);
  await page.locator('#play').click();
  const a=await page.locator('canvas').first().getAttribute('data-frame');await page.waitForTimeout(220);assert.equal(await page.locator('canvas').first().getAttribute('data-frame'),a);
  await page.locator('#next').click();assert.equal(await page.locator('canvas').first().getAttribute('data-frame'),String((Number(a)+1)%16));
  await page.locator('#previous').click();assert.equal(await page.locator('canvas').first().getAttribute('data-frame'),a);
  await page.selectOption('#speed','0.5');await page.locator('#play').click();await page.waitForTimeout(230);assert.notEqual(await page.locator('canvas').first().getAttribute('data-frame'),a);await page.locator('#play').click();
  const metrics=await page.evaluate(()=>{const image=document.querySelector('#sheet'),c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;if(data[i]>0)solid++;}return {width:c.width,height:c.height,clear,solid};});
  assert.ok(metrics.clear>0,"transparent background required");assert.ok(metrics.solid>0);assert.ok(metrics.width>=800&&metrics.height>=384);metrics.background=metrics.clear>0?'transparent':'baked checkerboard — preview draft only';
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/customer-style-sample-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/customer-style-sample-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',checks:['4 directions','pause','next / previous frame','playback','transparent PNG','mobile fit','no page errors'],image:metrics}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
