const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.GAME_PREVIEW_URL||'http://127.0.0.1:8766';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{
 const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/game');await page.locator('#loading-overlay').waitFor({state:'hidden'});
 const checks=await page.evaluate(async()=>{
  const {loadGameAssets,createSceneRenderer}=await import('/js/game/game-scene.mjs?v=20260909-live');
  const {CAST_IDS,castIdForCustomer}=await import('/js/game/game-cast-visuals.mjs?v=20260909-live');
  const {createInitialState}=await import('/js/game/game-state.mjs');const {PRODUCTS,productCapacity}=await import('/js/game/game-config.mjs');
  const assets=await loadGameAssets(),state=createInitialState();state.level=5;state.cabinetCount=10;state.shelves=Object.keys(PRODUCTS);for(const id of state.shelves)state.shelfInventory[id]=productCapacity(state,id);
  const canvas=document.createElement('canvas');canvas.id='cast-fixture';canvas.width=768;canvas.height=512;canvas.style='width:1152px;max-width:100%;image-rendering:pixelated';document.body.replaceChildren(canvas);
  const ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx),calls=[];ctx.drawImage=(...args)=>{calls.push(args);draw(...args);};
  const render=createSceneRenderer(canvas,assets),customers=CAST_IDS.map((id,i)=>({id:'visit-'+i,appearanceId:id,x:i<5?66+i*111:255+(i-5)*157,y:i<5?218:390,direction:['south','east','west','south','north','east','south','west'][i],phase:i%3===0?'picking':i%3===1?'waitingQueue':'browsing',route:[{x:0,y:0}],waypointIndex:i%3===1?1:0,animationMs:150,request:[],maxPatienceMs:20000,patienceMs:5000}));
  render({state,customers,elapsedMs:150});
  const mapping=customers.map(c=>{const image=assets.characters[castIdForCustomer(c)].image;const call=calls.find(a=>a[0]===image);return {id:c.appearanceId,phase:c.phase,source:call?.slice(1,5),dest:call?.slice(5),size:[image.naturalWidth,image.naturalHeight]};});
  return {count:Object.keys(assets.characters).length,mapping};
 });
 assert.equal(checks.count,8);for(const c of checks.mapping){assert.deepEqual(c.size,[1536,576]);assert.ok(c.source);assert.equal(c.source[1]>=384,c.phase!=='browsing');assert.deepEqual(c.dest.slice(2),[72,72]);}
 fs.mkdirSync('artifacts',{recursive:true});await page.locator('#cast-fixture').screenshot({path:'artifacts/live-cast-shop.png'});
 await page.goto(base+'/game');await page.locator('#loading-overlay').waitFor({state:'hidden'});await page.waitForTimeout(4500);await page.screenshot({path:'artifacts/live-cast-game.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 // Network failure must leave a recoverable retry action.
 await page.route('**/cast/doctor/game-atlas.png*',r=>r.abort());await page.reload();await page.locator('#asset-error').waitFor({state:'visible'});await page.unroute('**/cast/doctor/game-atlas.png*');await page.locator('#retry-assets').click();await page.locator('#loading-overlay').waitFor({state:'hidden'});
 console.log('PASS 8 production atlases, identity/state mapping, shop scene, mobile fit, no page errors and asset retry.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
