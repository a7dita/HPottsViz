import test from 'node:test';
import assert from 'node:assert/strict';
import {MODELS} from '../lib/models.js';
import {parameterDocument,parseParameters} from '../lib/parameter-json.js';

for(const [model,{defaults}]of Object.entries(MODELS))test(`${model}: parameter JSON round trip preserves selected values`,()=>{
 const config={...defaults,beta:12.3,seed0:42};
 const document=parameterDocument(model,config);
 assert.deepEqual(parseParameters(JSON.stringify(document)),{version:1,model,config});
 assert.deepEqual(parseParameters(JSON.stringify({...document,samples:[],final_state:{}})),document);
 config.beta=15;
 assert.equal(document.config.beta,12.3);
});
test('invalid imports reject incomplete, mistyped, unknown and inconsistent parameters',()=>{
 const data=parameterDocument('hidden',MODELS.hidden.defaults);
 const invalid=['{',null,[],{...data,model:'toString'},{...data,version:2},{...data,config:{beta:10}},
 {...data,config:{...data.config,beta:'10'}},{...data,config:{...data.config,extra:1}},
 {...data,config:{...data.config,cue:100,np:2}},{...data,config:{...data.config,hidden_init:3,alpha:0}}];
 for(const value of invalid)assert.throws(()=>parseParameters(typeof value==='string'?value:JSON.stringify(value)));
});
