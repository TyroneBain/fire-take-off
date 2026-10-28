// Each control captures its own record/version so a late blur cannot edit another heading.
export function coverageInput({record,kind,api,reload,notice,node,scaled}){
 const label=node('label','Coverage radius','coverage-control'),input=node('input');input.type='number';input.min='0';input.max='10000';input.step='any';input.required=true;input.value=record.coverage_radius??0;input.setAttribute('aria-label',`${record.name} coverage radius in metres`);label.append(input,node('span','m'));
 let busy=false;
 async function save(){if(busy||!input.isConnected)return;const radius=Number(input.value);if(!input.reportValidity()||radius===(record.coverage_radius??0))return;busy=true;input.disabled=true;
  try{await api(`/api/${kind}/${record.id}/coverage`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({radius,version:record.version})});await reload();notice(radius?'Coverage radius saved':'Coverage removed');}
  catch(error){notice(error.message,true);await reload().catch(()=>{});}
  finally{busy=false;input.disabled=false;}
 }
 input.addEventListener('blur',save);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save();}else if(e.key==='Escape'){e.preventDefault();input.value=record.coverage_radius??0;input.blur();}});
 const wrap=node('div',null,'coverage-settings');wrap.append(label);if(!scaled)wrap.append(node('small','Set this page’s scale to display coverage.','hint'));return wrap;
}
