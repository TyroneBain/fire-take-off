import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {findAppearanceMatches} from '../apps/local/web/appearance-match.mjs';

// Original pixel fixture. Labelled placements precede matcher execution.
function fixture(){
 const w=24,h=20,template={width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255),anchorX:10,anchorY:9};
 const black=(d,i)=>{d[i]=d[i+1]=d[i+2]=0;};
 for(let y=4;y<=15;y++)for(let x=4;x<=19;x++)if(y===4||y===15||x===4||x===19)black(template.data,(y*w+x)*4);
 for(let y=8;y<=9;y++)for(let x=8;x<=9;x++)black(template.data,(y*w+x)*4);
 const image={width:150,height:90,data:new Uint8ClampedArray(150*90*4).fill(255)};
 const stamp=(left,top,{shift=0,missing=false,extra=false,rotation=false}={})=>{
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(template.data[(y*w+x)*4]===0){const dot=x>=8&&x<=9&&y>=8&&y<=9;if(dot&&missing)continue;const xx=x+(dot?shift:0),rx=rotation?h-1-y:xx,ry=rotation?xx:y;black(image.data,((top+ry)*image.width+left+rx)*4);}
  if(extra)black(image.data,((top+11)*image.width+left+14)*4);
 };
 stamp(10,10);stamp(45,10);stamp(80,10,{shift:1});stamp(115,10,{missing:true});stamp(10,45,{extra:true});stamp(50,45,{rotation:true});
 return {image,template};
}
const anchors=hits=>hits.map(h=>[h.left+h.anchorX,h.top+h.anchorY]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);

test('appearance keeps whole-symbol movement and quarter-turn anchors while rejecting moved, missing and one-pixel extra details',()=>{
 const {image,template}=fixture(),before=structuredClone(template),stats={};
 const hits=findAppearanceMatches(image,template,{stats});
 assert.deepEqual(anchors(hits),[[20,19],[55,19],[61,55]]);
 assert.deepEqual(template,before);
 assert.equal(stats.accepted,3);
 assert.ok(stats.rejected.length>=2);
 assert.ok(stats.verificationSamples>0);
});

test('fixed orientation and explicit off-centre anchors remain distinct from visual crop centre',()=>{
 const {image,template}=fixture();
 assert.deepEqual(anchors(findAppearanceMatches(image,template,{rotations:false})),[[20,19],[55,19]]);
});

test('appearance work limits and cancellation fail atomically',()=>{
 const {image,template}=fixture();
 assert.throws(()=>findAppearanceMatches(image,template,{cancelled:()=>true}),e=>e.code==='APPEARANCE_CANCELLED');
 for(const options of [{maxVerificationSamples:1},{maxFeatureComparisons:1},{maxCandidates:1},{maxPositions:1}])assert.throws(()=>findAppearanceMatches(image,template,options),/budget exceeded/);
 let polls=0;assert.throws(()=>findAppearanceMatches(image,template,{cancelled:()=>++polls>2}),e=>e.code==='APPEARANCE_CANCELLED');
});

test('appearance rejects unsupported data and cleaned selections explicitly',()=>{
 const {image,template}=fixture();
 assert.throws(()=>findAppearanceMatches(image,{...template,ignore:new Uint8Array(template.width*template.height)}),e=>e.code==='APPEARANCE_UNSUPPORTED');
 const transparent=structuredClone(template);transparent.data[3]=0;
 assert.throws(()=>findAppearanceMatches(image,transparent),e=>e.code==='APPEARANCE_UNSUPPORTED');
 for(const bad of [{...template,anchorX:Infinity},{...template,anchorY:-1},{...template,data:[]},{...template,width:500}])assert.throws(()=>findAppearanceMatches(image,bad),e=>e.code==='APPEARANCE_UNSUPPORTED');
 const blank={width:24,height:24,data:new Uint8ClampedArray(24*24*4).fill(255)};
 assert.throws(()=>findAppearanceMatches(image,blank),e=>e.code==='APPEARANCE_UNSUPPORTED');
});


test('global registration selects a feasible orientation rather than rejecting after the lowest RGB residual fails detail',()=>{
 // Original geometry, independently specified whole-glyph phases. At this
 // fixed crop, the lowest-RGB orientation loses a contrast island after
 // resampling; another quarter-turn satisfies both RGB and detail gates.
 const draw=(x,y)=>{
  const canvas=createCanvas(24,24),ctx=canvas.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,24,24);
  ctx.strokeStyle='#e84a4a';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x,y+12);ctx.stroke();
  ctx.fillStyle='#ed7777';ctx.strokeStyle='black';ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(x-1.25,y);ctx.lineTo(x,y+1.25);ctx.lineTo(x+1.25,y);ctx.lineTo(x,y-1.25);ctx.closePath();ctx.stroke();
  return {width:24,height:24,data:ctx.getImageData(0,0,24,24).data};
 };
 const source=draw(12.25,12.75),target=draw(12.75,12.5),hits=findAppearanceMatches(target,source);
 assert.equal(hits.length,1);
 assert.deepEqual(anchors(hits),[[12,12]]);
 assert.equal(hits[0].appearance.accepted,true);
 assert.ok(hits[0].appearance.forward.every(d=>d.distance<=.5));
 assert.ok(hits[0].appearance.reverse.every(d=>d.distance<=.5));
});
