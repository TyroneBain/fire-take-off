import test from 'node:test';
import assert from 'node:assert/strict';
import {inkImage,findSymbolMatches} from '../apps/local/web/matcher.mjs';

// Original QA oracle: a literal one-pixel outline and a two-by-two internal dot.
// All target labels and pixel commands precede candidate execution. Moving only
// the dot is not a global transform, including under any quarter-turn.
export function hardDetailControls(){
 const width=160,height=32,data=new Uint8ClampedArray(width*height*4).fill(255);
 const labels=[{id:'source',x:16,y:16,positive:true},{id:'global-integer',x:49,y:17,positive:true},{id:'internal-dot-shift-one',x:80,y:16,positive:false,shift:1},{id:'missing-dot',x:112,y:16,positive:false,missing:true},{id:'internal-dot-shift-two',x:144,y:16,positive:false,shift:2}];
 const pixel=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;};
 for(const s of labels){const ox=s.x-12,oy=s.y-12;for(let n=5;n<=18;n++){pixel(ox+n,oy+5);pixel(ox+n,oy+18);pixel(ox+5,oy+n);pixel(ox+18,oy+n);}if(!s.missing)for(let y=10;y<12;y++)for(let x=9;x<11;x++)pixel(ox+x+(s.shift||0),oy+y);}
 const templateData=new Uint8ClampedArray(24*24*4);for(let y=0;y<24;y++)for(let x=0;x<24;x++)templateData.set(data.subarray(((y+4)*width+x+4)*4,((y+4)*width+x+4)*4+4),(y*24+x)*4);
 return{image:{data,width,height},template:{data:templateData,width:24,height:24,anchorX:12,anchorY:12},labels};
}
function classify(hits,labels){return labels.map(label=>({...label,hits:hits.filter(h=>Math.hypot(h.left+(h.anchorX??h.width/2)-label.x,h.top+(h.anchorY??h.height/2)-label.y)<1)}));}

test('independent hard-pixel semantic-detail oracle: baseline accepts global movement and rejects internal dot movement',()=>{
 const f=hardDetailControls(),template={...inkImage(f.template.data,24,24),anchorX:12,anchorY:12},hits=findSymbolMatches(inkImage(f.image.data,f.image.width,f.image.height),template,{threshold:.95,rotations:true}),scored=classify(hits,f.labels);
 assert.deepEqual(scored.filter(x=>x.hits.length).map(x=>x.id),['source','global-integer']);
 assert.equal(hits.length,2);
});
