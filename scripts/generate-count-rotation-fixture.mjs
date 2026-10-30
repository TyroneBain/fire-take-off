import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
// Original asymmetric detector-like glyph. Placement labels precede rendering/matching.
export function rotationFixture({revision=false,large=false}={}){
 const symbols=[];
 for(let row=0;row<3;row++)for(let col=0;col<4;col++)symbols.push({id:`positive-${row}-${col}`,family:'flagged-symbol',x:(large?[70,744,995,1500][col]:70+col*100)+(row===1?.5:0),y:(large?[100,993,2000][row]:100+row*90)+(row===1?.5:0),angle:col*90});
 if(revision){symbols.splice(1,1);symbols.push({id:'added',family:'flagged-symbol',x:420,y:370,angle:270});}
 const negatives=[{x:70,y:400,kind:'filled'},{x:170,y:400,kind:'mirror'},{x:270,y:400,kind:'missing-detail'},{x:370,y:400,kind:'scaled'}];
 // Explicitly out-of-scope controls, not silently counted as successful positives.
 const challenges=[{x:70.25,y:490.25,angle:90,kind:'subpixel-phase'},{x:270,y:490,angle:45,kind:'oblique-angle'}];
 const core='-8 -10 16 3 re f -8 -10 3 20 re f -5 6 8 3 re f',detail='4 -2 3 3 re f';
 const matrix=angle=>({0:'1 0 0 1',90:'0 1 -1 0',180:'-1 0 0 -1',270:'0 -1 1 0',45:'.70710678 .70710678 -.70710678 .70710678'}[angle]);
 const draw=(x,y,angle=0,glyph=core+' '+detail,scale=1)=>`q ${matrix(angle)} ${x} ${y} cm ${scale} 0 0 ${scale} 0 0 cm ${glyph} Q`;
 const content=['0 g',...symbols.map(s=>draw(s.x,s.y,s.angle)),draw(70,400,0,'-8 -10 16 20 re f'),`q -1 0 0 1 170 400 cm ${core} ${detail} Q`,draw(270,400,0,core),draw(370,400,0,core+' '+detail,1.5),...challenges.map(s=>draw(s.x,s.y,s.angle))].join('\n')+'\n';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${large?'1684 2384':'500 560'}] ${large?'/Rotate 90 ':''}/Resources << >> /Contents 4 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,object]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return {bytes:Buffer.from(pdf),manifest:{provenance:'Original Fire Take Off asymmetric geometry; no Countfire or customer assets',sha256:createHash('sha256').update(pdf).digest('hex'),revision,...(large?{large:true}:{}),symbols,negatives,challenges,selection:[58,86,82,114],units:'native PDF points',limitations:['Synthetic only; no trade accuracy claim','No arbitrary scale/floating-reference matching']}};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){const dir=resolve(process.argv[2]||'.local/count-rotation-fixture');await mkdir(dir,{recursive:true});for(const revision of [false,true]){const {bytes,manifest}=rotationFixture({revision}),name=revision?'revision':'base';await writeFile(resolve(dir,name+'.pdf'),bytes);await writeFile(resolve(dir,name+'.json'),JSON.stringify(manifest,null,2)+'\n');}console.log('Owned count corpus written to '+dir);}
