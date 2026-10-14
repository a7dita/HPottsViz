import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Simulation, RNG } from '../lib/engine.js';
import { MODELS, PARAMS, validate } from '../lib/models.js';
const fixture=model=>JSON.parse(gunzipSync(readFileSync(new URL(`./${model}-reference.json.gz`,import.meta.url))));
function near(actual,expected,tol=2e-11){assert.ok(Math.abs(actual-expected)<tol,`${actual} vs ${expected}, error ${Math.abs(actual-expected)}`);}
for(const model of ['minimal','hidden','conservative']){
 test(`${model}: trajectory matches HPotts Fortran from the same graph and initial state`,()=>{
  const f=fixture(model),s=new Simulation(model,f.config,f);
  for(let it=0;it<=s.steps;it++){
   const sample=s.sample();f.overlaps[it]&&sample.overlaps.forEach((v,i)=>near(v,f.overlaps[it][`m${i+1}`]));
   if(model==='conservative')near(sample.energy,f.energy[it].H_per_unit);
   if(model==='hidden'){near(sample.energy,f.energy[it].Fext_per_unit);near(sample.diagnostic.dissipation,f.energy[it].dFextdt_per_unit);}
   if(it<s.steps)s.step();
  }
  for(const [key,values] of Object.entries(f.final))values.forEach((v,j)=>near(s[key][j],v));
  if(model==='conservative'){s.reverseMomenta();for(let i=0;i<s.steps;i++)s.conservative();const e=s.reversalError();assert.ok(e.position<1e-11&&e.momentum<1e-11);}
 });
}
test('equilibrium: Fortran initial energy and overlaps, exact conditional energy and field-cache updates',()=>{
 const f=fixture('equilibrium'),s=new Simulation('equilibrium',f.config,f),initial=s.sample();
 near(initial.energy,f.energy[0].F_per_unit);initial.overlaps.forEach((v,i)=>near(v,f.overlaps[0][`m${i+1}`]));
 const old=s.q.slice(),energy=s.net.energy(old),noise=Array.from({length:2*s.d},(_,i)=>Math.sin(i+.5));
 const proposal=s.moveSite(0,noise,0);assert.equal(proposal.accepted,true);
 near((s.net.energy(s.q)-energy)*250,proposal.df,1e-10);
 const h=s.net.fields(s.q);h.forEach((v,i)=>near(v,s.h[i]));
 near(s.q.slice(0,s.d).reduce((a,b)=>a+b,0),1);
 // Reverse proposal density calculation is checked independently in proposal-reference.json.
 const expected=JSON.parse(readFileSync(new URL('./proposal-reference.json',import.meta.url)));
 proposal.newprob.forEach((v,i)=>near(v,expected.prob[i]));near(proposal.df,expected.df);near(proposal.logAccept,expected.logAccept);
});
test('equilibrium: reproducible noisy trajectory stays on simplex; acceptance lies in [0,1]',()=>{
 const p={...MODELS.equilibrium.defaults,ns:2,np:5,c:.05,duration:.1,save_every:1};
 const a=new Simulation('equilibrium',p),b=new Simulation('equilibrium',p);
 for(let i=0;i<10;i++){a.step();b.step();b.sample();const sample=a.sample();assert.ok(sample.diagnostic.normalization_error<1e-12);assert.ok(sample.diagnostic.min_probability>0);assert.ok(sample.diagnostic.acceptance>=0&&sample.diagnostic.acceptance<=1);}
 assert.deepEqual(a.q,b.q);
});
test('hidden potential is nonincreasing and conservative H error converges under step refinement',()=>{
 const f=fixture('hidden'),s=new Simulation('hidden',{...f.config,duration:1},f);let prev=s.sample().energy;
 for(let i=0;i<s.steps;i++){s.step();const en=s.sample().energy;assert.ok(en<=prev+1e-12);prev=en;}
 const c=fixture('conservative'),errors=[];
 for(const dt of [.02,.01,.005]){const s=new Simulation('conservative',{...c.config,dt,duration:1},c);let max=0;for(let i=0;i<s.steps;i++){s.step();max=Math.max(max,Math.abs(s.sample().energy-s.initialEnergy));}errors.push(max);}
 assert.ok(errors[1]<errors[0]/3&&errors[2]<errors[1]/3,errors.join(','));
});
test('all model parameters have controls and baseline configurations validate',()=>{
 for(const [key,m] of Object.entries(MODELS)){validate(key,m.defaults);for(const [k,v] of Object.entries(m.defaults)){assert.ok(PARAMS[k],k);const steps=(v-PARAMS[k].min)/PARAMS[k].step;assert.ok(Math.abs(steps-Math.round(steps))<1e-6,`${key}.${k} baseline must align with slider increments`);}}
 assert.throws(()=>validate('hidden',{...MODELS.hidden.defaults,alpha:0}),/nonzero/);
 assert.throws(()=>validate('minimal',{...MODELS.minimal.defaults,cue:26}),/cued/);
 assert.throws(()=>validate('minimal',{...MODELS.minimal.defaults,tau_r:.05}),/smaller/);
 assert.throws(()=>validate('minimal',{...MODELS.minimal.defaults,dt:.03}),/multiple/);
 assert.throws(()=>validate('hidden',{...MODELS.hidden.defaults,rho:0,kappa:0}),/positive definite/);
});
test('network seed matches across models; independent seeds preserve network construction',()=>{
 const common={ns:2,np:4,c:.05,aa:.15,seed0:7,cue:1,cue_fraction:.5,duration:.1};
 const a=new Simulation('minimal',{...common,dt:.01}),e=new Simulation('equilibrium',{...common,noise_seed:555,dt:.01});
 assert.deepEqual(a.net.patterns,e.net.patterns);assert.deepEqual(a.net.neighbors,e.net.neighbors);assert.deepEqual(a.q,e.q);
 const rng=new RNG(0);for(let i=0;i<100000;i++)rng.uniform();assert.ok(Number.isInteger(rng.state)&&rng.state>=0&&rng.state<=0xffffffff);
});
