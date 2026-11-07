import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionVerifier } from './auth.mjs';
import { createChatHandler } from './ai.mjs';

const token = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.signature';
const request = (credential = token) => new Request('https://astreis.example/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? {Authorization:'Bearer '+credential} : {}) }, body:'{}' });
test('missing, malformed and forged sessions never reach Groq', async () => {
  let calls = 0;
  const authenticate = createSessionVerifier({ fetchAuth: async () => new Response('{}', {status:401}) });
  const handler = createChatHandler({ authenticate, getKey:()=> 'server-key', fetchUpstream:async()=>{calls++;throw new Error('Unexpected paid call');} });
  for (const value of ['', 'forged-token', token]) assert.equal((await handler(request(value))).status, 401);
  assert.equal(calls,0);
});
test('verification uses the trusted project and never forwards the user token to Groq', async () => {
  const verifier = createSessionVerifier({ getConfig:()=>({url:'https://auth.example',key:'public-key'}), fetchAuth:async(url, options)=>{
    assert.equal(String(url),'https://auth.example/auth/v1/user');
    assert.equal(options.headers.Authorization,'Bearer '+token);
    assert.equal(options.headers.apikey,'public-key');
    return Response.json({id:'verified-user',is_anonymous:false});
  }});
  assert.equal(await verifier(request()),null);
});
test('anonymous users and an unreachable auth service fail closed', async () => {
  const anonymous = createSessionVerifier({fetchAuth:async()=>Response.json({id:'anonymous-user',is_anonymous:true})});
  assert.equal((await anonymous(request())).status,401);
  const offline = createSessionVerifier({fetchAuth:async()=>{throw new Error('sensitive trace');}});
  const failure=await offline(request());assert.equal(failure.status,503);assert.ok(!failure.message.includes('sensitive trace'));
});
test('a verified account reaches Groq using only the owner server credential', async () => {
  const authenticate=createSessionVerifier({fetchAuth:async()=>Response.json({id:'verified-user'})});
  const handler=createChatHandler({authenticate,getKey:()=> 'owner-server-key',fetchUpstream:async(_url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer owner-server-key');
    assert.ok(!options.body.includes(token));
    return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const response=await handler(new Request('https://astreis.example/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({messages:[{role:'system',content:'Astreis'},{role:'user',content:'Hello'}]})}));
  assert.equal(response.status,200);assert.equal(await response.text(),'data: [DONE]\n\n');
});
