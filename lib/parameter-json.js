import { MODELS, memoryCount, validate } from './models.js';

export function parameterDocument(model, config) {
 const params=Object.fromEntries(Object.keys(MODELS[model].defaults).map(key=>[key,config[key]]));
 validate(model,params);
 return {version:1,model,config:params};
}

export function parseParameters(text) {
 let data;
 try { data=JSON.parse(text); } catch { throw Error('Choose a valid JSON parameter file.'); }
 if(!data || typeof data!=='object' || Array.isArray(data) || !Object.hasOwn(MODELS,data.model))throw Error('The JSON must identify an HPottsViz model.');
 if(data.version!==1)throw Error('Unsupported parameter file version.');
 if(!data.config || typeof data.config!=='object' || Array.isArray(data.config))throw Error('The JSON must contain a parameter config.');
 // Legacy exports used a fixed network of 250 units.
 if(!Object.hasOwn(data.config,'n'))data.config.n=MODELS[data.model].defaults.n;
 // Convert legacy count-based controls while preserving the stored memories.
 if(Object.hasOwn(data.config,'np')){
  if(!Number.isInteger(data.config.np)||data.config.np<1||data.config.np>400)throw Error('Legacy stored-memory count must be an integer between 1 and 400.');
  if(!Object.hasOwn(data.config,'memory_load'))data.config.memory_load=data.config.np/data.config.n;
  if(memoryCount(data.config)!==data.config.np)throw Error('Stored-memory count must equal round(αN).');
  delete data.config.np;
 }
 // The first conservative F₀ exports predate optional target preparation.
 // Only these newly added controls may be absent; keep all old validation strict.
 if(data.model==='conservative_f0')for(const key of ['prepare_f0','target_f0','f0_tolerance'])if(!Object.hasOwn(data.config,key))data.config[key]=MODELS.conservative_f0.defaults[key];
 const keys=Object.keys(MODELS[data.model].defaults);
 if(keys.some(key=>!Object.hasOwn(data.config,key)) || Object.keys(data.config).some(key=>!keys.includes(key)))throw Error('The parameter config must contain exactly the controls for this model.');
 return parameterDocument(data.model,data.config);
}
