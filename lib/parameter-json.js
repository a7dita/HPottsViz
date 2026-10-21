import { MODELS, validate } from './models.js';

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
 // The first conservative F₀ exports predate optional target preparation.
 // Only these newly added controls may be absent; keep all old validation strict.
 if(data.model==='conservative_f0')for(const key of ['prepare_f0','target_f0','f0_tolerance'])if(!Object.hasOwn(data.config,key))data.config[key]=MODELS.conservative_f0.defaults[key];
 const keys=Object.keys(MODELS[data.model].defaults);
 if(keys.some(key=>!Object.hasOwn(data.config,key)) || Object.keys(data.config).some(key=>!keys.includes(key)))throw Error('The parameter config must contain exactly the controls for this model.');
 return parameterDocument(data.model,data.config);
}
