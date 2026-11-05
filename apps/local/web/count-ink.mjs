import {inkImage,exampleImage,rotateTemplate,isVectorAlgorithm,includesRotations,includesScales,matchingThreshold} from './matcher.mjs';
import {editedTemplate} from './pdf-elements.mjs';
import {preparePdfSelectionFilter} from './pdf-element-operations.mjs';
import {extractVectorPage,resolveVectorTextBounds,createVectorTemplate} from './vector-recognition.mjs';
import {vectorInkMask} from './vector-ink.mjs';
import {isVectorReviewAlgorithm} from './vector-review-policy.mjs';
import {prepareNativeCountInk,nativeDecisionForMark} from './native-count-ink.mjs';
// Return only retained template pixels that are actually present in this target drawing.
export function alignedInk(image,template,centre,{rotations=false,threshold=.85}={}){
 const variants=[template];if(rotations)for(let i=1;i<4;i++)variants.push(rotateTemplate(variants.at(-1)));
 let best=null;
 for(const t of variants){const anchor=[t.anchorX??t.width/2,t.anchorY??t.height/2],ox=Math.round(centre[0]-anchor[0]),oy=Math.round(centre[1]-anchor[1]);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const left=ox+dx,top=oy+dy;if(left<0||top<0||left+t.width>image.width||top+t.height>image.height)continue;
   let overlap=0,union=0;for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){const i=y*t.width+x,target=image.data[(top+y)*image.width+left+x];if(t.ignore?.[i])continue;overlap+=t.data[i]&target;union+=t.data[i]|target;}
   const score=union?overlap/union:0,offset=dx*dx+dy*dy;if(score<threshold||best&&(score<best.score||score===best.score&&offset>=best.offset))continue;
   best={t,left,top,score,offset};
  }
 }
 if(!best)return null;const {t,left,top}=best,data=new Uint8Array(t.data.length);
 for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++)data[y*t.width+x]=t.data[y*t.width+x]&image.data[(top+y)*image.width+left+x];
 return {left,top,width:t.width,height:t.height,data,score:best.score};
}
export function inkTransform(sourceViewport,targetViewport,mask){
 const p=(x,y)=>targetViewport.convertToViewportPoint(...sourceViewport.convertToPdfPoint(x,y)),a=p(mask.left,mask.top),b=p(mask.left+mask.width,mask.top),c=p(mask.left,mask.top+mask.height);
 return [(b[0]-a[0])/mask.width,(b[1]-a[1])/mask.width,(c[0]-a[0])/mask.height,(c[1]-a[1])/mask.height,...a];
}
// The store identifies a saved instance within half a native PDF point on each
// axis. Multiple geometric candidates in that window are deliberately ambiguous.
export function vectorHitIndex(hits){
 if(!Array.isArray(hits)||hits.length>5000)throw Error('Colour overlay hit budget exceeded');
 const bins=new Map();for(const hit of hits){if(!Number.isFinite(hit?.x)||!Number.isFinite(hit?.y))throw Error('Invalid colour overlay anchor');const key=Math.floor(hit.x)+':'+Math.floor(hit.y);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(hit);}
 return {at(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return null;let found=null;for(let yy=Math.floor(y)-1;yy<=Math.floor(y)+1;yy++)for(let xx=Math.floor(x)-1;xx<=Math.floor(x)+1;xx++)for(const hit of bins.get(xx+':'+yy)||[])if(Math.abs(hit.x-x)<.5&&Math.abs(hit.y-y)<.5){if(found)return null;found=hit;}return found;}};
}
function searchVectorWorker(request){return new Promise((resolve,reject)=>{
 const worker=new Worker('/match-worker.mjs',{type:'module'}),finish=()=>{clearTimeout(timer);worker.terminate();},timer=setTimeout(()=>{finish();reject(Error('Colour overlay vector search timed out'));},20000);
 worker.onmessage=event=>{finish();event.data.error?reject(Error(event.data.error)):resolve(event.data);};worker.onerror=event=>{finish();reject(Error(event.message||'Colour overlay vector search failed'));};
 try{worker.postMessage({...request,vectorOnly:true});}catch(error){finish();reject(error);}
});}
const browserCanvas=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;};
export function setupCountInk({context,pdfjs,onReady,createCanvas=browserCanvas,searchVector=searchVectorWorker}){
 const pages=new Map(),templates=new Map(),masks=new Map(),hitIndexes=new Map();let requested='',running=false,epoch=0;
 const key=(m,e)=>`${m.drawing_id}:${m.page}:${m.id}:${m.x}:${m.y}:${e.id}:${e.version}`;
 const trim=(map,limit)=>{while(map.size>limit)map.delete(map.keys().next().value);};
 const trimNative=()=>{const entries=[...masks].filter(([,mask])=>mask?.native);let pixels=entries.reduce((sum,[,mask])=>sum+mask.width*mask.height,0);while(entries.length>512||pixels>4000000){const [id,mask]=entries.shift();pixels-=mask.width*mask.height;masks.delete(id);}};
 async function raster(d,number,elements,vector=false,cancelled=()=>false){
  if(cancelled())throw Error('Colour overlay preparation cancelled');
  const id=`${d.digest}:${number}:${JSON.stringify(elements||null)}:${vector}`;if(pages.has(id))return pages.get(id);
  const task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});
  try{const page=await(await task.promise).getPage(number),viewport=page.getViewport({scale:2,rotation:0}),width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);if(width*height>4000000)throw Error('Colour overlay image budget exceeded');
   let vectorPage=vector?extractVectorPage({operatorList:await page.getOperatorList(),OPS:pdfjs.OPS}):null;
   const operationsFilter=await preparePdfSelectionFilter({page,OPS:pdfjs.OPS,selection:elements,createCanvas,cancelled});if(cancelled())throw Error('Colour overlay preparation cancelled');
   const canvas=createCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvas,canvasContext:ctx,viewport,recordOperations:!!vectorPage?.pendingTextBounds,operationsFilter}).promise;if(cancelled())throw Error('Colour overlay preparation cancelled');
   if(vectorPage?.pendingTextBounds)vectorPage=resolveVectorTextBounds(vectorPage,{reader:page.recordedBBoxes,viewport,width,height});
   const result={...inkImage(ctx.getImageData(0,0,width,height).data,width,height),viewport,vectorPage,vectorElements:vectorPage?.supported?new Map(vectorPage.elements.map(e=>[e.id,e])):null};pages.set(id,result);trim(pages,3);return result;
  }finally{await task.destroy();}
 }
 async function templateFor(e,state,cancelled){const id=e.id+':'+e.version;if(templates.has(id))return templates.get(id);const def=e.example,d=state.drawings.find(d=>d.id===def.drawing_id&&d.digest===def.digest);if(!d)throw Error('Selection source missing');const vector=isVectorAlgorithm(def.algorithm),original=await raster(d,def.page,null,vector,cancelled),b=def.bounds,box=[...original.viewport.convertToViewportPoint(b[0],b[3]),...original.viewport.convertToViewportPoint(b[2],b[1])],base=exampleImage(original,box);const t=def.elements?editedTemplate(original,await raster(d,def.page,def.elements,false,cancelled),box):base;
  if(vector){const anchor=original.viewport.convertToPdfPoint(base.left+base.width/2,base.top+base.height/2);t.vector=createVectorTemplate(original.vectorPage,{bounds:b,ids:def.elements?.ids,excluded:def.elements?.excluded,anchor});t.matchRotations=includesRotations(def.algorithm);t.matchScales=includesScales(def.algorithm);}
  templates.set(id,t);trim(templates,100);return t;
 }
 async function verifiedMask(target,template,e,m,digest){
  if(!target.vectorPage?.supported||!template.vector?.supported)return null;
  const id=`${digest}:${m.page}:${e.id}:${e.version}`;
  if(!hitIndexes.has(id)){hitIndexes.set(id,null);trim(hitIndexes,4);const result=await searchVector({vectorPage:target.vectorPage,template:{vector:template.vector,matchRotations:template.matchRotations,matchScales:template.matchScales},vectorOnly:true});hitIndexes.set(id,result.engine==='vector'?vectorHitIndex(result.matches):null);}
  const hit=hitIndexes.get(id)?.at(m.x,m.y);if(!hit||!Array.isArray(hit.elementIds))return null;
  const selected=hit.elementIds.map(id=>target.vectorElements.get(id));if(selected.some(e=>!e))return null;
  // Supplying only the verified retained paths avoids rebuilding a whole-page
  // element map for every mark; text visibility exclusions remain unchanged.
  return vectorInkMask({vectorPage:{...target.vectorPage,elements:selected},hit,viewport:target.viewport,image:target,createCanvas});
 }
 function maskURL(mask){const canvas=createCanvas(mask.width,mask.height),ctx=canvas.getContext('2d'),rgba=ctx.createImageData(mask.width,mask.height);for(let i=0;i<mask.data.length;i++)rgba.data[i*4+3]=mask.data[i]*255;ctx.putImageData(rgba,0,0);return canvas.toDataURL('image/png');}
 async function prepare(){
  if(running)return;const c=context();if(!c.drawing||!c.viewport)return;const rows=(c.state.countMarks||[]).filter(m=>m.drawing_id===c.drawing.id&&m.page===c.pageNumber&&m.origin==='automatic'&&m.included&&m.example_id),examples=new Map(c.state.countExamples.map(e=>[e.id,e]));
  const signature=c.drawing.id+':'+c.drawing.digest+':'+c.pageNumber+':'+rows.map(m=>`${m.id}:${m.x}:${m.y}:${m.example_id}:${examples.get(m.example_id)?.version}`).join(',');if(signature===requested)return;requested=signature;running=true;const token=++epoch;
  const stale=()=>token!==epoch||context().drawing?.id!==c.drawing.id||context().drawing?.digest!==c.drawing.digest||context().pageNumber!==c.pageNumber;
  try{
   const native=rows.filter(m=>isVectorReviewAlgorithm(examples.get(m.example_id)?.example.algorithm)),legacy=rows.filter(m=>!isVectorReviewAlgorithm(examples.get(m.example_id)?.example.algorithm));
   const missing=native.filter(m=>!masks.has(key(m,examples.get(m.example_id))));
   for(let offset=0;offset<missing.length;offset+=128){if(stale())break;const batch=missing.slice(offset,offset+128);try{
     const result=await prepareNativeCountInk({pdfjs,drawing:c.drawing,pageNumber:c.pageNumber,marks:batch,examples:[...examples.values()],createCanvas,cancelled:stale});if(stale())break;
     for(const m of batch){const mask=result.masks.get(m.id);masks.set(key(m,examples.get(m.example_id)),mask?{...mask,native:true}:null);}
    }catch{if(!stale())for(const m of batch)masks.set(key(m,examples.get(m.example_id)),null);}trimNative();trim(masks,5000);
   }
   if(stale()||!legacy.length)return;
   const vector=legacy.some(m=>isVectorAlgorithm(examples.get(m.example_id)?.example.algorithm)),target=await raster(c.drawing,c.pageNumber,null,vector,stale);let completed=0;for(const m of legacy){const e=examples.get(m.example_id);if(!e)continue;const id=key(m,e);if(masks.has(id))continue;
    try{const t=await templateFor(e,c.state,stale);if(stale())break;let mask=null;if(isVectorAlgorithm(e.example.algorithm)){try{mask=await verifiedMask(target,t,e,m,c.drawing.digest);}catch{/* A failed geometric check retains the established raster/outline fallback. */}}
     if(stale())break;if(!mask)mask=alignedInk(target,t,target.viewport.convertToViewportPoint(m.x,m.y),{rotations:includesRotations(e.example.algorithm),threshold:matchingThreshold(e.example.algorithm)});masks.set(id,mask?{...mask,data:undefined,url:maskURL(mask),viewport:target.viewport}:null);}catch{if(!stale())masks.set(id,null);}
    // Yield in bounded batches so large result sets do not lock drawing navigation.
    if(++completed%24===0){await new Promise(r=>setTimeout(r,0));if(context().drawing?.id!==c.drawing.id||context().pageNumber!==c.pageNumber)break;}
   }trim(masks,5000);
  }catch{/* Unavailable source or rendering failure keeps an explicit fallback marker. */}
  finally{running=false;const now=context();if(now.drawing?.id!==c.drawing.id||now.pageNumber!==c.pageNumber)requested='';if(token===epoch)onReady();}
 }
 return {prepare,get(m){if(!m.included||m.origin!=='automatic')return null;const c=context(),e=c.state.countExamples.find(e=>e.id===m.example_id);if(isVectorReviewAlgorithm(e?.example.algorithm)&&!nativeDecisionForMark({mark:m,example:e,drawing:c.drawing,pageNumber:c.pageNumber}))return null;return e?masks.get(key(m,e)):null;}};
}
