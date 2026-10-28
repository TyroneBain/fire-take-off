import test from 'node:test';
import assert from 'node:assert/strict';
import {editedTemplate} from '../apps/local/web/pdf-elements.mjs';
import {findMatches,exampleImage} from '../apps/local/web/matcher.mjs';

// Original asymmetric pixel geometry, independently labelled by placement.
// These are algorithm controls, not construction symbols or a trade benchmark.
function corpus(){
 const width=220,height=130,original={width,height,data:new Uint8Array(width*height)};
 const core=[];for(let x=0;x<15;x++)core.push([x,0]);for(let y=0;y<18;y++)core.push([0,y]);for(let x=0;x<10;x++)core.push([x,17]);for(let y=8;y<18;y++)core.push([9,y]);
 const extra=Array.from({length:8},(_,i)=>[7,i+1]);
 const paint=(pixels,ox,oy,transform=([x,y])=>[x,y])=>{for(const p of pixels){const [x,y]=transform(p);original.data[(oy+y)*width+ox+x]=1;}};
 paint([...core,...extra],20,20);paint([...core,...extra],70,20);paint(core,120,20);
 // False family: filled block. Rotated/enlarged same family are unsupported scope.
 for(let y=0;y<20;y++)for(let x=0;x<17;x++)original.data[(75+y)*width+20+x]=1;
 paint([...core,...extra],75,75,([x,y])=>[17-y,x]);
 for(const [x,y]of [...core,...extra])for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)original.data[(75+2*y+dy)*width+130+2*x+dx]=1;
 const filtered={...original,data:original.data.slice()};for(const [x,y]of extra)filtered.data[(20+y)*width+20+x]=0;
 return {original,filtered,box:[17,17,38,41],expected:[[20,20],[70,20],[120,20]]};
}
test('cleaned template retains negative-space evidence and neutralises only erased ink',()=>{
 const {original,filtered,box,expected}=corpus(),template=editedTemplate(original,filtered,box);
 assert.equal(template.ignore.reduce((n,v)=>n+v,0),8);
 const legacy=findMatches(original,template,{allowExtraInk:true,threshold:.95});
 assert.ok(legacy.some(m=>m.top>60&&m.left<50),'positive-only scoring falsely admits dense block');
 const matches=findMatches(original,template,{threshold:.95});
 assert.deepEqual(matches.map(m=>[m.left+2,m.top+2]),expected);
 assert.deepEqual(matches.map(m=>m.score),[1,1,1]);
 // All-erased and mismatched render inputs cannot become valid templates.
 assert.throws(()=>editedTemplate(original,{...filtered,width:1},box),/dimensions/);
 assert.throws(()=>editedTemplate(original,{...original,data:new Uint8Array(original.data.length)},box),/detail/);
 assert.throws(()=>findMatches(original,{...template,ignore:new Uint8Array(1)}),/ignored/);
 const conflicting=template.ignore.slice();conflicting[template.data.findIndex(Boolean)]=1;
 assert.throws(()=>findMatches(original,{...template,ignore:conflicting}),/ignored/);
 assert.throws(()=>findMatches(original,template,{maxComparisons:1}),/budget/);
});
test('unedited matching keeps exact-definition semantics; original anchor survives asymmetric erasure',()=>{
 const {original,filtered,box}=corpus(),base=exampleImage(original,box),edited=editedTemplate(original,filtered,box);
 assert.deepEqual(findMatches(original,base,{threshold:.95}).map(m=>[m.left+2,m.top+2]),[[20,20],[70,20]]);
 assert.equal(edited.width,base.width);assert.equal(edited.height,base.height);
 assert.equal(edited.anchorX,base.width/2);assert.equal(edited.anchorY,base.height/2);
 const more={...filtered,data:filtered.data.slice()};for(let x=1;x<15;x++)more.data[20*more.width+20+x]=0;
 const narrower=editedTemplate(original,more,box);assert.equal(narrower.anchorX,edited.anchorX);assert.equal(narrower.anchorY,edited.anchorY);
});
