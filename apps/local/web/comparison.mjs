export const MAX_COMPARISON_PIXELS=4_000_000;
export function comparisonScale(views){
  if(!views.length||views.some(v=>!Number.isFinite(v.width)||!Number.isFinite(v.height)||v.width<=0||v.height<=0))throw new RangeError('Invalid comparison dimensions');
  return Math.min(1,...views.map(v=>Math.min(1800/Math.max(v.width,v.height),Math.sqrt(MAX_COMPARISON_PIXELS/(v.width*v.height)))));
}
export function compareRasters(original,revised,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_COMPARISON_PIXELS)throw new RangeError('Comparison surface exceeds limit');
  const length=width*height*4;if(original.length!==length||revised.length!==length)throw new RangeError('Comparison raster dimensions differ');
  const pixels=new Uint8ClampedArray(length),counts={original:0,revised:0,shared:0};
  const ink=(data,i)=>{const alpha=data[i+3]/255;return (data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)*alpha+255*(1-alpha)<200;};
  for(let i=0;i<length;i+=4){const a=ink(original,i),b=ink(revised,i);let color;
    if(a&&b){counts.shared++;color=[30,30,30];}else if(a){counts.original++;color=[220,48,48];}else if(b){counts.revised++;color=[40,100,220];}else color=[255,255,255];
    pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];pixels[i+3]=255;
  }
  return {pixels,counts};
}
export function comparisonKey(context){return context.drawing&&context.viewport?`${context.drawing.id}:${context.pageNumber}:${context.viewport.rotation}`:null;}
