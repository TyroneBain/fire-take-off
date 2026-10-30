// Original opt-in appearance experiment. No saved-policy or UI integration here.
// A distance match is only a proposal: RGB registration and symmetric contrast
// detail checks decide acceptance. Scores are similarities, not probabilities.
import {inkImage,findSymbolMatches,rotateTemplate} from './matcher.mjs';
export {APPEARANCE_MATCHER_VERSION,APPEARANCE_FIXED_VERSION} from './appearance-policy.mjs';
function appearanceError(message,code='APPEARANCE_BUDGET'){const error=new Error(message);error.code=code;return error;}
function input(image,template=false){
 const {width,height,data}=image??{};
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>(template?4096:4000000)||template&&(width>256||height>256)||!(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||data.length!==width*height*4)throw appearanceError('Invalid or oversized appearance image','APPEARANCE_UNSUPPORTED');
 for(let i=3;i<data.length;i+=4)if(data[i]!==255)throw appearanceError('Appearance matching requires an opaque rendered image','APPEARANCE_UNSUPPORTED');
 if(template){if(image.ignore)throw appearanceError('Appearance matching does not support ignored selection pixels','APPEARANCE_UNSUPPORTED');for(const [name,limit]of [['anchorX',width],['anchorY',height]])if(image[name]!==undefined&&(!Number.isFinite(image[name])||image[name]<0||image[name]>limit))throw appearanceError('Invalid appearance template anchor','APPEARANCE_UNSUPPORTED');}
}
function workBudget({cancelled,maxVerificationSamples=100000000,maxFeatureComparisons=10000000}){
 if(typeof cancelled!=='function'||!Number.isSafeInteger(maxVerificationSamples)||maxVerificationSamples<1||maxVerificationSamples>250000000||!Number.isSafeInteger(maxFeatureComparisons)||maxFeatureComparisons<1||maxFeatureComparisons>25000000)throw appearanceError('Invalid appearance work budget','APPEARANCE_UNSUPPORTED');
 let samples=0,features=0;return {check(){if(cancelled())throw appearanceError('Matching cancelled; no results saved','APPEARANCE_CANCELLED');},samples(n){this.check();if((samples+=n)>maxVerificationSamples)throw appearanceError('Appearance verification budget exceeded');},feature(){if((++features&4095)===0)this.check();if(features>maxFeatureComparisons)throw appearanceError('Appearance detail budget exceeded');},counts(){return {verificationSamples:samples,featureComparisons:features};}};
}
function rotateRGBA(t){const data=new Uint8ClampedArray(t.data.length);for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){const a=(y*t.width+x)*4,b=(x*t.height+t.height-1-y)*4;data.set(t.data.slice(a,a+4),b);}return {...t,width:t.height,height:t.width,data,anchorX:t.height-(t.anchorY??t.height/2),anchorY:t.anchorX??t.width/2};}
const lum=(d,i)=>(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722);
function components(image,threshold){const {width:w,height:h,data}=image,seen=new Uint8Array(w*h),out=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const start=y*w+x;if(seen[start]||lum(data,start*4)>threshold)continue;seen[start]=1;const queue=[start];let sx=0,sy=0,edge=false;for(let k=0;k<queue.length;k++){const at=queue[k],xx=at%w,yy=Math.floor(at/w);sx+=xx;sy+=yy;edge||=xx===0||yy===0||xx===w-1||yy===h-1;for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=xx+dx,ny=yy+dy,i=ny*w+nx;if(nx>=0&&ny>=0&&nx<w&&ny<h&&!seen[i]&&lum(data,i*4)<=threshold){seen[i]=1;queue.push(i);}}}out.push({area:queue.length,x:sx/queue.length,y:sy/queue.length,edge,pixels:queue});}return out;}
function appearanceProposals(image,template,{threshold=.98,minInkRatio=.8,maxInkRatio=1.25,maxComparisons=300000000,maxPositions=16000000,rotations=true,cancelled=()=>false,energyImage=null,energyTemplate=null,stats={}}={}){
 const {width:W,height:H,data}=image,stride=W+1,integral=new Uint32Array((W+1)*(H+1)),dilated=new Uint8Array(data.length);
 for(let y=0;y<H;y++){let row=0;for(let x=0;x<W;x++){const i=y*W+x;row+=data[i];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;if(data[i]){dilated[i]=1;if(x)dilated[i-1]=1;if(x+1<W)dilated[i+1]=1;if(y)dilated[i-W]=1;if(y+1<H)dilated[i+W]=1;}}}
 let energyIntegral=null;if(energyImage){energyIntegral=new Float64Array((W+1)*(H+1));for(let y=0;y<H;y++){let row=0;for(let x=0;x<W;x++){row+=energyImage[y*W+x];energyIntegral[(y+1)*stride+x+1]=energyIntegral[y*stride+x+1]+row;}}}
 let positions=0,comparisons=0,densityCandidates=0,forwardPassed=0,variants=[],candidates=[],current=template;
 const tick=()=>{if(++comparisons>maxComparisons)throw appearanceError('Tolerance comparison budget exceeded');};
 for(let rotation=0;rotation<(rotations?360:90);rotation+=90){
  const t=current;current=rotateTemplate(current);if(variants.some(v=>v.width===t.width&&v.height===t.height&&v.data.every((p,i)=>p===t.data[i])))continue;variants.push(t);
  const w=t.width,h=t.height,ink=[],reverse=[],td=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(t.data[y*w+x]){ink.push(y*W+x);td[y*w+x]=1;if(x)td[y*w+x-1]=1;if(x+1<w)td[y*w+x+1]=1;if(y)td[(y-1)*w+x]=1;if(y+1<h)td[(y+1)*w+x]=1;}
  // Interleave samples so an unrelated solid region doesn't pass on one edge only.
  const shuffled=[];for(let k=0;k<16;k++)for(let i=k;i<ink.length;i+=16){const off=ink[i],ix=off%W,iy=Math.floor(off/W);shuffled.push({off,ix,iy,edge:ix===0||iy===0||ix===w-1||iy===h-1});}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!td[y*w+x])reverse.push(y*W+x);
  const count=ink.length,allowed=Math.floor(count*(1-threshold)+1e-9);
  for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
   if((positions&4095)===0&&cancelled())throw appearanceError('Matching cancelled; no results saved','APPEARANCE_CANCELLED');if(++positions>maxPositions)throw appearanceError('Tolerance position budget exceeded');
   const n=integral[(y+h)*stride+x+w]-integral[y*stride+x+w]-integral[(y+h)*stride+x]+integral[y*stride+x];
   if(energyIntegral){const energy=energyIntegral[(y+h)*stride+x+w]-energyIntegral[y*stride+x+w]-energyIntegral[(y+h)*stride+x]+energyIntegral[y*stride+x];if(energy<energyTemplate*.8||energy>energyTemplate*1.25)continue;}else if(n<count*minInkRatio||n>count*maxInkRatio)continue;densityCandidates++;
   const base=y*W+x;let missing=0;for(const {off,ix,iy,edge} of shuffled){tick();const near=edge?(data[base+off]||ix>0&&data[base+off-1]||ix+1<w&&data[base+off+1]||iy>0&&data[base+off-W]||iy+1<h&&data[base+off+W]):dilated[base+off];if(!near&&++missing>allowed)break;}if(missing>allowed)continue;forwardPassed++;
   let extra=0,allowedExtra=Math.floor(n*(1-threshold)+1e-9);for(const off of reverse){tick();if(data[base+off]&&++extra>allowedExtra)break;}if(extra>allowedExtra)continue;
   let exact=0;for(const off of ink){tick();exact+=data[base+off];}
   candidates.push({left:x,top:y,width:w,height:h,anchorX:t.anchorX??w/2,anchorY:t.anchorY??h/2,rotation,score:Math.min((count-missing)/count,(n-extra)/n),iou:exact/(count+n-exact),inkRatio:n/count});
   if(candidates.length>25000)throw appearanceError('Tolerance ambiguity budget exceeded');
  }
 }
 candidates.sort((a,b)=>b.score-a.score||b.iou-a.iou||a.rotation-b.rotation||a.top-b.top||a.left-b.left);const hits=[];let proximityComparisons=0;
 for(const h of candidates)if(!hits.some(p=>{if((++proximityComparisons&4095)===0&&cancelled())throw appearanceError('Matching cancelled; no results saved','APPEARANCE_CANCELLED');if(proximityComparisons>1000000)throw appearanceError('Appearance proposal suppression budget exceeded');return Math.abs(h.left+h.anchorX-p.left-p.anchorX)<Math.min(h.width,p.width)*.6&&Math.abs(h.top+h.anchorY-p.top-p.anchorY)<Math.min(h.height,p.height)*.6;}))hits.push(h);
 Object.assign(stats,{positions,comparisons,densityCandidates,forwardPassed,acceptedCandidates:candidates.length,proximityComparisons,variants:variants.length,auxiliaryBytes:integral.byteLength+dilated.byteLength+(energyIntegral?.byteLength??0)});return hits;
}
const levels=[16,32,64,96,128,192];
function features(t,budget){const candidates=[];for(const threshold of levels){const all=components(t,threshold);for(const c of all){if(c.edge||c.area<1||c.area>t.width*t.height*.08)continue;if(!all.every(o=>o===c||c.pixels.every(a=>o.pixels.every(b=>(budget.feature(),Math.hypot(a%t.width-b%t.width,Math.floor(a/t.width)-Math.floor(b/t.width))>2.5)))))continue;const xs=c.pixels.map(i=>i%t.width),ys=c.pixels.map(i=>Math.floor(i/t.width));candidates.push({...c,threshold,bounds:[Math.max(0,Math.min(...xs)-2),Math.max(0,Math.min(...ys)-2),Math.min(t.width-1,Math.max(...xs)+2),Math.min(t.height-1,Math.max(...ys)+2)]});}}
 candidates.sort((a,b)=>b.area-a.area);const kept=[];for(const c of candidates){const [x0,y0,x1,y1]=c.bounds,edge=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(x===x0||x===x1||y===y0||y===y1){const p=(y*t.width+x)*4;edge.push(t.data[p]*.2126+t.data[p+1]*.7152+t.data[p+2]*.0722);}if(Math.max(...edge)-Math.min(...edge)>32)continue;if(!kept.some(p=>Math.hypot(c.x-p.x,c.y-p.y)<2))kept.push(c);}return kept;
}
const value=(i,x,y,c)=>{const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,W=i.width,H=i.height,p=(xx,yy)=>xx<0||yy<0||xx>=W||yy>=H?255:i.data[(yy*W+xx)*4+c];return p(x0,y0)*(1-fx)*(1-fy)+p(x0+1,y0)*fx*(1-fy)+p(x0,y0+1)*(1-fx)*fy+p(x0+1,y0+1)*fx*fy;};
const weighted=(img,[x0,y0,x1,y1])=>{const L=(x,y)=>{const p=(y*img.width+x)*4;return img.data[p]*.2126+img.data[p+1]*.7152+img.data[p+2]*.0722;},edge=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(x===x0||x===x1||y===y0||y===y1)edge.push(L(x,y));edge.sort((a,b)=>a-b);const bg=edge[Math.floor(edge.length/2)];let mass=0,mx=0,my=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const q=Math.max(0,bg-L(x,y));mass+=q;mx+=x*q;my+=y*q;}return {mass,x:mx/mass,y:my/mass};};
function detail(a,b,budget,prepared){const fs=prepared??features(a,budget);return fs.map(f=>{const aa=weighted(a,f.bounds),bb=weighted(b,f.bounds);return {distance:Math.hypot(aa.x-bb.x,aa.y-bb.y),massRatio:bb.mass/aa.mass,bounds:f.bounds};});}
function verify(image,template,left,top,budget,prepared){
 let best=null;
 for(let dy=-1;dy<=1;dy+=.25)for(let dx=-1;dx<=1;dx+=.25){budget.samples(template.width*template.height*3);let sq=0;for(let y=0;y<template.height;y++)for(let x=0;x<template.width;x++)for(let c=0;c<3;c++){const d=value(image,left+x+dx,top+y+dy,c)-template.data[(y*template.width+x)*4+c];sq+=d*d;}const rmse=Math.sqrt(sq/(template.width*template.height*3))/255;if(!best||rmse<best.rmse)best={dx,dy,rmse};}
 if(best.rmse>.12)return {...best,accepted:false,reason:'rgb'};
 const aligned={width:template.width,height:template.height,data:new Float64Array(template.data.length)};for(let y=0;y<aligned.height;y++)for(let x=0;x<aligned.width;x++){const p=(y*aligned.width+x)*4;for(let c=0;c<3;c++)aligned.data[p+c]=value(image,left+x+best.dx,top+y+best.dy,c);aligned.data[p+3]=255;}
 const forward=detail(template,aligned,budget,prepared),reverse=detail(aligned,template,budget),passed=forward.length>0&&reverse.length>0&&[...forward,...reverse].every(d=>Number.isFinite(d.distance)&&d.distance<=.5&&d.massRatio>=.75&&d.massRatio<=1.25);
 return {...best,accepted:passed,reason:passed?'accepted':'detail',forward,reverse};
}

