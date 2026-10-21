import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, Network } from '../lib/engine.js';
import { MODELS, NETWORK_SIZES, validate } from '../lib/models.js';
import { parameterDocument, parseParameters } from '../lib/parameter-json.js';
import { network } from '../lib/plots.js';
const near=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
const common={ns:2,np:4,c:.02,duration:.1,dt:.01,save_every:1};

for(const n of NETWORK_SIZES)for(const model of Object.keys(MODELS))test(`${model}: all ${n} units evolve and export at the selected size`,()=>{
 const s=new Simulation(model,{...common,n}),before=s.q.slice();
 assert.equal(s.net.n,n);assert.equal(s.q.length,n*3);assert.equal(s.net.offsets.length,n+1);
 assert.ok(s.net.patterns.every(p=>p.length===n&&p.filter(k=>k>0).length===Math.floor(n*s.p.aa)));
 for(let i=0;i<s.steps;i++)s.step();
 const v=s.sample(),snapshot=s.snapshot();
 assert.equal(snapshot.q.length,n*3);assert.ok(v.overlaps.every(Number.isFinite));assert.ok(Number.isFinite(v.energy));
 assert.ok(v.diagnostic.normalization_error<1e-12);
 assert.notDeepEqual(s.q.slice(-3),before.slice(-3));
 if(model==='equilibrium')assert.equal(s.order.length,n);
 if(s.isHamiltonian){s.reverseMomenta();for(let i=0;i<s.steps;i++)s.conservative();const e=s.reversalError();assert.ok(e.position<1e-11&&e.momentum<1e-11);}
 const selected={...MODELS[model].defaults,n};
 assert.deepEqual(parseParameters(JSON.stringify(parameterDocument(model,selected))).config,selected);
});

for(const n of NETWORK_SIZES)test(`N=${n}: Hebbian denominator, fields and energy per unit use N, including the last unit`,()=>{
 const p={...MODELS.conservative_f0.defaults,n,ns:2,np:1,aa:.2,kinetic_sigma:.03};
 const pattern=Array.from({length:n},(_,i)=>i<Math.floor(n*p.aa)?1:0);
 const graph={patterns:[pattern],edges:[[0,n-1]]};
 const net=new Network(p,graph),bias=p.aa/p.ns;
 const weight=(1-bias)*(-bias)/(n*p.c*p.aa*(1-bias));near(net.weights[0],weight);
 const q=new Float64Array(n*3);for(let i=0;i<n;i++)q[i*3]=1;
 q[0]=0;q[1]=1;q[(n-1)*3]=0;q[(n-1)*3+1]=1;
 const field=net.fields(q);near(field[(n-1)*3+1],weight);
 near(net.energy(q),(-weight+2*p.uu)/n);
 const empty={patterns:[pattern],edges:[],state:{q:Array(n*3).fill(1/3)}};
 const sim=new Simulation('conservative_f0',p,empty),v=sim.sample();
 near(v.f0,p.uu*2/3-Math.log(3)/p.beta);near(v.kinetic,.03);near(v.energy,v.f0+.03);
});

for(const n of [500,1000])test(`N=${n}: stochastic conditional energy and cached fields match direct evaluation`,()=>{
 const s=new Simulation('equilibrium',{...common,n}),old=s.net.energy(s.q);
 const move=s.moveSite(n-1,Array.from({length:6},(_,k)=>Math.sin(k+.5)),0);
 assert.equal(move.accepted,true);near((s.net.energy(s.q)-old)*n,move.df,1e-10);
 const field=s.net.fields(s.q);field.forEach((v,j)=>near(v,s.h[j]));
});

test('N=1000: F0 preparation releases with a correctly normalized energy reference',()=>{
 const s=new Simulation('conservative_f0',{...common,n:1000,prepare_f0:1,f0_tolerance:.5,dt:.005,duration:1.1});
 for(let i=0;i<199;i++)s.step();near(s.sample().diagnostic.energy_error,0);
 assert.equal(s.preparation.releaseStep,199);
 for(let i=199;i<s.steps;i++)s.step();
 assert.ok(Math.abs(s.sample().diagnostic.energy_error)<1e-5);
});

test('legacy parameter imports retain N=250; unsupported and excessive allocations are rejected',()=>{
 for(const model of Object.keys(MODELS)){
  const legacy=parameterDocument(model,MODELS[model].defaults);delete legacy.config.n;
  assert.equal(parseParameters(JSON.stringify(legacy)).config.n,250);
  assert.throws(()=>validate(model,{...MODELS[model].defaults,n:750}),/250, 500 or 1000/);
  assert.throws(()=>validate(model,{...MODELS[model].defaults,n:1000,ns:12,c:1}),/256 MiB/);
 }
});

for(const n of NETWORK_SIZES)test(`state grid draws every one of ${n} units within the canvas`,()=>{
 const cells=[],ctx=new Proxy({fillRect:(...args)=>cells.push(args)},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const canvas={width:0,height:0,getBoundingClientRect:()=>({width:500,height:170}),getContext:()=>ctx};
 const q=new Float64Array(n*2);for(let i=0;i<n;i++)q[2*i]=1;
 network(canvas,q,2,n);assert.equal(cells.length,n);
 for(const [x,y,w,h] of cells){assert.ok(x>=0&&y>=0&&x+w<=500&&y+h<=170&&w>0&&h>0);}
});
