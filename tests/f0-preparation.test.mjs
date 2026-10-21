import test from 'node:test';
import assert from 'node:assert/strict';
import { F0Preparation, F0_RESCALE } from '../lib/f0-preparation.js';
import { Simulation } from '../lib/engine.js';
import { MODELS, validate } from '../lib/models.js';
import { parameterDocument, parseParameters } from '../lib/parameter-json.js';
const near=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
const config={ns:2,np:4,c:.05,duration:3,dt:.005};

test('preparation uses exactly the last 100 integration steps, with a full-window warmup',()=>{
 const c=new F0Preparation(-.11,.001);
 for(let i=1;i<100;i++){assert.equal(c.observe(-.2,i),1);assert.equal(c.mean,null);}
 assert.equal(c.observe(-.2,100),F0_RESCALE);near(c.mean,-.2);
 const d=new F0Preparation(1000,.001);
 for(let i=1;i<=250;i++){d.observe(i,i);if(i>=100)near(d.mean,i-49.5);}
 const cool=new F0Preparation(-.11,.001);
 for(let i=1;i<=100;i++)cool.observe(-.05,i);
 near(cool.observe(-.05,101),1/F0_RESCALE);
});

test('release requires 100 consecutive in-band means and never rescales again',()=>{
 const c=new F0Preparation(-.11,.001);
 for(let i=1;i<=198;i++){assert.equal(c.observe(-.11,i),1);assert.equal(c.phase,'preparing');}
 assert.equal(c.stable,99);assert.equal(c.observe(-.11,199),1);
 assert.equal(c.phase,'released');assert.equal(c.releaseStep,199);
 for(let i=200;i<400;i++)assert.equal(c.observe(10,i),1);
 assert.equal(c.releaseStep,199);assert.equal(c.rescaleCount,0);near(c.mean,10);
 const interrupted=new F0Preparation(-.11,.001);
 for(let i=1;i<=150;i++)interrupted.observe(-.11,i);
 assert.equal(interrupted.stable,51);interrupted.observe(1,151);
 assert.equal(interrupted.stable,0);assert.equal(interrupted.phase,'preparing');
});

test('engine rescales only momenta in the requested direction, preserving the simplex and tangent constraint',()=>{
 for(const [target,scale] of [[.9,F0_RESCALE],[-.9,1/F0_RESCALE]]){
  const controlled=new Simulation('conservative_f0',{...config,prepare_f0:1,target_f0:target});
  const free=new Simulation('conservative_f0',config);
  for(let i=0;i<100;i++){controlled.step();free.step();}
  assert.deepEqual(controlled.q,free.q);assert.deepEqual(controlled.z,free.z);
  controlled.pz.forEach((v,j)=>near(v,free.pz[j]*scale));
  assert.equal(controlled.sample().diagnostic.energy_error,null);
  assert.equal(controlled.preparation.rescaleCount,1);
  for(let i=0;i<250;i++){let dot=0;for(let k=0;k<controlled.d;k++){const j=i*controlled.d+k;dot+=controlled.z[j]*controlled.pz[j];}near(dot,0);}
  assert.ok(controlled.check().error<1e-12);
 }
});

test('release records its own H baseline, ignores plot sample cadence and leaves autonomous dynamics untouched',()=>{
 const a=new Simulation('conservative_f0',{...config,prepare_f0:1,f0_tolerance:.5,save_every:1});
 const b=new Simulation('conservative_f0',{...config,prepare_f0:1,f0_tolerance:.5,save_every:10000});
 const free=new Simulation('conservative_f0',config);
 for(let i=1;i<=a.steps;i++){
  a.step();b.step();free.step();a.sample();
  if(i===199){assert.equal(a.preparation.releaseStep,199);near(a.sample().diagnostic.energy_error,0);}
 }
 assert.deepEqual(a.q,b.q);assert.deepEqual(a.pz,b.pz);
 assert.deepEqual(a.q,free.q);assert.deepEqual(a.pz,free.pz);
 assert.equal(a.preparation.phase,'released');assert.equal(a.preparation.rescaleCount,0);
 const v=a.sample();near(v.diagnostic.energy_error,v.energy-a.preparation.releaseEnergy);
 assert.ok(Math.abs(v.diagnostic.energy_error)<1e-5);
 assert.equal(a.snapshot().preparation.release_step,199);
 const off=new Simulation('conservative_f0',{...config,prepare_f0:0,target_f0:.9});
 for(let i=0;i<off.steps;i++)off.step();assert.deepEqual(off.q,free.q);
});

test('old F0 parameter files import with preparation off; new controls round-trip and incompatible reversal is rejected',()=>{
 const old=parameterDocument('conservative_f0',MODELS.conservative_f0.defaults);
 for(const key of ['prepare_f0','target_f0','f0_tolerance'])delete old.config[key];
 const parsed=parseParameters(JSON.stringify(old));assert.equal(parsed.config.prepare_f0,0);assert.equal(parsed.config.target_f0,-.11);
 const on=parameterDocument('conservative_f0',{...MODELS.conservative_f0.defaults,prepare_f0:1,target_f0:-.123,f0_tolerance:.0001});
 assert.deepEqual(parseParameters(JSON.stringify(on)),on);
 assert.throws(()=>validate('conservative_f0',{...on.config,reverse_check:1}),/not reversible/);
});
