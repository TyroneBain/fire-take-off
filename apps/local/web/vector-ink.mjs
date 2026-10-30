// Draw original native-coordinate path commands, never infer lost path joins
// from matcher segments. Output is intersected with the actual rendered page.
const finite=a=>Array.isArray(a)&&a.every(Number.isFinite);
function validatePath(element){
 const path=element.pathCommands,style=element.style;
 if(!Array.isArray(path)||!path.length||path.length>16384||typeof element.paintClosesPath!=='boolean'||!style||!finite(element.bounds)||element.bounds.length!==4)return false;
 if(!['nonzero','evenodd'].includes(style.rule)||!style.fill&&!style.stroke)return false;
 if(style.fill!==null&&!/^#[0-9a-f]{6}$/i.test(style.fill)||style.stroke!==null&&!/^#[0-9a-f]{6}$/i.test(style.stroke))return false;
 if(style.stroke&&(!Number.isFinite(style.width)||style.width<=0||!Number.isFinite(style.miter)||style.miter<1||![0,1,2].includes(style.cap)||![0,1,2].includes(style.join)))return false;
 let begun=false,count=0;
 for(let i=0;i<path.length;){if(++count>4096)return false;const op=path[i++],n=({0:2,1:2,2:6,3:4,4:0})[op];if(n===undefined||i+n>path.length||op!==0&&!begun)return false;
  const points=path.slice(i,i+n);if(!finite(points))return false;
  for(let k=0;k<points.length;k+=2)if(points[k]<element.bounds[0]-.000001||points[k]>element.bounds[2]+.000001||points[k+1]<element.bounds[1]-.000001||points[k+1]>element.bounds[3]+.000001)return false;
  i+=n;if(op===0)begun=true;
 }
 return begun;
}
function trace(context,path){
 context.beginPath();for(let i=0;i<path.length;){switch(path[i++]){
  case 0:context.moveTo(path[i++],path[i++]);break;
  case 1:context.lineTo(path[i++],path[i++]);break;
  case 2:context.bezierCurveTo(path[i++],path[i++],path[i++],path[i++],path[i++],path[i++]);break;
  case 3:context.quadraticCurveTo(path[i++],path[i++],path[i++],path[i++]);break;
  case 4:context.closePath();break;
 }}
}
export function vectorInkMask({vectorPage,hit,viewport,image,createCanvas,maxPixels=262144,minCoverage=.95}){
 const matrix=Array.from(viewport?.transform||[]);
 if(!vectorPage?.supported||!Array.isArray(vectorPage.elements)||vectorPage.elements.length>50000||!hit||!Array.isArray(hit.elementIds)||!hit.elementIds.length||hit.elementIds.length>128||new Set(hit.elementIds).size!==hit.elementIds.length||hit.elementIds.some(id=>!Number.isInteger(id))||!Number.isFinite(hit.x)||!Number.isFinite(hit.y)||hit.score!==1)return null;
 if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width*image.height>4000000||image.data?.length!==image.width*image.height||!finite(matrix)||matrix.length!==6||typeof viewport?.convertToViewportPoint!=='function'||typeof createCanvas!=='function')return null;
 if(!Number.isSafeInteger(maxPixels)||maxPixels<1||maxPixels>262144||!Number.isFinite(minCoverage)||minCoverage<.9||minCoverage>1)return null;
 if(vectorPage.elements.some(e=>!e||!Number.isInteger(e.id)))return null;
 const selected=new Map(vectorPage.elements.map(e=>[e.id,e]));if(selected.size!==vectorPage.elements.length)return null;const elements=hit.elementIds.map(id=>selected.get(id));
 if(elements.some(e=>!e||!validatePath(e))||elements.reduce((n,e)=>n+e.pathCommands.length,0)>32768)return null;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const e of elements){const pad=e.style.stroke?e.style.width/2*Math.max(Math.SQRT2,e.style.miter):0,b=e.bounds;x0=Math.min(x0,b[0]-pad);y0=Math.min(y0,b[1]-pad);x1=Math.max(x1,b[2]+pad);y1=Math.max(y1,b[3]+pad);}
 if(vectorPage.textRegions?.some(b=>b[2]>=x0&&b[0]<=x1&&b[3]>=y0&&b[1]<=y1))return null;
 try{
  const corners=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(p=>viewport.convertToViewportPoint(...p));if(corners.some(p=>!finite(p)))return null;
  const left=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[0])))-2),top=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[1])))-2),right=Math.min(image.width,Math.ceil(Math.max(...corners.map(p=>p[0])))+2),bottom=Math.min(image.height,Math.ceil(Math.max(...corners.map(p=>p[1])))+2),width=right-left,height=bottom-top;
  if(width<1||height<1||width>512||height>512||width*height>maxPixels)return null;
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);const m=matrix;ctx.setTransform(m[0],m[1],m[2],m[3],m[4]-left,m[5]-top);
  for(const e of elements){trace(ctx,e.pathCommands);if(e.paintClosesPath)ctx.closePath();if(e.style.fill){ctx.fillStyle=e.style.fill;ctx.fill(e.style.rule);}if(e.style.stroke){ctx.strokeStyle=e.style.stroke;ctx.lineWidth=e.style.width;ctx.lineCap=['butt','round','square'][e.style.cap];ctx.lineJoin=['miter','round','bevel'][e.style.join];ctx.miterLimit=e.style.miter;ctx.stroke();}}
  const rgba=ctx.getImageData(0,0,width,height).data,data=new Uint8Array(width*height);let expected=0,retained=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,target=image.data[(top+y)*image.width+left+x];if(target!==0&&target!==1)return null;const ink=rgba[4*i+3]>128&&rgba[4*i]*.2126+rgba[4*i+1]*.7152+rgba[4*i+2]*.0722<160;if(ink){expected++;if(target){data[i]=1;retained++;}}}
  if(expected<8||retained/expected<minCoverage)return null;
  return {left,top,width,height,data,score:retained/expected};
 }catch{return null;}
}
