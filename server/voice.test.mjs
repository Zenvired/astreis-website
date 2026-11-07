import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createVoiceHandler} from './voice.mjs';
const request=()=>new Request('https://astreis.example/api/voice/session',{method:'POST'});
test('unsigned voice requests fail before accessing owner credentials',async()=>{
 let read=false;
 const handler=createVoiceHandler({authenticate:async()=>({status:401,code:'authentication',message:'Sign in'}),getConfig:()=>{read=true;return {}}});
 assert.equal((await handler(request())).status,401);assert.equal(read,false);
});
test('voice tokens are signed, room-scoped, short-lived and dispatch the transcriber',async()=>{
 const secret='test-secret-with-at-least-thirty-two-characters';
 const handler=createVoiceHandler({authenticate:async()=>null,getConfig:()=>({LIVEKIT_URL:'https://example.livekit.cloud',LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:secret})});
 const response=await handler(request());assert.equal(response.status,200);
 const session=await response.json();const [h,p,s]=session.participantToken.split('.');
 assert.equal(s,createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url'));
 const claims=JSON.parse(Buffer.from(p,'base64url'));
 assert.equal(claims.video.room,session.roomName);assert.equal(claims.sub,session.participantIdentity);
 assert.equal(claims.roomConfig.agents[0].agentName,'astreis-transcriber');
 assert.equal(claims.exp-claims.nbf,1205);assert.deepEqual(claims.video.canPublishSources,['microphone']);
 assert.equal(session.serverUrl,'wss://example.livekit.cloud');assert.ok(!JSON.stringify(session).includes(secret));
 assert.notEqual((await (await handler(request())).json()).roomName,session.roomName);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('missing configuration fails safely',async()=>{
 const response=await createVoiceHandler({authenticate:async()=>null,getConfig:()=>({})})(request());
 assert.equal(response.status,503);
});
