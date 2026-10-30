import {inkImage,exampleImage} from './matcher.mjs';
export const ELEMENT_RENDERER='pdfjs-6.4.299-paths-1';
export function validElementSelection(value){
 return !!value&&value.renderer===ELEMENT_RENDERER&&Array.isArray(value.ids)&&value.ids.length>0&&value.ids.length<=128&&value.ids.every((n,i,a)=>Number.isInteger(n)&&n>=0&&n<=1000000&&(i===0||n>a[i-1]))&&Array.isArray(value.excluded)&&value.excluded.length<value.ids.length&&value.excluded.every((n,i,a)=>value.ids.includes(n)&&(i===0||n>a[i-1]));
}
export function elementAt(elements,x,y,width,height){
 const px=Math.floor(x),py=Math.floor(y);if(px<0||py<0||px>=width||py>=height)return null;
 // Last painted operation wins when visible paths overlap.
 return elements.findLast(e=>e.ink[py*width+px])?.id??null;
}
export function selectionFilter(selection){const excluded=new Set(selection?.excluded||[]);return index=>!excluded.has(index);}
export function anchoredTemplate(image,box,anchor){
 const template=exampleImage(image,box);return {...template,anchorX:anchor[0]-template.left,anchorY:anchor[1]-template.top};
}
export function editedTemplate(original,filtered,box){
 if(original.width!==filtered.width||original.height!==filtered.height)throw new Error('Selection render dimensions changed');
 const base=exampleImage(original,box),data=new Uint8Array(base.data.length),ignore=new Uint8Array(base.data.length);
 let count=0;
 for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
  const i=y*base.width+x,value=filtered.data[(base.top+y)*filtered.width+base.left+x];
  data[i]=value;count+=value;ignore[i]=base.data[i]&&!value?1:0;
 }
 if(count<8)throw new Error('The cleaned example needs more visible detail');
 return {...base,data,count,ignore,anchorX:base.width/2,anchorY:base.height/2,elementSubset:true};
}
// PDF.js stores one normalized bbox reader on each page, including after a
// failed render. Only readers from our successful full-page render are reusable.
const largeElementMetadata=new WeakMap();
async function inspectLargePdfElements({page,OPS,bounds,createCanvas,cancelled,viewport}){
 let deadline=performance.now()+120000;
 const check=()=>{if(cancelled())throw Error('Selection loading cancelled');if(performance.now()>deadline)throw Error('Selection inspection time budget exceeded');};check();
 const corners=[[bounds[0],bounds[1]],[bounds[0],bounds[3]],[bounds[2],bounds[1]],[bounds[2],bounds[3]]].map(p=>viewport.convertToViewportPoint(...p)),box=[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))].map(Math.round),width=box[2]-box[0],height=box[3]-box[1];
 if(!box.every(Number.isSafeInteger)||width<1||height<1||width>256||height>256||box[0]<0||box[1]<0||box[2]>Math.ceil(viewport.width)||box[3]>Math.ceil(viewport.height))throw Error('Select a symbol no larger than 128 PDF points inside the drawing');
 const ops=await page.getOperatorList();check();if(ops.fnArray.length>1000000)throw Error('Drawing exceeds the element operation budget');
 const eligible=new Set([OPS.stroke,OPS.closeStroke,OPS.fill,OPS.eoFill,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke]),structural=new Set(),unsafe=new Set([OPS.beginGroup,OPS.beginSMaskGroup,OPS.paintFormXObjectBegin,OPS.shadingFill]);
 for(let i=0;i<ops.fnArray.length;i++){const op=ops.fnArray[i],args=ops.argsArray[i];
  if(unsafe.has(op)||op===OPS.setTextRenderingMode&&args[0]>=4)throw Error('Element editing is not yet supported for composited drawings or clipping text');
  if(op===OPS.setGState&&args[0].some(([name,value])=>!['LW','LC','LJ','ML','D','RI','FL'].includes(name)&&!(name==='SMask'&&value===false)&&!(['CA','ca'].includes(name)&&value===1)&&!(name==='BM'&&value==='source-over')))throw Error('Element editing is not yet supported for composited drawings');
  if(op===OPS.clip||op===OPS.eoClip){if(ops.fnArray[i+1]!==OPS.constructPath||ops.argsArray[i+1]?.[0]!==OPS.endPath)throw Error('Element editing does not support combined clipping and painted paths');structural.add(i+1);}
 }
 const paint=new Set(Object.entries(OPS).filter(([k])=>k==='constructPath'||k.startsWith('paint')||['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText','shadingFill'].includes(k)).map(([,v])=>v));
 async function render(canvas,ctx,renderViewport,operationsFilter,recordOperations=false){
  check();const task=page.render({canvas,canvasContext:ctx,viewport:renderViewport,operationsFilter,recordOperations}),timer=setTimeout(()=>task.cancel(),Math.max(1,Math.min(20000,deadline-performance.now()))),poll=setInterval(()=>{if(cancelled())task.cancel();},25);
  try{await task.promise;check();}finally{clearTimeout(timer);clearInterval(poll);}
 }
 let metadata=largeElementMetadata.get(page);
 if(page.recordedBBoxes&&metadata?.reader!==page.recordedBBoxes)throw Error('Selection bounds came from another or incomplete render. Reopen the selection');
 if(!metadata){
  const unit=page.getViewport({scale:1,rotation:0}),scale=Math.min(.5,.99*Math.sqrt(1000000/(unit.width*unit.height))),fullViewport=page.getViewport({scale,rotation:0}),w=Math.ceil(fullViewport.width),h=Math.ceil(fullViewport.height);
  if(!Number.isFinite(scale)||scale<=0||w*h>1000000)throw Error('Drawing exceeds the element metadata budget');
  const canvas=createCanvas(w,h);
  try{await render(canvas,canvas.getContext('2d'),fullViewport,undefined,true);if(!page.recordedBBoxes)throw Error('This PDF renderer cannot inspect selection elements');metadata={reader:page.recordedBBoxes,viewport:fullViewport,width:w,height:h};largeElementMetadata.set(page,metadata);}finally{canvas.width=canvas.height=0;}
 }
 const a=metadata.viewport.convertToViewportPoint(bounds[0],bounds[3]),b=metadata.viewport.convertToViewportPoint(bounds[2],bounds[1]),reader=metadata.reader;
 const candidates=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath&&eligible.has(ops.argsArray[i][0])&&!reader.isEmpty(i)&&reader.maxX(i)*metadata.width>=a[0]&&reader.minX(i)*metadata.width<=b[0]&&reader.maxY(i)*metadata.height>=a[1]&&reader.minY(i)*metadata.height<=b[1]?[i]:[]);
 if(candidates.length>128)throw Error('Selection has too many elements to edit');
 const cropViewport=viewport.clone({offsetX:(viewport.offsetX||0)-box[0],offsetY:(viewport.offsetY||0)-box[1]});
 async function crop(filter){check();const canvas=createCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});try{await render(canvas,ctx,cropViewport,filter);return ctx.getImageData(0,0,width,height);}finally{canvas.width=canvas.height=0;}}
 const original=await crop(),baseline=inkImage(original.data,width,height),trimmed=exampleImage(baseline,[0,0,width,height]),anchor=[trimmed.left+trimmed.width/2,trimmed.top+trimmed.height/2],elements=[];
 for(const id of candidates){check();const rgba=await crop((index,list)=>!paint.has(list.fnArray[index])||structural.has(index)||index===id),ink=inkImage(rgba.data,width,height).data;if(!ink.some(Boolean))continue;
  if(ink.some((v,i)=>v&&!baseline.data[i]))throw Error('Selection contains obscured paths; choose a clearer example');
  const without=await crop(index=>index!==id),visible=new Uint8Array(ink.length);let changed=false;
  for(let i=0;i<ink.length;i++){const p=i*4,different=original.data[p]!==without.data[p]||original.data[p+1]!==without.data[p+1]||original.data[p+2]!==without.data[p+2]||original.data[p+3]!==without.data[p+3];changed||=different;visible[i]=ink[i]&&different?1:0;}
  if(!changed||!visible.some(Boolean))throw Error('Selection contains hidden or redundant paths; choose a clearer example');
  elements.push({id,ink:visible,rgba});await new Promise(resolve=>setTimeout(resolve,0));check();
 }
 const selected=new Set(elements.map(e=>e.id)),joint=await crop((index,list)=>!paint.has(list.fnArray[index])||structural.has(index)||selected.has(index));
 if(!elements.length||original.data.some((value,i)=>value!==joint.data[i]))throw Error('This selection contains text, images or obscured content; editing currently supports visible vector paths only');
 return {elements,box,width,height,viewport,anchor,baseline,async render(excluded=[]){deadline=performance.now()+20000;if(!Array.isArray(excluded)||excluded.some(id=>!selected.has(id)))throw Error('Invalid excluded selection element');return crop(selectionFilter({excluded}));}};
}
export async function inspectPdfElements({page,OPS,bounds,createCanvas,cancelled=()=>false}){
 const check=()=>{if(cancelled())throw new Error('Selection loading cancelled');};check();
 const viewport=page.getViewport({scale:2,rotation:0}),w=Math.ceil(viewport.width),h=Math.ceil(viewport.height);if(w*h>4000000)return inspectLargePdfElements({page,OPS,bounds,createCanvas,cancelled,viewport});
 const a=viewport.convertToViewportPoint(bounds[0],bounds[3]),b=viewport.convertToViewportPoint(bounds[2],bounds[1]),box=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])].map(Math.round),width=box[2]-box[0],height=box[3]-box[1];
 if(width<1||height<1||width>256||height>256)throw new Error('Select a symbol no larger than 128 PDF points');
 const canvas=createCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});
 await page.render({canvas,canvasContext:ctx,viewport,recordOperations:true}).promise;check();
 const baseline=inkImage(ctx.getImageData(box[0],box[1],width,height).data,width,height),original=exampleImage(baseline,[0,0,width,height]);
 const anchor=[original.left+original.width/2,original.top+original.height/2],ops=await page.getOperatorList(),reader=page.recordedBBoxes;
 if(!reader)throw new Error('This PDF renderer cannot inspect selection elements');
 const unsafe=new Set([OPS.clip,OPS.eoClip,OPS.beginGroup,OPS.beginSMaskGroup]);
 if(ops.fnArray.some((op,i)=>unsafe.has(op)||(op===OPS.setTextRenderingMode&&ops.argsArray[i][0]>=4)))throw new Error('Element editing is not yet supported for clipped or composited drawings');
 const paint=new Set(Object.entries(OPS).filter(([k])=>k==='constructPath'||k.startsWith('paint')||['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText','shadingFill'].includes(k)).map(([,v])=>v));
 const eligible=new Set([OPS.stroke,OPS.closeStroke,OPS.fill,OPS.eoFill,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke]);
 const candidates=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath&&eligible.has(ops.argsArray[i][0])&&!reader.isEmpty(i)&&reader.maxX(i)*w>=box[0]&&reader.minX(i)*w<=box[2]&&reader.maxY(i)*h>=box[1]&&reader.minY(i)*h<=box[3]?[i]:[]);
 if(candidates.length>128)throw new Error('Selection has too many elements to edit');
 const elements=[],union=new Uint8Array(width*height),crop=createCanvas(width,height),c=crop.getContext('2d',{willReadFrequently:true});
 for(const id of candidates){check();await page.render({canvas:crop,canvasContext:c,viewport,transform:[1,0,0,1,-box[0],-box[1]],operationsFilter:(index,list)=>!paint.has(list.fnArray[index])||index===id}).promise;const rgba=c.getImageData(0,0,width,height),ink=inkImage(rgba.data,width,height).data;if(!ink.some(Boolean))continue;for(let k=0;k<ink.length;k++)union[k]|=ink[k];elements.push({id,ink,rgba});}
 if(!elements.length||baseline.data.some((v,i)=>v&&!union[i]))throw new Error('This selection contains text or image content; editing currently supports vector paths only');
 return {elements,box,width,height,viewport,anchor,baseline,async render(excluded=[]){check();await page.render({canvas:crop,canvasContext:c,viewport,transform:[1,0,0,1,-box[0],-box[1]],operationsFilter:selectionFilter({excluded})}).promise;return c.getImageData(0,0,width,height);}};
}
