import { inkImage,findMatches } from './matcher.mjs';
onmessage=event=>{
  try { const {rgba,width,height,template}=event.data;postMessage({matches:findMatches(inkImage(new Uint8ClampedArray(rgba),width,height),template,template.elementSubset?{threshold:.95}:{})}); }
  catch(error){postMessage({error:error.message});}
};
