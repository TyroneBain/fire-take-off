import {MAX_COMPARISON_PIXELS} from './comparison.mjs';
export const MAX_OVERLAYS=8;
// Preserve antialiased ink, but let the base drawing show through white paper.
export function overlayInkPixels(data,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_COMPARISON_PIXELS||data.length!==width*height*4)throw new RangeError('Invalid overlay surface');
  const result=new Uint8ClampedArray(data.length);
  for(let i=0;i<data.length;i+=4){const light=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;result[i]=40;result[i+1]=100;result[i+2]=220;result[i+3]=(255-light)*data[i+3]/255;}
  return result;
}
export function overlayPlacement(width,height,offset,scale){
  if(![width,height,scale].every(v=>Number.isFinite(v)&&v>0)||!Array.isArray(offset)||offset.length!==2||!offset.every(Number.isFinite))throw new RangeError('Invalid overlay position');
  return {left:offset[0]*scale,top:offset[1]*scale,width:width*scale,height:height*scale};
}
export function moveOverlay(offset,dx,dy,scale){
  overlayPlacement(1,1,offset,scale);if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new RangeError('Invalid overlay movement');
  return [offset[0]+dx/scale,offset[1]+dy/scale];
}
