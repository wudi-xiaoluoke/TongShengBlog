const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8766/customer-style-sample.html');await page.locator('body[data-ready="true"]').waitFor();
 const result=await page.evaluate(()=>{
  const image=document.querySelector('#sheet'),c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');
  return [2,3].map(row=>{const hands=[];for(let f=0;f<16;f++){ctx.clearRect(0,0,96,96);ctx.drawImage(image,((f+8)%16)*96,row*96,96,96,0,0,96,96);const opposite=ctx.getImageData(0,0,96,96).data;ctx.clearRect(0,0,96,96);ctx.drawImage(image,f*96,row*96,96,96,0,0,96,96);const data=ctx.getImageData(0,0,96,96).data;const xs=[];
   // Palms only: below the face and above the shoes, with the skin-tone palette.
   for(let y=52;y<72;y++)for(let x=25;x<71;x++){const n=(y*96+x)*4,[r,g,b,a]=data.slice(n,n+4);const changed=Math.abs(r-opposite[n])+Math.abs(g-opposite[n+1])+Math.abs(b-opposite[n+2])+Math.abs(a-opposite[n+3])>80;if(changed&&a>160&&r>150&&g>80&&b>40&&r>g*1.15&&g>b*1.05)xs.push(x);}
   hands.push({frame:f,min:Math.min(...xs),max:Math.max(...xs)});
  }return {direction:row===2?'west':'east',hands};});
 });
 for(const row of result){assert.ok(row.hands.some(h=>h.min<43),`${row.direction}: no hand swings visibly beyond left torso edge`);assert.ok(row.hands.some(h=>h.max>53),`${row.direction}: no hand swings visibly beyond right torso edge`);}
 console.log(JSON.stringify({result:'PASS',checks:'Visible palms reach both front and rear of the torso in both side directions',extents:result.map(r=>({direction:r.direction,min:Math.min(...r.hands.map(h=>h.min)),max:Math.max(...r.hands.map(h=>h.max))}))}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
