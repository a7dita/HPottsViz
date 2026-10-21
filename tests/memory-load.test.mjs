import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, NETWORK_SIZES, memoryCount, simulationConfig, validate } from '../lib/models.js';
import { Simulation } from '../lib/engine.js';
import { parameterDocument, parseParameters } from '../lib/parameter-json.js';

for(const model of Object.keys(MODELS))test(`${model}: default load scales memories and overlap traces with N`,()=>{
 assert.equal(MODELS[model].defaults.memory_load,.1);assert.ok(!('np' in MODELS[model].defaults));
 for(const n of NETWORK_SIZES){
  const config={...MODELS[model].defaults,n,ns:2,c:.01,dt:.01,duration:.02};
  assert.equal(memoryCount(config),n/10);validate(model,config);
  const sim=new Simulation(model,config);assert.equal(sim.p.np,n/10);assert.equal(sim.net.patterns.length,n/10);
  for(let i=0;i<sim.steps;i++)sim.step();
  assert.equal(sim.sample().overlaps.length,n/10);assert.ok(sim.sample().diagnostic.normalization_error<1e-12);
  const document=parameterDocument(model,config);assert.ok(!('np' in document.config));
  assert.deepEqual(parseParameters(JSON.stringify(document)),document);
 }
});

test('legacy count-based parameter files preserve p, N and the independent hidden-mixture alpha',()=>{
 for(const model of Object.keys(MODELS))for(const n of NETWORK_SIZES){
  const legacy={version:1,model,config:{...MODELS[model].defaults,n,np:25}};delete legacy.config.memory_load;
  const parsed=parseParameters(JSON.stringify(legacy));assert.equal(parsed.config.memory_load,25/n);assert.equal(memoryCount(parsed.config),25);
  assert.ok(!('np' in parsed.config));
  if(model==='hidden')assert.equal(parsed.config.alpha,1);
 }
 const old=simulationConfig('hidden',{np:8,ns:3});assert.equal(old.np,8);assert.equal(old.memory_load,8/250);assert.equal(old.alpha,1);
});

test('rounding, range validation, cue bounds and incompatible count/load inputs',()=>{
 const base={...MODELS.minimal.defaults};
 assert.equal(memoryCount({...base,n:500}),50);assert.equal(memoryCount({...base,n:1000}),100);
 assert.equal(memoryCount({...base,memory_load:.102}),26);
 assert.equal(memoryCount({...base,n:1000,memory_load:.4}),400);
 assert.throws(()=>validate('minimal',{...base,memory_load:.001}),/between 1 and 400/);
 assert.throws(()=>validate('minimal',{...base,memory_load:.401}),/Memory load/);
 assert.throws(()=>validate('minimal',{...base,n:500,cue:51}),/cued memory/);
 assert.throws(()=>new Simulation('minimal',{...base,n:500,np:25}),/round/);
 const bad={version:1,model:'minimal',config:{...base,n:500,np:25}};
 assert.throws(()=>parseParameters(JSON.stringify(bad)),/round/);
});
