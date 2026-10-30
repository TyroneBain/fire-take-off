const colours=[['Blue','#1480fa'],['Red','#df3046'],['Green','#14834a'],['Amber','#b96b0a'],['Purple','#9b3ab9'],['Cyan','#087d91'],['Pink','#c52376'],['Indigo','#4752bd'],['Brown','#885a32'],['Charcoal','#353d4c'],['Olive','#657523'],['Black','#111111']];
export function colourControl(item,{node,button,api,reload,notice}){
 const details=node('details',null,'count-colour'),summary=node('summary');summary.style.background=item.color;summary.title=`Change ${item.name} colour`;summary.setAttribute('aria-label',`Change ${item.name} colour`);details.append(summary);
 const palette=node('div',null,'count-colour-palette'),grid=node('div',null,'count-colour-grid'),error=node('p',null,'colour-error');error.setAttribute('role','alert');palette.append(grid);
 async function save(colour){if(colour===item.color){details.open=false;return;}palette.inert=true;error.textContent='';
  try{await api(`/api/items/${item.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:item.name,color:colour,version:item.version})});await reload();document.querySelector(`[data-item-id="${item.id}"] .count-colour>summary`)?.focus();}
  catch(e){error.textContent=e.message;notice(e.message,true);}finally{palette.inert=false;}
 }
 for(const[name,colour]of colours){const b=button('',()=>save(colour),'colour-swatch');b.style.background=colour;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(item.color.toLowerCase()===colour));if(item.color.toLowerCase()===colour)b.textContent='✓';grid.append(b);}
 const label=node('label','Custom colour'),custom=node('input');custom.type='color';custom.value=item.color;custom.setAttribute('aria-label',`Custom colour for ${item.name}`);custom.onchange=()=>save(custom.value);label.append(custom);palette.append(label,error);details.append(palette);
 details.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();details.open=false;summary.focus();}});details.addEventListener('dragstart',e=>{e.preventDefault();e.stopPropagation();});return details;
}
