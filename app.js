import { MODELS, PARAMS, SOURCE, memoryCount, validate } from './lib/models.js';
import { parameterDocument, parseParameters } from './lib/parameter-json.js';
import { plot, heatmap, network, memoryColour, format } from './lib/plots.js';
const $=id=>document.getElementById(id);
const configs=Object.fromEntries(Object.entries(MODELS).map(([k,m])=>[k,{...m.defaults}]));
let model='minimal',worker=null,running=false,paused=false,reversing=false,samples=[],q=null,run=null,plotScale=null,renderQueued=false,started=0;
const isHamiltonian=key=>key==='conservative'||key==='conservative_f0';
const iconPaths={minimal:'M4 19 Q9 3 14 15 T26 12',equilibrium:'M3 18 l4 -9 4 13 4 -16 4 12 4 -6 4 5',conservative:'M3 15 C7 1 12 1 16 15 S25 29 29 15',conservative_f0:'M3 16 C7 5 12 5 16 16 S25 27 29 16',hidden:'M3 8 Q10 8 15 17 T29 20 M3 23 Q10 23 15 13 T29 8'};
const interpretation={minimal:'Adaptive dynamics are out of equilibrium: the activity potential F₀ is neither conserved nor a Lyapunov function for the coupled (r, θ) flow.',equilibrium:'The finite-step Metropolis correction preserves a Gibbs equilibrium distribution against flat simplex measure. Energy fluctuates. The acceptance rate helps assess the integration step; low acceptance calls for a smaller dt.',conservative:'The total Hamiltonian should remain close to its initial value. The plot includes potential and kinetic exchange and reports numerical drift. Signed sphere coordinates provide the reflecting continuation at zero probability.',conservative_f0:'Activity follows deterministic second-order motion on the F₀ landscape. Initial K/N sets H(0)/N = F₀(0)/N + K(0)/N. Keep network, cue and momentum seed fixed when comparing energies. Total H is conserved in continuous time; the displayed drift measures finite-step error. A memory-activation energy window is an experimental question.',hidden:'The full extended potential decreases in the continuous flow. Prepared hidden energy can reorganize retrieval transiently; F₀ alone need not decrease. Finite RK4 steps can introduce numerical error.'};
for(const [key,m] of Object.entries(MODELS)){
 const b=document.createElement('button');b.id='tab-'+key;b.type='button';b.className='model-tab';b.setAttribute('role','tab');b.setAttribute('aria-controls','model-panel');b.innerHTML=`<svg class="icon" viewBox="0 0 32 32" aria-hidden="true"><path d="${iconPaths[key]}" fill="none" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round"/></svg><span><strong>${m.short}</strong><small>${{minimal:'Adaptation & latching',equilibrium:'Noise & Gibbs sampling',conservative:'Momentum & energy',conservative_f0:'F₀ & activity momentum',hidden:'Reciprocal relaxation'}[key]}</small></span>`;
 b.onclick=()=>selectModel(key);$('model-tabs').append(b);
 b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const keys=Object.keys(MODELS),i=keys.indexOf(key),next=e.key==='Home'?keys[0]:e.key==='End'?keys.at(-1):keys[(i+(e.key==='ArrowRight'?1:keys.length-1))%keys.length];selectModel(next);$('tab-'+next).focus();}};
}
function controls(){
 const m=MODELS[model],config=configs[model],fields=$('parameter-fields');fields.replaceChildren();
 for(const group of ['Network','Dynamics','Initialization','Integration']){
  const keys=Object.keys(m.defaults).filter(k=>PARAMS[k].group===group);if(!keys.length)continue;
  const details=document.createElement('details');details.className='parameter-group';details.open=group==='Dynamics'||group==='Network';
  const summary=document.createElement('summary');summary.textContent=group;details.append(summary);
  for(const key of keys){
   const meta=PARAMS[key],id='param-'+key,div=document.createElement('div');div.className='parameter'+(key.includes('seed')?' seed':'');
   const label=document.createElement('label');label.htmlFor=id;label.title=meta.help;label.innerHTML=`<span>${meta.label}</span><span class="symbol">${meta.symbol}</span>`;div.append(label);
   const help=document.createElement('p');help.className='help';help.id=id+'-help';help.textContent=meta.help;
   const row=document.createElement('div');row.className='input-row';let input,slider;
   if(meta.options){input=document.createElement('select');meta.options.forEach((name,v)=>{const o=document.createElement('option');o.value=meta.values?.[v]??v;o.textContent=name;input.append(o);});input.value=config[key];}
   else{
    input=document.createElement('input');input.type='number';input.min=meta.min;input.max=key==='cue'?memoryCount(config):meta.max;input.step=meta.step;input.value=config[key];
    if(!key.includes('seed')&&!meta.numberOnly){
     slider=document.createElement('input');slider.type='range';slider.min=meta.min;slider.max=input.max;slider.step=meta.step;slider.value=config[key];slider.setAttribute('aria-label',meta.label+' slider');
     slider.oninput=()=>{input.value=slider.value;update(key,Number(input.value));};row.append(slider);
    }
   }
   input.id=id;input.setAttribute('aria-describedby',help.id);input.title=meta.help;
   input.oninput=()=>{if(slider)slider.value=input.value;update(key,input.value===''?NaN:Number(input.value));};row.append(input);div.append(row,help);if(key==='memory_load'){const count=document.createElement('p');count.id='memory-count';count.className='plot-note';div.append(count);}details.append(div);
  }fields.append(details);
 }
 contextControls();estimate();
}
function update(key,value){
 configs[model][key]=value;
 if(model==='conservative_f0'&&key==='prepare_f0'&&value){configs[model].reverse_check=0;$('param-reverse_check').value=0;}
 if(key==='n'||key==='memory_load'){
  const count=memoryCount(configs[model]);
  if(Number.isInteger(count)&&count>=1){
   if(configs[model].cue>count){configs[model].cue=count;$('param-cue').value=count;}
   $('param-cue').max=count;const slider=$('param-cue').parentElement.querySelector('[type=range]');if(slider){slider.max=count;slider.value=configs[model].cue;}
  }
  if(!run)queueRender();
 }
 contextControls();estimate();
}
function contextControls(){
 if(model==='conservative_f0'){
  const enabled=Boolean(configs[model].prepare_f0);
  for(const key of ['target_f0','f0_tolerance'])$('param-'+key).disabled=!enabled;
  $('param-reverse_check').disabled=enabled;
  $('preparation-note').hidden=!enabled;
  $('preparation-note').textContent='Preparation: average F₀/N over the last 100 integration steps. Below target, multiply momenta by 1.001; above target, divide by 1.001. Inside tolerance, do not rescale. Release permanently after 100 consecutive means within tolerance. Duration includes preparation; H is conserved only after release. Full-run time reversal is unavailable during preparation.';
  $('model-caption').textContent=enabled?'Prepare a target mean F₀, then release activity into conservative motion.':MODELS[model].caption;
  if(!samples.length)$('energy-note').textContent=enabled?'Preparation → conservative motion':'H = F₀ + K';
 }else $('preparation-note').hidden=true;
 if(model!=='hidden')return;
 const init=configs.hidden.hidden_init;
 for(const [k,enabled] of [['initial_a',init>0],['initial_u',init===1],['hidden_seed',init>=2]]){
  const input=$('param-'+k);input.disabled=!enabled;const slider=input.parentElement.querySelector('[type=range]');if(slider)slider.disabled=!enabled;
 }
}
function estimate(){const p=configs[model],steps=Math.round(p.duration/p.dt);$('memory-count').textContent=`${memoryCount(p)} stored memories at N = ${p.n.toLocaleString()}`;$('run-estimate').textContent=Number.isFinite(steps)?`${p.n.toLocaleString()} units · ${steps.toLocaleString()} integration steps · sample every ${p.save_every} steps · ${memoryCount(p)} stored memories (α = ${p.memory_load})`:'';networkLabels(run?.config.n??p.n);}
function networkLabels(n){$('network-badge').textContent=`${n.toLocaleString()} units`;$('network').setAttribute('aria-label',`Current most probable category of each of the ${n} units`);}
function selectModel(key,history=true){
 if(running)return;model=key;samples=[];q=null;run=null;reversing=false;document.title=`${MODELS[key].name} · HPottsViz`;
 for(const name of Object.keys(MODELS)){const selected=name===key;$('tab-'+name).setAttribute('aria-selected',selected);$('tab-'+name).tabIndex=selected?0:-1;}
 $('model-panel').setAttribute('aria-labelledby','tab-'+key);$('model-name').textContent=MODELS[key].name;$('model-caption').textContent=MODELS[key].caption;
 $('method').textContent='Numerical method: '+MODELS[key].method+'.';$('interpretation').textContent=interpretation[key];
 $('model-source').href=key==='conservative_f0'?'https://github.com/a7dita/HPottsViz/blob/main/lib/engine.js':`https://github.com/a7dita/HPotts/blob/${SOURCE}/src/${key}_potts.f90`;
 $('model-source').textContent=key==='conservative_f0'?'HPottsViz activity-only implementation ↗':'HPotts source implementation ↗';
 $('metric-energy-label').textContent=key==='minimal'?'Active fraction':MODELS[key].energy;
 $('energy-card').hidden=key==='minimal';
 const equations=$('model-equations');equations.replaceChildren();
 const template=$('equations-'+key);equations.hidden=!template;
 if(template)equations.append(template.content.cloneNode(true));
 $('energy-title').textContent=isHamiltonian(key)?'Hamiltonian & energy exchange':key==='hidden'?'Extended potential & activity energy':'Activity free energy';
 $('energy-note').textContent=key==='conservative_f0'?'H = F₀ + K':key==='conservative'?'H = V + K':key==='hidden'?'Fext decreases in the continuous flow':key==='equilibrium'?'Energy fluctuates under noise':'Out-of-equilibrium dynamics';
 $('threshold-card').hidden=key==='equilibrium'||key==='conservative_f0';$('status').textContent='Ready to explore';$('error').hidden=true;$('progress').value=0;
 $('csv').disabled=$('json').disabled=true;$('params-status').textContent='';controls();render();
 if(history)globalThis.history.replaceState(null,'',`/?model=${key}`);
}
function setRunning(value){running=value;$('import-params').disabled=$('export-params').disabled=$('params-file').disabled=value;$('parameter-fields').disabled=value;$('defaults').disabled=value;$('start').disabled=value;$('pause').disabled=!value;$('stop').disabled=!value;
 for(const key of Object.keys(MODELS))$('tab-'+key).disabled=value;
 if(!value){paused=false;$('pause').textContent='Pause';contextControls();}
}
function queueRender(){if(!renderQueued){renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render();});}}
function render(){
 const last=samples.at(-1),window=$('window').value,np=memoryCount(run?.config??configs[model]);
 const lines=Array.from({length:np},(_,m)=>({colour:memoryColour(m),value:s=>s.overlaps[m]}));
 plotScale=plot($('overlaps'),samples,lines,{window,fixedY:[Math.min(-.05,...samples.map(s=>Math.min(...s.overlaps))),Math.max(1.05,...samples.map(s=>Math.max(...s.overlaps)))]});
 const energies=model==='conservative_f0'?[['H','#9333ea','energy'],['F₀','#0284c7','f0'],['Kinetic','#e0992f','kinetic']]:model==='conservative'?[['H','#9333ea','energy'],['Potential','#0284c7','potential'],['Kinetic','#e0992f','kinetic'],['F₀','#16a34a','f0']]:model==='hidden'?[['Fext','#9333ea','energy'],['F₀','#0284c7','f0']]:[['F₀','#9333ea','energy']];
 if(model==='conservative_f0'&&(run?.config??configs[model]).prepare_f0)energies.push(['Mean F₀ (100 steps)','#16a34a','f0_mean_100'],['Target mean','#64748b','f0_target']);
 if(model!=='minimal')plot($('energy'),samples,energies.map(([name,colour,key])=>({name,colour,value:s=>key==='f0_mean_100'||key==='f0_target'?s.diagnostic[key]:s[key],width:1.8})),{window});
 $('energy-legend').innerHTML=energies.map(([name,c])=>`<span><i style="background:${c}"></i>${name}</span>`).join('');
 if(model!=='equilibrium'&&model!=='conservative_f0')plot($('threshold'),samples,lines.map((l,m)=>({...l,value:s=>s.theta[m]})),{window});
 const displayN=run?.config.n??configs[model].n;networkLabels(displayN);
 heatmap($('heatmap'),samples,np,window);network($('network'),q,(run?.config.ns??configs[model].ns)+1,displayN);
 if(!$('legend').children.length||$('legend').children.length!==np)$('legend').innerHTML=Array.from({length:np},(_,i)=>`<span><i style="background:${memoryColour(i)}"></i>${i+1}</span>`).join('');
 $('sample-count').textContent=samples.length?`${samples.length.toLocaleString()} saved samples`:'No trajectory yet';
 if(last){const best=last.overlaps.indexOf(Math.max(...last.overlaps));$('metric-time').textContent=format(last.time);$('metric-memory').textContent=best+1;$('metric-overlap').textContent=last.overlaps[best].toFixed(3);$('metric-energy').textContent=model==='minimal'?last.active.toFixed(3):last.energy.toFixed(5);
  const diag=last.diagnostic;let audit=`Simplex error: ${diag.normalization_error.toExponential(1)}.`;
  if(isHamiltonian(model))audit+=`${diag.energy_error===null?' H changes during preparation.':` ΔH/N${diag.preparation_phase==='released'?' since release':''}: ${diag.energy_error.toExponential(3)}.`} Boundary crossings: ${diag.boundary_crossings}.`;
  if(model==='conservative_f0'){const initial=samples[0];audit+=` Initial H/N: ${initial.energy.toFixed(6)} = F₀/N ${initial.f0.toFixed(6)} + K/N ${initial.kinetic.toFixed(6)}.`;}
  if(diag.preparation_phase){
   const mean=diag.f0_mean_100===null?`collecting ${diag.f0_window_count}/100 steps`:diag.f0_mean_100.toFixed(6);
   audit+=` Mean F₀/N (last 100 steps): ${mean}; target ${diag.f0_target} ± ${diag.f0_tolerance}.`;
   if(diag.preparation_phase==='preparing')audit+=` Preparing · within tolerance ${diag.f0_stable_steps}/100 steps · ${diag.rescale_count} rescalings.`;
   else audit+=` Released at t=${format(diag.release_step*(run?.config.dt??configs[model].dt))}; H/N at release ${diag.release_energy.toFixed(6)}. Rescaling is permanently off.`;
   $('energy-note').textContent=diag.preparation_phase==='preparing'?'Preparation · H changes':'Released · H = F₀ + K conserved';
  }
  if(model==='equilibrium')audit+=` Proposal acceptance: ${(100*diag.acceptance).toFixed(1)}%.`;
  if(model==='hidden')audit+=` Predicted dFext/dt per unit: ${diag.dissipation.toExponential(3)}.`;
  if(run?.reversal)audit+=` Reversal errors · position ${run.reversal.position.toExponential(2)}, momentum ${run.reversal.momentum.toExponential(2)}.`;
  $('audit').textContent=audit;$('csv').disabled=$('json').disabled=false;
 }else{for(const key of ['time','memory','overlap','energy'])$('metric-'+key).textContent='—';$('audit').textContent='Energy and probability diagnostics will appear during the run.';}
}
$('start').onclick=()=>{
 const config={...configs[model]};try{validate(model,config);}catch(e){$('error').hidden=false;$('error').textContent=e.message;return;}
 worker?.terminate();samples=[];q=null;paused=false;reversing=false;started=performance.now();
 run={version:1,model,config,network_size:config.n,memory_count:memoryCount(config),source_commit:SOURCE,engine:'HPottsViz JavaScript / Mulberry32',started_at:new Date().toISOString()};
 $('error').hidden=true;$('status').textContent='Preparing memories and connectivity…';$('progress').value=0;setRunning(true);render();
 worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{
  if(data.samples)samples.push(...data.samples);if(data.q)q=data.q;
  if(data.preparation)run.preparation=data.preparation;
  if(data.type==='ready'){Object.assign(run,{patterns:data.patterns,edges:data.edges,initial_state:data.initial});}
  if(data.type==='paused'){paused=true;$('pause').textContent='Resume';$('status').textContent='Paused';}
  if(data.type==='reversing'){reversing=true;run.final_state=data.state;$('status').textContent='Checking time reversal…';}
  if(data.type==='error'){$('error').hidden=false;$('error').textContent=data.message;$('status').textContent='Stopped after a numerical error';run.status='error';finish();}
  else if(data.type==='complete'){
   run.status='complete';if(data.reversal){run.reversal=data.reversal;q=Float64Array.from(run.final_state.q);}else run.final_state=data.state;
   $('status').textContent=`${data.preparation?.preparation_phase==='preparing'?'Run ended before target stabilized · rescaling was still active':'Simulation complete'} · ${((performance.now()-started)/1000).toFixed(1)} s`;finish();$('progress').value=1;
  }else if(data.type!=='paused'&&data.type!=='reversing'&&!paused){
   const t=samples.at(-1)?.time??0;const step=data.step??Math.round(t/config.dt);$('progress').value=t/config.duration;
   $('status').textContent=reversing?`Checking time reversal · ${data.reverseStep??0} / ${Math.round(config.duration/config.dt)}`:`${data.preparation?.preparation_phase==='preparing'?'Preparing target mean F₀':data.preparation?.preparation_phase==='released'?'Conservative motion after release':'Running'} · ${format(t)} / ${config.duration} time units · step ${step.toLocaleString()}`;
  }
  queueRender();
 };
 worker.onerror=e=>{$('error').hidden=false;$('error').textContent=e.message||'The simulation worker failed.';$('status').textContent='Worker error';run.status='error';finish();};
 worker.postMessage({type:'start',model,config});
};
function finish(){setRunning(false);worker?.terminate();worker=null;run.finished_at=new Date().toISOString();}
$('pause').onclick=()=>{if(paused){paused=false;$('pause').textContent='Pause';worker.postMessage({type:'resume'});}else{worker.postMessage({type:'pause'});}};
$('stop').onclick=()=>{run.status='stopped';finish();$('status').textContent='Stopped · saved samples remain available';};
$('defaults').onclick=()=>{configs[model]={...MODELS[model].defaults};controls();};
$('parameter-form').onsubmit=e=>{e.preventDefault();if(!running)$('start').click();};
$('window').onchange=queueRender;
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-params').onclick=()=>{
 if(running)return;
 try{
  const data=parameterDocument(model,configs[model]);
  download(`hpottsviz-${model}-params.json`,JSON.stringify(data,null,2),'application/json');
  $('params-status').textContent='Exported the currently selected parameters.';
 }catch(e){$('params-status').textContent=e.message;}
};
$('import-params').onclick=()=>{if(!running)$('params-file').click();};
$('params-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||running)return;
 // File reads are asynchronous: a run may start before the file is ready.
 try{
  const text=await file.text();if(running)return;
  const data=parseParameters(text);
  configs[data.model]=data.config;selectModel(data.model);
  $('error').hidden=true;$('params-status').textContent='Imported parameters. Ready to run.';
 }catch(e){$('params-status').textContent=e.message;}
};
$('json').onclick=()=>download(`hpottsviz-${model}.json`,JSON.stringify({...run,samples,latest_probabilities:q?Array.from(q):null},null,2),'application/json');
$('csv').onclick=()=>{
 const preparationKeys=model==='conservative_f0'?['preparation_phase','f0_mean_100','f0_window_count','f0_target','f0_tolerance','f0_stable_steps','rescale_count','release_step','release_energy']:[];
 const columns=['time',...Array.from({length:memoryCount(run.config)},(_,i)=>`m${i+1}`),'energy_per_unit','F0_per_unit','potential_per_unit','kinetic_per_unit','active_mass_per_unit',...Array.from({length:memoryCount(run.config)},(_,i)=>`theta_m${i+1}`),'normalization_error','min_probability','energy_error','acceptance_rate','dFextdt_per_unit',...preparationKeys,'network_size','memory_load','memory_count'];
 const rows=samples.map(s=>[s.time,...s.overlaps,s.energy,s.f0,s.potential,s.kinetic,s.active,...Array.from({length:memoryCount(run.config)},(_,i)=>s.theta[i]??''),s.diagnostic.normalization_error,s.diagnostic.min_probability,s.diagnostic.energy_error??'',s.diagnostic.acceptance??'',s.diagnostic.dissipation??'',...preparationKeys.map(key=>s.diagnostic[key]??''),run.config.n,run.config.memory_load,memoryCount(run.config)].join(','));
 download(`hpottsviz-${model}.csv`,[columns.join(','),...rows].join('\n'),'text/csv');
};
$('overlaps').onpointermove=e=>{
 if(!samples.length||!plotScale)return;const rect=$('overlaps').getBoundingClientRect(),px=e.clientX-rect.left,{pad,pw,xmin,xmax}=plotScale;
 const t=xmin+Math.max(0,Math.min(1,(px-pad.l)/pw))*(xmax-xmin);let low=0,high=samples.length-1;while(low<high){const mid=Math.floor((low+high)/2);if(samples[mid].time<t)low=mid+1;else high=mid;}
 const s=samples[low],best=s.overlaps.indexOf(Math.max(...s.overlaps)),tip=$('tooltip');tip.textContent=`t = ${format(s.time)} · memory ${best+1}: ${s.overlaps[best].toFixed(3)}`;tip.hidden=false;tip.style.left=Math.min(Math.max(0,px+8),rect.width-205)+'px';tip.style.top='16px';
};
$('overlaps').onpointerleave=()=>{$('tooltip').hidden=true;};
new ResizeObserver(queueRender).observe($('model-panel'));
window.addEventListener('beforeunload',()=>worker?.terminate());
const query=new URLSearchParams(location.search).get('model'),pathModel=location.pathname.split('/').filter(Boolean).at(-1);
selectModel(MODELS[query]?query:MODELS[pathModel]?pathModel:'minimal',false);
