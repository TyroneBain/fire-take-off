import {createHash} from 'node:crypto';

// Ground truth is declared before renderer/matcher use. This original QA glyph
// is deliberately asymmetric under reflection as well as quarter-turn rotation.
export const SCALE_QA_LABELS=Object.freeze([1,.8,1.2,1.13].flatMap((scale,row)=>[0,90,180,270].map((angle,col)=>({id:`s${scale}-r${angle}`,page:1,x:80+col*140,y:80+row*100,scale,angle,crossing:col===0?'horizontal':col===2?'diagonal':null}))));
export const SCALE_QA_NEGATIVES=Object.freeze([
 {id:'missing-dot',page:1,x:80,y:480,scale:1.2,angle:90,kind:'missing-dot'},
 {id:'shifted-dot',page:1,x:220,y:480,scale:1.13,angle:270,kind:'shifted-dot'},
 {id:'wrong-stroke-width',page:1,x:360,y:480,scale:1.2,angle:180,kind:'wrong-stroke-width'},
 {id:'nonuniform-baked',page:1,x:500,y:480,scale:1,angle:0,kind:'nonuniform-baked'},
 {id:'mirrored-chiral',page:1,x:80,y:580,scale:1,angle:0,kind:'mirror'},
 {id:'extra-detail',page:1,x:220,y:580,scale:.8,angle:90,kind:'extra-detail'},
]);
const n=v=>Math.abs(v)<1e-9?'0':String(+v.toFixed(8));
const matrix=(angle,scale=1)=>{const r=angle*Math.PI/180,c=Math.cos(r)*scale,s=Math.sin(r)*scale;return [c,s,-s,c].map(n).join(' ');};
function glyph(kind){
 const sx=kind==='nonuniform-baked'?1.2:kind==='mirror'?-1:1,pt=(x,y)=>`${n(sx*x)} ${n(y)}`,shift=kind==='shifted-dot'?.8:0;
 const outer=`${pt(-9,-7)} m ${pt(9,-7)} l ${pt(9,7)} l ${pt(-9,7)} l h S`;
 const elbow=`${pt(-5,-3)} m ${pt(5,-3)} l ${pt(5,4)} l S`;
 const p=(x,y)=>pt(x+shift,y);
 const dot=`${p(-2,2)} m ${p(-2,2.552285)} ${p(-2.447715,3)} ${p(-3,3)} c ${p(-3.552285,3)} ${p(-4,2.552285)} ${p(-4,2)} c ${p(-4,1.447715)} ${p(-3.552285,1)} ${p(-3,1)} c ${p(-2.447715,1)} ${p(-2,1.447715)} ${p(-2,2)} c f`;
 const triangle=`${pt(3,3)} m ${pt(5,3)} l ${pt(4,5)} l h f`;
 return `0 G 0 g ${kind==='wrong-stroke-width'?.7:1} w ${outer} ${elbow} ${kind==='missing-dot'?'':dot} ${triangle} ${kind==='extra-detail'?'-1 -1 1 1 re f':''}`;
}
const draw=s=>`q ${matrix(s.angle,s.scale)} ${s.x} ${s.y} cm ${glyph(s.kind)} Q`;
const pipe=s=>s.crossing?`q 0 G .7 w ${s.x-35} ${s.y+(s.crossing==='diagonal'?-35:0)} m ${s.x+35} ${s.y+(s.crossing==='diagonal'?35:0)} l S Q`:'';
function buildPdf(contents){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];for(const [i,content]of contents.entries()){objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 650] /Resources << >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);}let out='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out);}

export function vectorScaleQaFixture({extraScales=[]}={}){
 const labels=[...SCALE_QA_LABELS.map(s=>({...s})),...extraScales.map((scale,i)=>({id:`boundary-${scale}`,page:1,x:360+i*90,y:580,scale,angle:0}))];
 const content=[...labels.map(s=>draw(s)+'\n'+pipe(s)),...SCALE_QA_NEGATIVES.map(draw)].join('\n');
 const unsupported=`q 1.2 0 0 1 100 100 cm ${glyph()} Q`;
 const bytes=buildPdf([content,unsupported]);
 return {bytes,manifest:{id:'qa-vector-scales-v1',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'Original independently labelled QA PDF geometry, 2026-10-30; no customer or competitor assets',labels,negatives:structuredClone(SCALE_QA_NEGATIVES),selection:[67,69,93,91],seed:[80,80],unsupportedPages:[{page:2,reason:'Nonuniform affine stroke transform; must remain explicit raster fallback'}],oracle:'Exact commanded anchors; physical mirror is distinct by rectangle aspect ratio and asymmetric internal parts. Per-instance matching, tolerance 0.01 PDF point. Scale labels are product targets, not claims that arbitrary scales are supported.',limitations:['Synthetic only','No human estimator accuracy or Countfire comparison','Actual nonuniform transforms separately test unsupported extraction; baked anisotropic shape is a negative']}};
}
