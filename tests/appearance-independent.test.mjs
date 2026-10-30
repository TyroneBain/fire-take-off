import test from 'node:test';
import {createCanvas} from '@napi-rs/canvas';
import {findAppearanceMatches} from '../apps/local/web/appearance-match.mjs';
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

const rgbControls=[
{id:'source',x:32,y:32,positive:true},
{id:'global-quarter-half',x:96.25,y:32.5,positive:true},
{id:'global-half-quarter',x:160.5,y:32.25,positive:true},
{id:'global-three-quarters',x:224.75,y:32.75,positive:true},
{id:'global-minus-quarter',x:287.75,y:31.75,positive:true},
{id:'crossing-red-horizontal',x:352.25,y:32.5,positive:true,pipe:'horizontal'},
{id:'crossing-red-vertical',x:416.5,y:32.25,positive:true,pipe:'vertical'},
{id:'crossing-black-diagonal',x:480.75,y:32.75,positive:true,pipe:'diagonal'},
{id:'internal-dot-shift-one-pixel',x:32,y:96,positive:false,dotX:1},
{id:'missing-dot',x:96,y:96,positive:false,missing:true},
{id:'quartered-red-circle',x:160,y:96,positive:false,quartered:true},
{id:'thin-ring-without-dot',x:224,y:96,positive:false,missing:true,width:.3},
{id:'extra-internal-dot',x:288,y:96,positive:false,extra:true},
{id:'wrong-fill-colour',x:352,y:96,positive:false,fill:'#5555ff'},
{id:'stroke-half',x:416,y:96,positive:null,width:.5,probe:'same geometric family stroke variation; no binary semantic verdict'},
{id:'stroke-double',x:480,y:96,positive:null,width:2,probe:'same geometric family stroke variation; no binary semantic verdict'},
{id:'uniform-scale-1.13',x:32,y:160,positive:null,scale:1.13,probe:'future scale target; current proposed contract is translation only'},
{id:'uniform-scale-.8',x:96,y:160,positive:null,scale:.8,probe:'future scale target; current proposed contract is translation only'},
{id:'nonuniform-scale',x:160,y:160,positive:false,scaleX:1.2},
{id:'internal-dot-shift-one-pixel-global-half',x:224.5,y:160.5,positive:false,dotX:1},
];
function rgbControlImage(){const c=createCanvas(512,192),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);for(const s of rgbControls){g.save();g.translate(s.x,s.y);g.scale((s.scale??1)*(s.scaleX??1),s.scale??1);g.fillStyle=s.fill??'#ff5353';g.strokeStyle='#000';g.lineWidth=s.width??1;g.beginPath();g.arc(0,0,9,0,Math.PI*2);g.fill();if(!s.quartered)g.stroke();if(s.quartered){g.lineWidth=.8;g.beginPath();g.moveTo(-9,0);g.lineTo(9,0);g.moveTo(0,-9);g.lineTo(0,9);g.stroke();}else if(!s.missing){g.lineWidth=.8;g.beginPath();g.moveTo((s.dotX??0)-1.25,0);g.lineTo(s.dotX??0,1.25);g.lineTo((s.dotX??0)+1.25,0);g.lineTo(s.dotX??0,-1.25);g.closePath();g.stroke();}if(s.extra){g.fillStyle='#000';g.fillRect(4,2,1,1);}g.restore();if(s.pipe){g.save();g.translate(s.x,s.y);g.strokeStyle=s.pipe==='diagonal'?'#000':'#ff2200';g.lineWidth=.8;g.beginPath();if(s.pipe==='horizontal'){g.moveTo(-16,0);g.lineTo(16,0);}if(s.pipe==='vertical'){g.moveTo(0,-16);g.lineTo(0,16);}if(s.pipe==='diagonal'){g.moveTo(-16,-16);g.lineTo(16,16);}g.stroke();g.restore();}}return{canvas:c,data:g.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height};}

const grayControls=[{id:'source',x:32,y:32,positive:true},{id:'global-quarter-half',x:96.25,y:32.5,positive:true},{id:'global-half-quarter',x:160.5,y:32.25,positive:true},{id:'global-three-quarter',x:224.75,y:32.75,positive:true},{id:'global-quarterturn',x:288.25,y:32.5,positive:true,angle:90},{id:'dot-shift1',x:32,y:96,positive:false,dotShift:1},{id:'missing-dot',x:96,y:96,positive:false,missing:true},{id:'dot-shift1-globalhalf',x:160.5,y:96.5,positive:false,dotShift:1},{id:'extra-dot',x:224,y:96,positive:false,extra:true},{id:'internal-reflection',x:288,y:96,positive:false,reflect:true}];
function grayControlImage(){const c=createCanvas(320,128),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);for(const s of grayControls){g.save();g.translate(s.x,s.y);g.rotate((s.angle??0)*Math.PI/180);g.strokeStyle='#000';g.fillStyle='#000';g.lineWidth=1;g.strokeRect(-9,-7,18,14);if(!s.missing)g.fillRect((s.reflect?3:-5)+(s.dotShift??0),-2,2,2);g.beginPath();g.moveTo(3,3);g.lineTo(6,3);g.lineTo(6,5);g.closePath();g.fill();if(s.extra)g.fillRect(-2,3,1,1);g.restore();}return{canvas:c,data:g.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height};}

function rgbaTemplate(f,bounds){const [left,top,right,bottom]=bounds,width=right-left,height=bottom-top;return{data:f.canvas.getContext('2d').getImageData(left,top,width,height).data,width,height,anchorX:width/2,anchorY:height/2};}
const nativeHit=h=>({x:h.left+h.anchorX,y:h.top+h.anchorY});
function nearAny(hits,p){return hits.some(h=>Math.hypot(nativeHit(h).x-p.x,nativeHit(h).y-p.y)<=1.5);}
test('independent RGB controls retain global phase and red-pipe targets while rejecting eight semantic lookalikes',()=>{
 const f=rgbControlImage(),hits=findAppearanceMatches(f,rgbaTemplate(f,[20,20,44,44]));
 for(const p of rgbControls.filter(p=>p.positive===true&&p.id!=='crossing-black-diagonal'))assert.ok(nearAny(hits,p),p.id);
 for(const p of rgbControls.filter(p=>p.positive===false))assert.ok(!nearAny(hits,p),p.id);
 // The black diagonal occludes detail and remains in reported QA recall;
 // this regression gate neither asserts a miss nor pretends it was detected.
 assert.equal(hits.filter(h=>rgbControls.some(p=>p.positive===false&&nearAny([h],p))).length,0);
});
test('independent grayscale controls accept all actual whole-glyph phases and reject internal changes',()=>{
 const f=grayControlImage(),hits=findAppearanceMatches(f,rgbaTemplate(f,[18,20,46,44]));
 for(const p of grayControls)assert.equal(nearAny(hits,p),p.positive,p.id);
 assert.equal(hits.length,5);
});
test('appearance verifier preserves the baseline zero-FP hard-detail guard and off-centre anchors',()=>{
 const f=hardDetailControls(),hits=findAppearanceMatches(f.image,f.template),scored=classify(hits,f.labels);
 assert.deepEqual(scored.filter(p=>p.hits.length).map(p=>p.id),['source','global-integer']);assert.equal(hits.length,2);
 const offset=findAppearanceMatches(f.image,{...f.template,anchorX:11,anchorY:10});assert.deepEqual(offset.map(nativeHit),[{x:15,y:14},{x:48,y:15}]);
});
