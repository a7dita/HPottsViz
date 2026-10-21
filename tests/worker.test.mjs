import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { MODELS } from '../lib/models.js';
// Exercise the same worker module used by the website, with a Node adapter.
const adapter=`import {parentPort} from 'node:worker_threads';globalThis.onmessage=null;globalThis.postMessage=v=>parentPort.postMessage(v);await import(${JSON.stringify(new URL('../worker.js',import.meta.url).href)});parentPort.on('message',data=>globalThis.onmessage({data}));parentPort.postMessage({type:'loaded'});`;
for(const model of Object.keys(MODELS))test(`${model}: browser worker streams samples and completes`,{timeout:10000},async()=>{
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(adapter)),{type:'module'});
 try{await new Promise((resolve,reject)=>{
  const received=[];worker.on('error',reject);worker.on('message',data=>{
   if(data.type==='loaded')worker.postMessage({type:'start',model,config:{...MODELS[model].defaults,ns:2,np:4,c:.05,duration:.1,dt:.01,save_every:2,...(model==='conservative_f0'?{reverse_check:1}:{})}});
   if(data.type==='error')reject(Error(data.message));if(data.samples)received.push(...data.samples);
   if(data.type==='complete'){assert.equal(received.length,6);assert.equal(received[0].time,0);assert.equal(received.at(-1).time,.1);assert.ok(data.state.q.length===750);if(model==='conservative_f0'){assert.ok(data.reversal.position<1e-11&&data.reversal.momentum<1e-11);assert.ok(!('theta' in data.state)&&!('pt' in data.state));}resolve();}
  });
 });}finally{await worker.terminate();}
});

test('F0 preparation worker saves the release point even between sparse plot samples', {timeout:10000},async()=>{
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(adapter)),{type:'module'});
 try{await new Promise((resolve,reject)=>{
  const received=[];worker.on('error',reject);worker.on('message',data=>{
   if(data.type==='loaded')worker.postMessage({type:'start',model:'conservative_f0',config:{...MODELS.conservative_f0.defaults,ns:2,np:4,c:.05,duration:1.2,dt:.005,save_every:10000,prepare_f0:1,f0_tolerance:.5}});
   if(data.type==='error')reject(Error(data.message));if(data.samples)received.push(...data.samples);
   if(data.type==='complete'){
    assert.equal(data.preparation.preparation_phase,'released');assert.equal(data.preparation.release_step,199);
    assert.equal(received.length,3);assert.equal(received[1].time,199*.005);
    assert.equal(received[1].diagnostic.energy_error,0);
    assert.equal(data.state.preparation.release_step,199);resolve();
   }
  });
 });}finally{await worker.terminate();}
});
