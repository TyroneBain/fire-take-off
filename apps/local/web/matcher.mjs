import {VECTOR_MATCHER_VERSION,VECTOR_FIXED_VERSION} from './vector-recognition.mjs';
export const MATCHER_VERSION='binary-overlap-1';
export function inkImage(rgba,width,height) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4000000||rgba.length!==width*height*4)throw new Error('Page exceeds matching image budget');
  const data=new Uint8Array(width*height);
  for(let i=0;i<data.length;i++)data[i]=rgba[i*4+3]>128&&(rgba[i*4]*.2126+rgba[i*4+1]*.7152+rgba[i*4+2]*.0722)<160?1:0;
  return {data,width,height};
}
export function exampleImage(image,box) {
  const {data,width,height}=image;
  let [x0,y0,x1,y1]=box.map(Math.round);x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(width,x1);y1=Math.min(height,y1);
  if(x1-x0>256||y1-y0>256||x1<=x0||y1<=y0)throw new Error('Select a single symbol no larger than 128 PDF points');
  let left=x1,top=y1,right=x0,bottom=y0,count=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[y*width+x]){count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(count<8)throw new Error('The example needs more visible detail');
  left=Math.max(x0,left-2);top=Math.max(y0,top-2);right=Math.min(x1-1,right+2);bottom=Math.min(y1-1,bottom+2);
  const w=right-left+1,h=bottom-top+1,result=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)result[y*w+x]=data[(top+y)*width+left+x];
  return {data:result,width:w,height:h,count,left,top};
}
// A saved algorithm identifies its matching contract; legacy examples stay orientation-specific.
export const EXACT_MATCHER_VERSION='binary-overlap-2';
export const ROTATION_MATCHER_VERSION='binary-overlap-rotations-1';
export const ROTATION_ELEMENTS_VERSION='binary-elements-rotations-1';
export function matchingThreshold(algorithm){return (algorithm===EXACT_MATCHER_VERSION||includesRotations(algorithm)||algorithm.startsWith('binary-elements-')||isVectorAlgorithm(algorithm)) ? .95 : .85;}
export function includesRotations(algorithm){return algorithm===ROTATION_MATCHER_VERSION||algorithm===ROTATION_ELEMENTS_VERSION||algorithm===VECTOR_MATCHER_VERSION;}
function integralImage(image){
  const {data,width,height}=image;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4000000||data.length!==width*height)throw new Error('Invalid matcher input');
  const stride=width+1,integral=new Uint32Array((width+1)*(height+1));
  for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){const v=data[y*width+x];if(v!==0&&v!==1)throw new Error('Invalid binary image');row+=v;integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
  return integral;
}
function scanMatches(image,template,{threshold=.85,allowExtraInk=false},integral,budget){
  const {data,width,height}=image,{width:w,height:h,data:t}=template;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>256||h>256||w*h!==t.length||!Number.isFinite(threshold)||threshold<.5||threshold>1)throw new Error('Invalid matcher input');
  const ignore=template.ignore;
  if(ignore&&(ignore.length!==t.length||ignore.some((v,i)=>(v!==0&&v!==1)||(v&&t[i]))))throw new Error('Invalid ignored selection pixels');
  const ink=[],erased=[];
  for(let i=0;i<t.length;i++){if(t[i]!==0&&t[i]!==1)throw new Error('Invalid binary template');const offset=Math.floor(i/w)*width+i%w;if(t[i])ink.push(offset);if(ignore?.[i])erased.push(offset);}
  const count=ink.length,ignored=erased.length;if(count<8)throw new Error('Example has insufficient detail');
  const stride=width+1,candidates=[];
  for(let y=0;y<=height-h;y++)for(let x=0;x<=width-w;x++){
    if(++budget.positions>budget.maxPositions)throw new Error('Matching scan budget exceeded; use a smaller drawing');
    const n=integral[(y+h)*stride+x+w]-integral[y*stride+x+w]-integral[(y+h)*stride+x]+integral[y*stride+x];
    if(n<count*threshold||!allowExtraInk&&n>count/threshold+ignored)continue;
    if((budget.comparisons+=count+ignored)>budget.maxComparisons)throw new Error('Matching budget exceeded; use a cleaner example or a smaller drawing');
    let overlap=0,ignoredInk=0;const start=y*width+x;
    for(const offset of ink)overlap+=data[start+offset];
    for(const offset of erased)ignoredInk+=data[start+offset];
    const score=allowExtraInk?overlap/count:overlap/(count+n-ignoredInk-overlap);
    if(score>=threshold){candidates.push({left:x,top:y,width:w,height:h,score});if(++budget.candidates>25000)throw new Error('Too many ambiguous matches; refine the example');}
  }
  candidates.sort((a,b)=>b.score-a.score||a.top-b.top||a.left-b.left);
  const matches=[];
  for(const c of candidates)if(!matches.some(m=>Math.abs(c.left-m.left)<w*.6&&Math.abs(c.top-m.top)<h*.6)){matches.push(c);if(matches.length>5000)throw new Error('Too many matches');}
  return matches.sort((a,b)=>a.top-b.top||a.left-b.left);
}
function workBudget(options){
  const {maxComparisons=60000000,maxPositions=16000000}=options;
  if(!Number.isSafeInteger(maxComparisons)||maxComparisons<1||!Number.isSafeInteger(maxPositions)||maxPositions<1)throw new Error('Invalid matching budget');
  return {maxComparisons,maxPositions,comparisons:0,positions:0,candidates:0};
}
export function findMatches(image,template,options={}){return scanMatches(image,template,options,integralImage(image),workBudget(options));}
export function rotateTemplate(template){
  const {width:w,height:h,data,ignore}=template;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>256||h>256||data.length!==w*h||ignore&&ignore.length!==data.length)throw new Error('Invalid template dimensions');
  const rotated=new Uint8Array(w*h),mask=ignore?new Uint8Array(w*h):undefined;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const before=y*w+x,after=x*h+(h-1-y);rotated[after]=data[before];if(mask)mask[after]=ignore[before];}
  return {...template,width:h,height:w,data:rotated,...(mask?{ignore:mask}:{}),anchorX:h-(template.anchorY??h/2),anchorY:template.anchorX??w/2};
}
export function findSymbolMatches(image,template,{rotations=false,...options}={}){
  const integral=integralImage(image),budget=workBudget(options),variants=[],found=[];let current=template;
  const identical=(a,b)=>a.width===b.width&&a.height===b.height&&(a.anchorX??a.width/2)===(b.anchorX??b.width/2)&&(a.anchorY??a.height/2)===(b.anchorY??b.height/2)&&a.data.every((v,i)=>v===b.data[i]&&(a.ignore?.[i]??0)===(b.ignore?.[i]??0));
  for(let angle=0;angle<(rotations?360:90);angle+=90){
    if(!variants.some(v=>identical(v,current))){
      variants.push(current);
      for(const hit of scanMatches(image,current,options,integral,budget))found.push({...hit,rotation:angle,anchorX:current.anchorX??current.width/2,anchorY:current.anchorY??current.height/2});
    }
    if(rotations)current=rotateTemplate(current);
  }
  // Compare transformed anchors, not bounding-box origins (non-square symbols swap dimensions).
  found.sort((a,b)=>b.score-a.score||a.rotation-b.rotation||a.top-b.top||a.left-b.left);
  const matches=[];
  for(const hit of found)if(!matches.some(m=>Math.abs(hit.left+hit.anchorX-m.left-m.anchorX)<Math.min(hit.width,m.width)*.6&&Math.abs(hit.top+hit.anchorY-m.top-m.anchorY)<Math.min(hit.height,m.height)*.6)){
    matches.push(hit);if(matches.length>5000)throw new Error('Too many matches');
  }
  return matches.sort((a,b)=>a.top+a.anchorY-b.top-b.anchorY||a.left+a.anchorX-b.left-b.anchorX);
}

export function isVectorAlgorithm(algorithm){return algorithm===VECTOR_MATCHER_VERSION||algorithm===VECTOR_FIXED_VERSION;}
