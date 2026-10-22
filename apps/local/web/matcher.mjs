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
  return {data:result,width:w,height:h,count};
}
export function findMatches(image,template,{threshold=.85,maxComparisons=60000000}={}) {
  const {data,width,height}=image,{width:w,height:h,data:t}=template;
  if(width*height>4000000||w<1||h<1||w>256||h>256||w*h!==t.length||data.length!==width*height||threshold<.5||threshold>1)throw new Error('Invalid matcher input');
  const count=t.reduce((sum,v)=>sum+v,0);if(count<8)throw new Error('Example has insufficient detail');
  const stride=width+1,integral=new Uint32Array((width+1)*(height+1));
  for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){row+=data[y*width+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
  const candidates=[];let comparisons=0;
  for(let y=0;y<=height-h;y++)for(let x=0;x<=width-w;x++) {
    const n=integral[(y+h)*stride+x+w]-integral[y*stride+x+w]-integral[(y+h)*stride+x]+integral[y*stride+x];
    if(n<count*threshold||n>count/threshold)continue;
    if((comparisons+=w*h)>maxComparisons)throw new Error('Matching budget exceeded; use a cleaner example or a smaller drawing');
    let overlap=0;
    for(let ty=0;ty<h;ty++)for(let tx=0;tx<w;tx++)overlap+=t[ty*w+tx]&data[(y+ty)*width+x+tx];
    const score=overlap/(count+n-overlap);
    if(score>=threshold){candidates.push({left:x,top:y,width:w,height:h,score});if(candidates.length>25000)throw new Error('Too many ambiguous matches; refine the example');}
  }
  candidates.sort((a,b)=>b.score-a.score||a.top-b.top||a.left-b.left);
  const matches=[];
  for(const c of candidates)if(!matches.some(m=>Math.abs(c.left-m.left)<w*.6&&Math.abs(c.top-m.top)<h*.6)){matches.push(c);if(matches.length>5000)throw new Error('Too many matches');}
  return matches.sort((a,b)=>a.top-b.top||a.left-b.left);
}