/** Pure synchronous matcher. Call in a worker. Errors are atomic: no partial hits.
 * Input/template data is opaque RGBA, with an optional source crop anchor.
 * Unsupported source detail, edits, transparency and work limits require an
 * explicit caller fallback; this module never changes legacy policies.
 */
export function findAppearanceMatches(image,template,{rotations=true,cancelled=()=>false,maxComparisons=300000000,maxPositions=16000000,maxVerificationSamples=100000000,maxFeatureComparisons=10000000,maxCandidates=500,stats}={}){
 const budget=workBudget({cancelled,maxVerificationSamples,maxFeatureComparisons});budget.check();input(image);input(template,true);
 if(typeof rotations!=='boolean'||!Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>500||!Number.isSafeInteger(maxComparisons)||maxComparisons<1||maxComparisons>300000000||!Number.isSafeInteger(maxPositions)||maxPositions<1||maxPositions>16000000)throw appearanceError('Invalid appearance candidate budget','APPEARANCE_UNSUPPORTED');
 const variants=[];let current=template;for(let rotation=0;rotation<(rotations?360:90);rotation+=90){const detail=features(current,budget);if(!detail.length||detail.length>64)throw appearanceError('Appearance source needs bounded isolated contrast detail','APPEARANCE_UNSUPPORTED');variants.push({template:current,rotation,detail});current=rotateRGBA(current);}
 const energyImage=new Float32Array(image.width*image.height);for(let i=0;i<energyImage.length;i++){if((i&65535)===0)budget.check();const p=i*4;energyImage[i]=1-(image.data[p]*.2126+image.data[p+1]*.7152+image.data[p+2]*.0722)/255;}let energyTemplate=0;for(let p=0;p<template.data.length;p+=4)energyTemplate+=1-(template.data[p]*.2126+template.data[p+1]*.7152+template.data[p+2]*.0722)/255;
 const binary=inkImage(image.data,image.width,image.height),t={...inkImage(template.data,template.width,template.height),anchorX:template.anchorX??template.width/2,anchorY:template.anchorY??template.height/2};
 if(t.data.reduce((sum,v)=>sum+v,0)<8)throw appearanceError('Appearance source needs more visible detail','APPEARANCE_UNSUPPORTED');
 let baseline;try{baseline=findSymbolMatches(binary,t,{rotations,threshold:.95,maxComparisons,maxPositions});}catch(error){error.code??='APPEARANCE_BUDGET';throw error;}const proposalStats={};budget.check();
 const additional=appearanceProposals(binary,t,{rotations,threshold:.9,energyImage,energyTemplate,maxComparisons,maxPositions,cancelled,stats:proposalStats}),candidates=[...baseline.map(h=>({...h,baseline:true}))];
 if(candidates.length>maxCandidates)throw appearanceError('Appearance candidate budget exceeded');
 for(const h of additional){budget.check();if(!candidates.some(p=>Math.abs(h.left+h.anchorX-p.left-p.anchorX)<Math.min(h.width,p.width)*.6&&Math.abs(h.top+h.anchorY-p.top-p.anchorY)<Math.min(h.height,p.height)*.6)){candidates.push({...h,baseline:false});if(candidates.length>maxCandidates)throw appearanceError('Appearance candidate budget exceeded');}}
 if(candidates.length>maxCandidates)throw appearanceError('Appearance candidate budget exceeded');
 const accepted=[],rejected=[];for(const h of candidates){budget.check();const x=h.left+h.width/2,y=h.top+h.height/2,results=[];for(const v of variants){const left=x-v.template.width/2,top=y-v.template.height/2;results.push({...verify(image,v.template,left,top,budget,v.detail),rotation:v.rotation,left,top,width:v.template.width,height:v.template.height,anchorX:v.template.anchorX??v.template.width/2,anchorY:v.template.anchorY??v.template.height/2});}results.sort((a,b)=>a.rmse-b.rmse);const baselineResult=h.baseline?results.find(r=>r.rotation===h.rotation&&r.accepted):null,result=baselineResult??results.find(r=>r.accepted)??results[0];if(result.accepted)accepted.push({...h,...(baselineResult?{}:{left:result.left,top:result.top,width:result.width,height:result.height,anchorX:result.anchorX,anchorY:result.anchorY,rotation:result.rotation}),appearance:result});else rejected.push({candidate:h,appearance:result});}
 budget.check();if(stats)Object.assign(stats,proposalStats,budget.counts(),{proposalCount:candidates.length,strictProposalCount:baseline.length,accepted:accepted.length,rejected,additionalArrayBytes:energyImage.byteLength});return accepted;
}
