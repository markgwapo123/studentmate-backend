import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createApp} from '../app.js';
import {monitorMongo} from '../utils/mongoHealth.js';
import {startKeepAlive} from '../utils/keepAlive.js';

test('public health is query-free, bypasses guards, and reflects connection state', async t=>{
 let connected=true;
 const db={command(){throw Error('Health must never query MongoDB');},collection(){throw Error('Health must never access accounts');}};
 const server=createApp(db,['https://studentmate-frontend.vercel.app'],{isMongoConnected:()=>connected}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url='http://127.0.0.1:'+server.address().port;
 for(const origin of ['https://studentmate-frontend.vercel.app','null','file://']){
  const response=await fetch(url+'/health',{headers:{Origin:origin,'Content-Type':'application/json'},method:'GET'});
  assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);
  const data=await response.json();assert.deepEqual(Object.keys(data),['status','uptime','mongo','timestamp']);assert.equal(data.status,'ok');assert.equal(data.mongo,'connected');assert(data.uptime>=0);assert(!isNaN(Date.parse(data.timestamp)));
 }
 const preflight=await fetch(url+'/health',{method:'OPTIONS',headers:{Origin:'null'}});assert.equal(preflight.status,204);
 const unknown=await fetch(url+'/health',{headers:{Origin:'https://unknown.example'}});assert.equal(unknown.status,200);assert.equal(unknown.headers.get('access-control-allow-origin'),null);
 assert.equal((await fetch(url+'/api/workspace',{headers:{Origin:'null'}})).status,403);
 // Invalid JSON bypasses the body parser on this public endpoint.
 assert.equal((await fetch(url+'/health',{method:'OPTIONS',headers:{Origin:'null','Content-Type':'application/json'},body:'{'})).status,204);
 connected=false;const down=await fetch(url+'/health');assert.equal(down.status,503);assert.equal((await down.json()).mongo,'disconnected');
});

test('native driver monitor tracks usable servers and topology closure',()=>{
 const client=new EventEmitter(),state=monitorMongo(client);
 assert.equal(state.isConnected(),false);state.markConnected();assert.equal(state.isConnected(),true);
 const update=type=>client.emit('topologyDescriptionChanged',{newDescription:{servers:new Map([['host',{type}]])}});
 update('Unknown');assert.equal(state.isConnected(),false);update('RSSecondary');assert.equal(state.isConnected(),true);
 client.emit('topologyClosed');assert.equal(state.isConnected(),false);
});

test('keepalive is disabled without Render URL; failures do not crash and cleanup stops it',async()=>{
 let callback,calls=0,cleared=false,warnings=0;
 const opts={publicUrl:'https://render.example/',fetchFn:async(url)=>{assert.equal(url,'https://render.example/health');calls++;throw Error('Offline');},setIntervalFn:(fn,ms)=>{assert.equal(ms,300000);callback=fn;return 42;},clearIntervalFn:id=>{assert.equal(id,42);cleared=true;},log:{log(){},warn(){warnings++;}}};
 startKeepAlive({...opts,publicUrl:''})();assert.equal(callback,undefined);
 const stop=startKeepAlive(opts);await callback();assert.equal(calls,1);assert.equal(warnings,1);await callback();assert.equal(calls,2);stop();assert(cleared);await callback();assert.equal(calls,2);
});
