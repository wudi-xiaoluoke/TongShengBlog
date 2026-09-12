// Normalize source turnarounds in the renderer; source PNGs remain unmodified.
export function normalizeTurnaround(image,{slime=false}={}){
 return [1,0,2,3].map(index=>{
  const x0=Math.round(index%2*image.naturalWidth/2),y0=Math.round(Math.floor(index/2)*image.naturalHeight/2);
  const width=Math.round((index%2+1)*image.naturalWidth/2)-x0,height=Math.round((Math.floor(index/2)+1)*image.naturalHeight/2)-y0;
  const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.drawImage(image,x0,y0,width,height,0,0,width,height);
  const data=ctx.getImageData(0,0,width,height).data;let left=width,right=-1,top=height,bottom=-1,clear=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=data[(y*width+x)*4+3];if(alpha===0)clear++;if(alpha>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  if(clear<width*height*.1||right<left)throw Error('角色源图需要有效透明背景');
  const w=right-left+1,h=bottom-top+1;
  let weight=0,sum=0;for(let y=Math.floor(top+h*.8);y<=bottom;y++)for(let x=left;x<=right;x++){const a=data[(y*width+x)*4+3];if(a>32){sum+=x*a;weight+=a;}}
  const center=slime?(left+right)/2:sum/weight;
  const scale=slime?Math.min(150/w,100/h):Math.min(201/h,178/w);
  const result=document.createElement('canvas');result.width=result.height=222;const out=result.getContext('2d');out.imageSmoothingEnabled=false;
  out.drawImage(c,left,top,w,h,125+(left-center)*scale,211-h*scale,w*scale,h*scale);
  return result;
 });
}
