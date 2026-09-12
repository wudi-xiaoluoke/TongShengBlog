// Run against the local guest preview, using an isolated browser context and test saves.
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const URL=process.env.GAME_PREVIEW_URL || 'http://127.0.0.1:8766';
(async()=>{
 fs.mkdirSync('artifacts',{recursive:true});
 let testServer;
 try {await fetch(URL+'/api/auth/me');} catch {
  testServer=require('node:child_process').spawn('python',['scripts/serve-game-preview.py','--port',new globalThis.URL(URL).port],{stdio:'ignore',windowsHide:true});
  for(let i=0;i<30;i++){try{await fetch(URL+'/api/auth/me');break;}catch{await new Promise(r=>setTimeout(r,150));}}
 }
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tongsheng.snackShop.save.v1')));
 const load=async()=>{await page.goto(URL+'/game');await page.locator('#loading-overlay').waitFor({state:'hidden'});};
 try {
  await page.goto(URL+'/game-art-review.html');
  await page.locator('#animate').click();
  for(const season of ['spring','summer','autumn','winter']) {
   await page.selectOption('#season',season);
   await page.locator('#hour').fill('12');
   await page.waitForTimeout(80);
   await page.locator('canvas').screenshot({path:`artifacts/season-${season}.png`});
  }
  await page.selectOption('#cabinets','10');
  for(const hour of [9,18,20.5]) {
   await page.locator('#hour').fill(String(hour));await page.waitForTimeout(80);
   await page.locator('canvas').screenshot({path:`artifacts/time-${hour}.png`});
  }
  // State fixture belongs only to this isolated browser context, never the user's save.
  await page.evaluate(async()=>{
   const {createInitialState,serializeState}=await import('/js/game/game-state.mjs');
   const {PRODUCTS,productCapacity}=await import('/js/game/game-config.mjs');
   const s=createInitialState();s.level=5;s.coins=10000;s.day.number=3;s.cabinetCount=10;s.shelves=Object.keys(PRODUCTS);
   for(const id of s.shelves){s.warehouseInventory[id]=100;s.shelfInventory[id]=Math.max(1,productCapacity(s,id)-2);}
   localStorage.setItem('tongsheng.snackShop.save.v1',serializeState(s));
  });
  await load();
  const canvas=await page.locator('#snack-shop-canvas').boundingBox();
  await page.mouse.click(canvas.x+60/768*canvas.width,canvas.y+125/512*canvas.height);
  await page.locator('#shelf-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-row-index]').count(),4);
  await page.evaluate(()=>{window.testSelect=document.querySelector('[data-row-index]');});
  await page.waitForTimeout(650);
  assert.ok(await page.evaluate(()=>window.testSelect===document.querySelector('[data-row-index]')),'250ms refresh preserves shelf select nodes');
  const first=page.locator('[data-restock-qty="1"]').first();const id=await first.getAttribute('data-restock-product');
  const before=await save();await first.click();const after=await save();
  assert.equal(after.warehouseInventory[id],before.warehouseInventory[id]-1);
  await page.selectOption('[data-row-index="3"]','chocolate');
  assert.equal((await save()).shelfPlan[0][3],'chocolate');
  await page.screenshot({path:'artifacts/game-shelf.png',fullPage:true});
  await page.setViewportSize({width:720,height:1000});await page.waitForTimeout(350);
  assert.ok(await page.locator('#shelf-panel').evaluate(el=>getComputedStyle(el).position==='relative'),'sub-700px canvas uses a shelf card in document flow even at 720px viewport');
  await page.setViewportSize({width:1440,height:1100});await page.waitForTimeout(350);
  await page.locator('#phone-button').click();
  for(const name of ['inventory','supply','upgrades','ledger','hq']) {
   await page.locator(`[data-panel="${name}-panel"]`).click();
   await page.locator(`#${name}-panel`).waitFor({state:'visible'});
   await page.locator(`#${name}-panel [data-back]`).click();
  }
  await page.locator('[data-panel="supply-panel"]').click();
  await page.locator('#supply-panel [data-phone-cat="sweet"]').click();
  assert.ok((await page.locator('#supply-list').innerText()).includes('草莓糖'));
  assert.ok(!(await page.locator('#supply-list').innerText()).includes('原味薯片'));
  const orderBefore=await save();await page.locator('[data-order-product="candy"]').click();
  const orderAfter=await save();assert.equal(orderAfter.coins,orderBefore.coins-20);assert.ok(orderAfter.supplyOrders.length>0);
  await page.locator('#supply-panel [data-back]').click();
  await page.screenshot({path:'artifacts/phone-desktop.png',fullPage:true});
  await page.locator('#phone-close').click();assert.equal(await page.locator('#phone-button').getAttribute('aria-expanded'),'false');
  // Finish the test delivery without waiting 30 real seconds.
  await page.evaluate(()=>{
   const key='tongsheng.snackShop.save.v1',s=JSON.parse(localStorage.getItem(key));s.supplyOrders.forEach(o=>o.readyAt=Date.now()-1000);localStorage.setItem(key,JSON.stringify(s));
  });
  // Navigate to a different document first so beforeunload cannot overwrite the edited fixture.
  const deliveredFixture=await save();await page.goto(URL+'/game-art-review.html');
  await page.evaluate(s=>localStorage.setItem('tongsheng.snackShop.save.v1',JSON.stringify(s)),deliveredFixture);
  await load();await page.waitForTimeout(600);const delivered=await save();
  assert.equal(delivered.supplyOrders.length,0);assert.equal(delivered.warehouseInventory.candy,orderAfter.warehouseInventory.candy+10);
  const nightFixture=await save();nightFixture.dayBreak=true;nightFixture.day.elapsedMs=180000;
  await page.goto(URL+'/game-art-review.html');await page.evaluate(s=>localStorage.setItem('tongsheng.snackShop.save.v1',JSON.stringify(s)),nightFixture);
  await load();await page.locator('#night-overlay').waitFor({state:'visible'});
  await page.reload();await page.locator('#night-overlay').waitFor({state:'visible'});
  await page.locator('[data-night-inc="candy"]').click();assert.equal(await page.locator('#night-total-qty').innerText(),'1');
  await page.locator('[data-night-category="puffed"]').click();await page.locator('[data-night-inc="chips"]').click();
  assert.equal(await page.locator('#night-total-qty').innerText(),'2');
  await page.screenshot({path:'artifacts/night-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('.nb-page-head h3').first().evaluate(el=>el.getBoundingClientRect().top>=0),'mobile book title is reachable at top');
  await page.screenshot({path:'artifacts/night-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at 390px');
  await page.locator('#open-new-day').click();await page.locator('#night-overlay').waitFor({state:'hidden'});
  const next=await save();assert.equal(next.day.number,4);assert.equal(next.dayBreak,false);assert.equal(next.supplyOrders.length,2);
  await page.locator('#phone-button').click();await page.screenshot({path:'artifacts/phone-mobile.png',fullPage:true});
  await page.locator('[data-panel="ledger-panel"]').click();await page.locator('#open-reset').click();
  await page.locator('#reset-game-dialog').waitFor({state:'visible'});
  await page.getByRole('button',{name:'暂不重开',exact:true}).click();assert.equal((await save()).day.number,4);
  await page.locator('#open-reset').click();await page.locator('#confirm-reset').click();assert.equal((await save()).coins,200);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: four seasons, day lighting, four-row shelf, stable select, restock, swap, 5 phone pages, category filter, order/delivery, night restore, batch orders/new day, mobile, reset confirmation; no JS errors.');
 } finally {await browser.close();testServer?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
