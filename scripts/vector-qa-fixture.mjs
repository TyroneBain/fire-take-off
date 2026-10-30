import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';

// Independently authored QA oracle. Labels are declared before PDF construction,
// without importing or observing either recognition implementation.
export const QA_LABELS = Object.freeze([
 {id:'seed-crossing',page:1,x:50,y:50,angle:0,pipe:'horizontal'},
 {id:'translated-clean',page:1,x:150,y:50,angle:0},
 {id:'quarter-turn-crossing',page:1,x:250,y:50,angle:90,pipe:'vertical'},
 {id:'half-turn',page:1,x:350,y:50,angle:180},
 {id:'three-quarter-turn',page:1,x:50,y:150,angle:270},
 {id:'fractional-crossing',page:1,x:150.25,y:150.25,angle:0,pipe:'diagonal'},
 {id:'fractional-rotated',page:1,x:250.125,y:150.375,angle:90},
 {id:'two-pipe-crossing',page:1,x:350,y:150,angle:270,pipe:'both'},
 {id:'scaled-positive',page:1,x:50,y:250,angle:0,scale:1.2,challenge:'scale'},
 {id:'oblique-positive',page:1,x:150,y:250,angle:45,challenge:'arbitrary rotation'},
 {id:'nested-form',page:2,x:50,y:50,angle:0,challenge:'nested Form XObject'},
 {id:'nested-form-quarter-turn',page:2,x:150,y:50,angle:90,challenge:'nested Form XObject'},
 {id:'clipped-visible',page:3,x:50,y:50,angle:0,challenge:'explicit clipping'},
 {id:'raster-only',page:4,x:50,y:50,angle:0,challenge:'image-only page'},
]);
export const QA_NEGATIVES = Object.freeze([
 {id:'missing-dot',page:1,x:250,y:250,kind:'missing-dot'},
 {id:'mirrored',page:1,x:350,y:250,kind:'mirrored'},
 {id:'shifted-detail',page:1,x:50,y:350,kind:'shifted-detail'},
 {id:'wrong-stroke-width',page:1,x:150,y:350,kind:'wrong-stroke-width'},
]);

const outline='-8 -8 16 16 re S';
const detail='-4 -4 m 4 -4 l 4 4 l S';
const dot='-2 3 m -2 3.552285 -2.447715 4 -3 4 c -3.552285 4 -4 3.552285 -4 3 c -4 2.447715 -3.552285 2 -3 2 c -2.447715 2 -2 2.447715 -2 3 c f';
const glyph=`1 w 0 G 0 g ${outline} ${detail} ${dot}`;
function matrix(angle,scale=1){const r=angle*Math.PI/180,c=Math.cos(r)*scale,s=Math.sin(r)*scale;return [c,s,-s,c].map(v=>Math.abs(v)<1e-9?0:+v.toFixed(8)).join(' ');}
function draw(s,body=glyph){return `q ${matrix(s.angle||0,s.scale||1)} ${s.x} ${s.y} cm ${body} Q`;}
function pipes(s){const p=s.pipe;if(!p)return '';const parts=[];if(p==='horizontal'||p==='both')parts.push('-25 0 m 25 0 l S');if(p==='vertical'||p==='both')parts.push('0 -25 m 0 25 l S');if(p==='diagonal')parts.push('-25 -25 m 25 25 l S');return `q 1 0 0 1 ${s.x} ${s.y} cm .7 w 0 G ${parts.join(' ')} Q`;}
function stream(data,extras=''){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);return Buffer.concat([Buffer.from(`<< /Length ${bytes.length} ${extras} >>\nstream\n`),bytes,Buffer.from('\nendstream')]);}
function pdf(objects){const chunks=[Buffer.from('%PDF-1.4\n')],offsets=[0];let length=chunks[0].length;objects.forEach((object,i)=>{offsets.push(length);const b=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),Buffer.isBuffer(object)?object:Buffer.from(object),Buffer.from('\nendobj\n')]);chunks.push(b);length+=b.length;});chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));return Buffer.concat(chunks);}

export async function vectorQaFixture(){
 const main=QA_LABELS.filter(s=>s.page===1).map(s=>draw(s)+'\n'+pipes(s));
 for(const n of QA_NEGATIVES){let body=glyph;if(n.kind==='missing-dot')body=`1 w 0 G ${outline} ${detail}`;if(n.kind==='mirrored')body=`-1 0 0 1 0 0 cm ${glyph}`;if(n.kind==='shifted-detail')body=`1 w 0 G 0 g ${outline} ${detail} q 1 0 0 1 2 0 cm ${dot} Q`;if(n.kind==='wrong-stroke-width')body=glyph.replace('1 w','2 w');main.push(draw(n,body));}
 const {createCanvas}=await import('@napi-rs/canvas'),c=createCanvas(400,400),ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,400,400);ctx.translate(50,350);ctx.scale(1,-1);ctx.strokeStyle='black';ctx.fillStyle='black';ctx.lineWidth=1;ctx.strokeRect(-8,-8,16,16);ctx.beginPath();ctx.moveTo(-4,-4);ctx.lineTo(4,-4);ctx.lineTo(4,4);ctx.stroke();ctx.beginPath();ctx.arc(-3,3,1,0,Math.PI*2);ctx.fill();const rgba=ctx.getImageData(0,0,400,400).data,rgb=Buffer.alloc(400*400*3);for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i];rgb[j++]=rgba[i+1];rgb[j++]=rgba[i+2];}
 const page=(contents,resources='')=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << ${resources} >> /Contents ${contents} 0 R >>`;
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R 9 0 R] /Count 4 >>',
  page(4),stream(main.join('\n')),
  page(6,'/XObject << /Outer 12 0 R >>'),stream('q 1 0 0 1 50 50 cm /Outer Do Q q 0 1 -1 0 150 50 cm /Outer Do Q'),
  page(8),stream(`q 30 30 40 40 re W n ${draw(QA_LABELS.find(s=>s.page===3))} Q`),
  page(10,'/XObject << /Image 13 0 R >>'),stream('q 400 0 0 400 0 0 cm /Image Do Q'),
  stream(glyph,'/Type /XObject /Subtype /Form /BBox [-12 -12 12 12] /Resources << >>'),
  stream('/Inner Do','/Type /XObject /Subtype /Form /BBox [-14 -14 14 14] /Resources << /XObject << /Inner 11 0 R >> >>'),
  stream(deflateSync(rgb),'/Type /XObject /Subtype /Image /Width 400 /Height 400 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode'),
 ];
 const bytes=pdf(objects);return {bytes,manifest:{id:'qa-vector-elements-v1',provenance:'Original independent QA-authored geometry and hand-labelled placement commands, 2026-10-30; no customer or competitor material',sha256:createHash('sha256').update(bytes).digest('hex'),selection:[38,38,62,62],labels:structuredClone(QA_LABELS),negatives:structuredClone(QA_NEGATIVES),oracle:'Exact commanded symbol origins in native PDF points; nearest unused positive within 1 PDF point. Missing/extra-detail, mirror and stroke-width variants are negatives; scaled/oblique/nested/clipped/raster instances remain positive challenges.',limitations:['Synthetic only; no real-drawing accuracy or competitor comparison','No human correction-time study','Nested/clipped/raster pages must report fallback rather than silently losing results']}};
}
