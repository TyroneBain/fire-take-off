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
export async function inspectPdfElements({page,OPS,bounds,createCanvas,cancelled=()=>false}){
 const check=()=>{if(cancelled())throw new Error('Selection loading cancelled');};check();
 const viewport=page.getViewport({scale:2,rotation:0}),w=Math.ceil(viewport.width),h=Math.ceil(viewport.height);if(w*h>4000000)throw new Error('Drawing exceeds the current element editing resolution budget');
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
