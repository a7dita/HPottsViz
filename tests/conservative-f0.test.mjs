import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../lib/engine.js';
import { MODELS, N } from '../lib/models.js';
const config={ns:2,np:4,c:.05,duration:1,dt:.005};
const near=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);

test('F0 Hamiltonian: initial K is exact, varying K preserves network, cue and momentum directions',()=>{
 const a=new Simulation('conservative_f0',{...config,kinetic_sigma:.01});
 const b=new Simulation('conservative_f0',{...config,kinetic_sigma:.04});
 assert.deepEqual(a.net.weights,b.net.weights);assert.deepEqual(a.q,b.q);
 a.pz.forEach((v,i)=>near(b.pz[i],2*v));
 for(const s of [a,b]){
  const v=s.sample();near(v.kinetic,s.p.kinetic_sigma);near(v.energy,v.f0+v.kinetic);
  assert.equal(v.potential,v.f0);assert.equal(v.coupling,0);assert.equal(v.quadratic,0);
  assert.deepEqual(v.theta,[]);assert.equal(s.theta,null);assert.equal(s.pt,null);
  for(const k of ['theta','pt','a','u'])assert.ok(!(k in s.snapshot()));
 }
 for(const k of ['mass_theta','kinetic_theta','theta_initial_scale','temperature'])assert.ok(!(k in MODELS.conservative_f0.defaults));
});

test('F0 Hamiltonian: tangent force matches an independent energy finite difference',()=>{
 const s=new Simulation('conservative_f0',config),i=13,b=i*s.d;
 const z=s.z.slice(b,b+s.d),direction=Float64Array.from({length:s.d},(_,k)=>Math.sin(k+1));
 let radial=0;for(let k=0;k<s.d;k++)radial+=direction[k]*z[k];
 for(let k=0;k<s.d;k++)direction[k]-=radial*z[k];
 const norm=Math.hypot(...direction);for(let k=0;k<s.d;k++)direction[k]/=norm;
 const energy=eps=>{
  const q=s.q.slice();for(let k=0;k<s.d;k++)q[b+k]=(Math.cos(eps)*z[k]+Math.sin(eps)*direction[k])**2;
  return N*s.net.energy(q);
 };
 const eps=1e-5,derivative=(energy(eps)-energy(-eps))/(2*eps);
 let force=0;for(let k=0;k<s.d;k++)force+=s.fz[b+k]*direction[k];
 near(force,-derivative,1e-8);
});

test('F0 Hamiltonian: zero initial K still accelerates; energy error decreases on refinement and reversal retraces boundary crossings',()=>{
 const errors=[];
 for(const dt of [.02,.01,.005]){
  const s=new Simulation('conservative_f0',{...config,dt,kinetic_sigma:0}),q=s.q.slice();
  near(s.sample().kinetic,0);let error=0;
  for(let it=0;it<s.steps;it++){
   s.step();const v=s.sample();error=Math.max(error,Math.abs(v.energy-s.initialEnergy));
   assert.ok(v.diagnostic.normalization_error<1e-12);assert.ok(v.diagnostic.min_probability>=0);
  }
  assert.notDeepEqual(s.q,q);assert.ok(s.crossings>0);assert.ok(s.sample().kinetic>0);
  errors.push(error);s.reverseMomenta();for(let it=0;it<s.steps;it++)s.conservative();
  const e=s.reversalError();assert.ok(e.position<1e-11&&e.momentum<1e-11,JSON.stringify(e));
 }
 assert.ok(errors[1]<errors[0]/3&&errors[2]<errors[1]/3,errors.join(','));
});
