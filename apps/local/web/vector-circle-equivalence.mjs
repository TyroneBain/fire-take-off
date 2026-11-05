// Original, bounded parametric recognition for ONE unfilled circular stroke.
// This is an approximation policy, not .05pt boundary equality: slightly
// elliptical polygons inside the stated residual band can be indistinguishable.
// No geometry is replaced; original operation IDs/paths still need paint proof.
export const CIRCLE_APPROXIMATION_POLICY=Object.freeze({minVertices:24,maxVertices:256,maxAngleGap:Math.PI/12,maxRadialResidual:.10,maxRmsResidual:.05,maxChordSagitta:.05});
const K=4*(Math.sqrt(2)-1)/3,TAU=2*Math.PI;
const near=(a,b,e)=>Math.abs(a-b)<=e;
export function classifyCircleElement(element,{tolerance=.05,consume=()=>{}}={}){
 consume();
 if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>.25||!element?.style?.stroke||element.style.fill||element.orderedCompound)return null;
 const segments=element.segments,commands=element.pathCommands;
 if(!Array.isArray(segments)||!Array.isArray(commands)||segments.length>256||commands.length>2050||segments.length<4)return null;
 const cubic=segments.length===4&&segments.every(s=>s[0]===2),polygon=segments.length>=24&&segments.every(s=>s[0]===1);
 if(!cubic&&!polygon)return null;
 // Grammar is checked independently of transformed coordinates. The caller's
 // transformed segments are authoritative for placement; raw command coords
 // are deliberately not read because the matcher retains original commands.
 let moves=0,draws=0,closed=false;
 for(let i=0;i<commands.length;){consume();const op=commands[i++],n=op===0||op===1?2:op===2?6:op===4?0:-1;
  if(n<0||i+n>commands.length||closed||op===0&&moves++!==0||op!==0&&moves!==1)return null;
  if(op===4){closed=true;if(i!==commands.length)return null;}else if(op!==0){if(op!==(cubic?2:1))return null;draws++;}
  for(let j=0;j<n;j++)if(!Number.isFinite(commands[i+j]))return null;i+=n;
 }
 if(moves!==1||draws+(polygon&&(closed||element.paintClosesPath)&&draws===segments.length-1?1:0)!==segments.length)return null;
 for(let i=0;i<segments.length;i++){consume();const s=segments[i],previous=segments[(i+segments.length-1)%segments.length];
  if(s.length!==(cubic?9:5)||s.some(v=>!Number.isFinite(v)||Math.abs(v)>1e7)||!near(s[1],previous.at(-2),1e-8)||!near(s[2],previous.at(-1),1e-8))return null;
 }
 if(cubic){
  const centre=[0,0];for(const s of segments){centre[0]+=s[1]/4;centre[1]+=s[2]/4;}
  const radius=segments.reduce((sum,s)=>sum+Math.hypot(s[1]-centre[0],s[2]-centre[1])/4,0),epsilon=Math.min(.001,tolerance);
  if(!(radius>epsilon)||radius*.0003>Math.min(.05,tolerance))return null;
  let winding=0;
  for(const s of segments){consume();const a=[s[1]-centre[0],s[2]-centre[1]],b=[s[7]-centre[0],s[8]-centre[1]],sign=Math.sign(a[0]*b[1]-a[1]*b[0]);
   if(!sign||winding&&winding!==sign||!near(Math.hypot(...a),radius,epsilon)||!near(Math.hypot(...b),radius,epsilon))return null;winding=sign;
   if(!near(b[0],-sign*a[1],epsilon)||!near(b[1],sign*a[0],epsilon)||!near(s[3],s[1]-sign*K*a[1],epsilon)||!near(s[4],s[2]+sign*K*a[0],epsilon)||!near(s[5],s[7]+sign*K*b[1],epsilon)||!near(s[6],s[8]-sign*K*b[0],epsilon))return null;
  }
  return {kind:'cubic',centre,radius,closure:closed||element.paintClosesPath?'closed':'returned'};
 }
 // Centred algebraic least squares avoids subtracting squared page coordinates.
 const points=segments.map(s=>[s[1],s[2]]),n=points.length,mean=[0,0];for(const p of points){mean[0]+=p[0]/n;mean[1]+=p[1]/n;}
 let xx=0,xy=0,yy=0,xz=0,yz=0;
 for(const p of points){consume();const x=p[0]-mean[0],y=p[1]-mean[1],z=x*x+y*y;xx+=x*x;xy+=x*y;yy+=y*y;xz+=x*z;yz+=y*z;}
 const determinant=xx*yy-xy*xy;if(!Number.isFinite(determinant)||determinant<=1e-12)return null;
 const centre=[mean[0]+(xz*yy-yz*xy)/(2*determinant),mean[1]+(yz*xx-xz*xy)/(2*determinant)],radii=points.map(p=>Math.hypot(p[0]-centre[0],p[1]-centre[1])),radius=radii.reduce((s,r)=>s+r/n,0);
 if(!Number.isFinite(radius)||radius<=Math.min(.05,tolerance))return null;
 let maxRadialResidual=0,squareResidual=0,maxAngleGap=0,winding=0,angleSum=0;
 for(let i=0;i<n;i++){consume();const p=points[i],q=points[(i+1)%n],a=[p[0]-centre[0],p[1]-centre[1]],b=[q[0]-centre[0],q[1]-centre[1]],angle=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]),sign=Math.sign(angle);
  if(!sign||Math.abs(angle)<1e-8||Math.abs(angle)>Math.PI/12+1e-10||winding&&sign!==winding||Math.hypot(p[0]-q[0],p[1]-q[1])<1e-8)return null;
  winding=sign;angleSum+=angle;maxAngleGap=Math.max(maxAngleGap,Math.abs(angle));const residual=Math.abs(radii[i]-radius);maxRadialResidual=Math.max(maxRadialResidual,residual);squareResidual+=residual*residual;
 }
 const rmsRadialResidual=Math.sqrt(squareResidual/n),chordSagitta=radius*(1-Math.cos(maxAngleGap/2));
 if(Math.abs(Math.abs(angleSum)-TAU)>1e-7||maxRadialResidual>Math.min(.10,2*tolerance)||rmsRadialResidual>Math.min(.05,tolerance)||chordSagitta>Math.min(.05,tolerance))return null;
 return {kind:'polygon',centre,radius,closure:closed||element.paintClosesPath?'closed':'returned',maxRadialResidual,rmsRadialResidual,maxAngleGap,chordSagitta};
}
