import {inkImage,exampleImage,rotateTemplate,includesRotations,matchingThreshold} from './matcher.mjs';
import {editedTemplate,selectionFilter} from './pdf-elements.mjs';
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
export function setupCountInk({context,pdfjs,onReady}){
 const pages=new Map(),templates=new Map(),masks=new Map();let requested='',running=false,epoch=0;
 const key=(m,e)=>`${m.drawing_id}:${m.page}:${m.id}:${m.x}:${m.y}:${e.id}:${e.version}`;
 const trim=(map,limit)=>{while(map.size>limit)map.delete(map.keys().next().value);};
 async function raster(d,number,elements){
  const id=`${d.digest}:${number}:${JSON.stringify(elements||null)}`;if(pages.has(id))return pages.get(id);
  const task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});
  try{const page=await(await task.promise).getPage(number),viewport=page.getViewport({scale:2,rotation:0}),width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);if(width*height>4000000)throw Error('Colour overlay image budget exceeded');
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport,operationsFilter:elements?selectionFilter(elements):undefined}).promise;
   const result={...inkImage(ctx.getImageData(0,0,width,height).data,width,height),viewport};pages.set(id,result);trim(pages,3);return result;
  }finally{await task.destroy();}
 }
 async function templateFor(e,state){const id=e.id+':'+e.version;if(templates.has(id))return templates.get(id);const def=e.example,d=state.drawings.find(d=>d.id===def.drawing_id&&d.digest===def.digest);if(!d)throw Error('Selection source missing');const original=await raster(d,def.page),b=def.bounds,box=[...original.viewport.convertToViewportPoint(b[0],b[3]),...original.viewport.convertToViewportPoint(b[2],b[1])];const t=def.elements?editedTemplate(original,await raster(d,def.page,def.elements),box):exampleImage(original,box);templates.set(id,t);trim(templates,100);return t;}
 function maskURL(mask){const canvas=document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height;const ctx=canvas.getContext('2d'),rgba=ctx.createImageData(mask.width,mask.height);for(let i=0;i<mask.data.length;i++)rgba.data[i*4+3]=mask.data[i]*255;ctx.putImageData(rgba,0,0);return canvas.toDataURL('image/png');}
 async function prepare(){
  if(running)return;const c=context();if(!c.drawing||!c.viewport)return;const rows=(c.state.countMarks||[]).filter(m=>m.drawing_id===c.drawing.id&&m.page===c.pageNumber&&m.origin==='automatic'&&m.included&&m.example_id),examples=new Map(c.state.countExamples.map(e=>[e.id,e]));
  const signature=c.drawing.id+':'+c.pageNumber+':'+rows.map(m=>`${m.id}:${m.x}:${m.y}:${m.example_id}:${examples.get(m.example_id)?.version}`).join(',');if(signature===requested)return;requested=signature;running=true;const token=++epoch;
  try{const target=await raster(c.drawing,c.pageNumber);let completed=0;for(const m of rows){const e=examples.get(m.example_id);if(!e)continue;const id=key(m,e);if(masks.has(id))continue;
    try{const t=await templateFor(e,c.state),mask=alignedInk(target,t,target.viewport.convertToViewportPoint(m.x,m.y),{rotations:includesRotations(e.example.algorithm),threshold:matchingThreshold(e.example.algorithm)});masks.set(id,mask?{...mask,data:undefined,url:maskURL(mask),viewport:target.viewport}:null);}catch{masks.set(id,null);}
    // Yield in bounded batches so large result sets do not lock drawing navigation.
    if(++completed%24===0){await new Promise(r=>setTimeout(r,0));if(context().drawing?.id!==c.drawing.id||context().pageNumber!==c.pageNumber)break;}
   }trim(masks,5000);
  }catch{/* Unavailable source or rendering failure keeps an explicit fallback marker. */}
  finally{running=false;const now=context();if(now.drawing?.id!==c.drawing.id||now.pageNumber!==c.pageNumber)requested='';if(token===epoch)onReady();}
 }
 return {prepare,get(m){const e=context().state.countExamples.find(e=>e.id===m.example_id);return e?masks.get(key(m,e)):null;}};
}
