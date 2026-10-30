// Keep the original two-pixel/PDF-point grid. Only pages beyond the existing
// four-million-pixel canvas budget take this path; no downsampling is applied.
export const MATCH_IMAGE_PIXELS=4000000;
export const MATCH_TILE_CORE=1488;
export const MATCH_TILE_MARGIN=256;
const fallbackReason='Large drawing uses same-size tiled raster matching';
const checkDimensions=(width,height)=>{if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>64000000)throw Error('Drawing exceeds the tiled matching page budget');};
export function matchTiles(width,height){
 checkDimensions(width,height);const tiles=[];
 for(let y=0;y<height;y+=MATCH_TILE_CORE)for(let x=0;x<width;x+=MATCH_TILE_CORE){
  const x1=Math.min(width,x+MATCH_TILE_CORE),y1=Math.min(height,y+MATCH_TILE_CORE),left=Math.max(0,x-MATCH_TILE_MARGIN),top=Math.max(0,y-MATCH_TILE_MARGIN),right=Math.min(width,x1+MATCH_TILE_MARGIN),bottom=Math.min(height,y1+MATCH_TILE_MARGIN);
  tiles.push({left,top,width:right-left,height:bottom-top,core:[x,y,x1,y1]});
  if(tiles.length>64)throw Error('Drawing exceeds the tiled matching tile budget');
 }
 return tiles;
}
export function createTileBudget({maxTiles=128,maxPixels=256000000,maxMilliseconds=120000,now=()=>performance.now()}={}){
 if(!Number.isSafeInteger(maxTiles)||maxTiles<1||maxTiles>128||!Number.isSafeInteger(maxPixels)||maxPixels<1||maxPixels>256000000||!Number.isFinite(maxMilliseconds)||maxMilliseconds<=0||maxMilliseconds>120000)throw Error('Invalid tiled matching budget');
 const start=now();let tiles=0,pixels=0;
 return {check(){if(now()-start>maxMilliseconds)throw Error('Tiled matching time budget exceeded; reduce the drawing scope');},consume(tile){this.check();if(++tiles>maxTiles||(pixels+=tile.width*tile.height)>maxPixels)throw Error('Tiled matching work budget exceeded; reduce the drawing scope');}};
}
export async function renderMatchRegion({page,viewport,region,createCanvas,operationsFilter,cancelled=()=>false,onRender=()=>{}}){
 const check=()=>{if(cancelled())throw Error('Matching cancelled; no results saved');};check();
 checkDimensions(Math.ceil(viewport.width),Math.ceil(viewport.height));
 const {left,top,width,height}=region;if(![left,top,width,height].every(Number.isSafeInteger)||left<0||top<0||width<1||height<1||width*height>MATCH_IMAGE_PIXELS||left+width>Math.ceil(viewport.width)||top+height>Math.ceil(viewport.height))throw Error('Invalid matching render region');
 const cropViewport=viewport.clone({offsetX:(viewport.offsetX||0)-left,offsetY:(viewport.offsetY||0)-top}),canvas=createCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const task=page.render({canvas,canvasContext:ctx,viewport:cropViewport,operationsFilter});onRender(task);let timedOut=false;const timer=setTimeout(()=>{timedOut=true;task.cancel();},20000);
 try{await task.promise;check();const image=ctx.getImageData(0,0,width,height);return {image,data:image.data,width,height,viewport:cropViewport,vectorPage:{supported:false,reason:fallbackReason},cropped:true};}
 catch(error){if(timedOut)throw Error('Matching tile rendering timed out');throw error;}
 finally{clearTimeout(timer);canvas.width=0;canvas.height=0;}
}
export async function renderMatchSelection(options){
 const {viewport,bounds}=options;if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[2]<=bounds[0]||bounds[3]<=bounds[1])throw Error('Invalid matching selection');
 const corners=[[bounds[0],bounds[1]],[bounds[0],bounds[3]],[bounds[2],bounds[1]],[bounds[2],bounds[3]]].map(p=>viewport.convertToViewportPoint(...p));
 const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 if(Math.round(x1)-Math.round(x0)>256||Math.round(y1)-Math.round(y0)>256)throw Error('Select a single symbol no larger than 128 PDF points');
 const left=Math.max(0,Math.floor(x0)-2),top=Math.max(0,Math.floor(y0)-2),right=Math.min(Math.ceil(viewport.width),Math.ceil(x1)+2),bottom=Math.min(Math.ceil(viewport.height),Math.ceil(y1)+2);
 return renderMatchRegion({...options,region:{left,top,width:right-left,height:bottom-top}});
}
export function tiledMatchPage(options){
 const width=Math.ceil(options.viewport.width),height=Math.ceil(options.viewport.height),tiles=matchTiles(width,height);
 return {tiled:true,width,height,viewport:options.viewport,vectorPage:{supported:false,reason:fallbackReason},tiles,renderTile:region=>renderMatchRegion({...options,region})};
}
export async function searchMatchTiles({raster,template,search,cancelled=()=>false,progress=()=>{},budget=createTileBudget()}){
 if(!raster?.tiled||!Array.isArray(raster.tiles)||raster.tiles.length>64)throw Error('Invalid tiled matching page');
 if(!Number.isInteger(template?.width)||!Number.isInteger(template?.height)||template.width<1||template.height<1||template.width>256||template.height>256)throw Error('Invalid tiled matching template');
 const check=()=>{if(cancelled())throw Error('Matching cancelled; no results saved');budget.check();},hits=[],bins=new Map();
 for(const [index,tile]of raster.tiles.entries()){
  check();budget.consume(tile);progress(index+1,raster.tiles.length);const rendered=await raster.renderTile(tile);check();
  const found=await search(rendered,template);check();if(!Array.isArray(found)||found.length>5000)throw Error('Too many matching tile results');
  for(const hit of found){
   const localX=hit.left+(hit.anchorX??template.anchorX??hit.width/2),localY=hit.top+(hit.anchorY??template.anchorY??hit.height/2),x=tile.left+localX,y=tile.top+localY;
   if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(hit.score))throw Error('Invalid raster tile match');
   if(x<tile.core[0]||x>=tile.core[2]||y<tile.core[1]||y>=tile.core[3])continue;
   // Ownership is deterministic; the small anchor index also rejects any
   // duplicate produced by equivalent orientations within one owned core.
   let duplicate=false;for(let yy=Math.floor(y)-1;yy<=Math.floor(y)+1;yy++)for(let xx=Math.floor(x)-1;xx<=Math.floor(x)+1;xx++)if((bins.get(xx+':'+yy)||[]).some(p=>Math.abs(p[0]-x)<.5&&Math.abs(p[1]-y)<.5))duplicate=true;
   if(duplicate)continue;const key=Math.floor(x)+':'+Math.floor(y);if(!bins.has(key))bins.set(key,[]);bins.get(key).push([x,y]);
   const [nativeX,nativeY]=raster.viewport.convertToPdfPoint(x,y);hits.push({...hit,x:nativeX,y:nativeY});if(hits.length>5000)throw Error('Counting exceeds 5000 results; reduce the drawing scope');
  }
 }
 check();return hits.sort((a,b)=>a.y-b.y||a.x-b.x);
}
