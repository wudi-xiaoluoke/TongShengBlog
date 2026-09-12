// Export the original Canvas artwork losslessly: transparent PNGs, no resampling.
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const URL=process.env.GAME_PREVIEW_URL||'http://127.0.0.1:8766';
(async()=>{
 let server;
 try{await fetch(URL+'/api/auth/me');}catch{
  server=require('node:child_process').spawn('python',['scripts/serve-game-preview.py','--port',new globalThis.URL(URL).port],{stdio:'ignore',windowsHide:true});
  for(let i=0;i<30;i++){try{await fetch(URL+'/api/auth/me');break;}catch{await new Promise(r=>setTimeout(r,150));}}
 }
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const page=await browser.newPage();await page.goto(URL+'/game-art-review.html');
  const result=await page.evaluate(async()=>{
   const {drawCharacterFrame,CHARACTER_SPRITE,CHARACTER_PALETTES}=await import('/js/game/game-character.mjs?v=20260908-walk8');
   const images={},meta={...CHARACTER_SPRITE,atlasWidth:256,atlasHeight:240,rows:{north:0,south:1,west:2,east:3,idle:4,reach:5},variants:Object.keys(CHARACTER_PALETTES)};
   const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
   for(const variant of meta.variants){
    const atlas=make(256,240),a=atlas.getContext('2d');
    for(let row=0;row<4;row++){
     const direction=meta.directions[row],strip=make(256,40),s=strip.getContext('2d');
     for(let frame=0;frame<8;frame++){
      const c=make(32,40);drawCharacterFrame(c.getContext('2d'),variant,direction,frame,16,34,1);
      images[`${variant}/${direction}/walk-${String(frame).padStart(2,'0')}.png`]=c.toDataURL();
      s.drawImage(c,frame*32,0);a.drawImage(c,frame*32,row*40);
     }
     images[`${variant}/${direction}-walk.png`]=strip.toDataURL();
     for(const [pose,y] of [['idle',160],['reach',200]]){
      const c=make(32,40);drawCharacterFrame(c.getContext('2d'),variant,direction,0,16,34,1,pose);
      images[`${variant}/${direction}/${pose}.png`]=c.toDataURL();a.drawImage(c,row*32,y);
     }
    }
    images[`${variant}.png`]=atlas.toDataURL();
   }
   return {images,meta};
  });
  const out='src/main/resources/static/images/game/customers';
  for(const [name,data] of Object.entries(result.images)){
   const dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,Buffer.from(data.split(',')[1],'base64'));
  }
  fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify(result.meta,null,2)+'\n');
  console.log(`Exported ${Object.keys(result.images).length} transparent PNG files; 4 characters × 4 directions × 8 walk frames plus idle/reach poses.`);
 }finally{await browser.close();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
