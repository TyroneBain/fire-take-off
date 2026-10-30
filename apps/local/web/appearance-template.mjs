// Copy the exact established exampleImage crop, retaining its anchor. The
// independent buffer survives transfer of the source page to the match worker.
export function appearanceTemplate(image,base){
 const {data,width,height}=image??{};
 if(!(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>4000000||data.length!==width*height*4)throw Error('Invalid colour and fine-detail source image');
 if(!base||base.ignore||base.elementSubset)throw Error('Colour and fine-detail matching does not support cleaned selections');
 const {left,top,width:w,height:h}=base;
 if(![left,top,w,h].every(Number.isSafeInteger)||left<0||top<0||w<1||h<1||w>256||h>256||w*h>4096||left+w>width||top+h>height)throw Error('Colour and fine-detail selection exceeds the 4096-pixel detail budget; select a smaller symbol');
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)rgba.set(data.subarray(((top+y)*width+left)*4,((top+y)*width+left+w)*4),y*w*4);
 for(let p=3;p<rgba.length;p+=4)if(rgba[p]!==255)throw Error('Colour and fine-detail matching requires an opaque selection');
 return {...base,data:rgba,anchorX:base.anchorX??w/2,anchorY:base.anchorY??h/2};
}
