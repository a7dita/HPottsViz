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
   if(data.type==='loaded')worker.postMessage({type:'start',model,config:{...MODELS[model].defaults,ns:2,np:4,c:.05,duration:.1,dt:.01,save_every:2}});
   if(data.type==='error')reject(Error(data.message));if(data.samples)received.push(...data.samples);
   if(data.type==='complete'){assert.equal(received.length,6);assert.equal(received[0].time,0);assert.equal(received.at(-1).time,.1);assert.ok(data.state.q.length===750);resolve();}
  });
 });}finally{await worker.terminate();}
});
