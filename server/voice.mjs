import { createHmac, randomUUID } from 'node:crypto';
import { verifySession } from './auth.mjs';
export function createVoiceHandler({ authenticate = verifySession, getConfig = () => process.env } = {}) {
  return async request => {
    const fail = (status, code, message) => Response.json({error:{code,message}}, {status,headers:{'Cache-Control':'no-store'}});
    if (request.method !== 'POST') return new Response(null,{status:405,headers:{Allow:'POST'}});
    const denied = await authenticate(request);
    if (denied) return fail(denied.status,denied.code,denied.message);
    const env = getConfig();
    let url;
    try {
      url = new URL(env.LIVEKIT_URL);
      if (url.protocol === 'https:') url.protocol = 'wss:';
      if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash || !env.LIVEKIT_API_KEY?.trim() || !env.LIVEKIT_API_SECRET?.trim()) throw new Error();
    } catch { return fail(503,'not_configured','Realtime Voice is not connected yet.'); }
    const id = randomUUID().replaceAll('-','');
    const roomName = `astreis-voice-${id.slice(0,16)}`;
    const participantIdentity = `astreis-user-${id.slice(16)}`;
    const now = Math.floor(Date.now()/1000);
    const payload = {
      iss:env.LIVEKIT_API_KEY,sub:participantIdentity,nbf:now-5,exp:now+1200,
      video:{roomJoin:true,room:roomName,canPublish:true,canSubscribe:true,canPublishData:true,canPublishSources:['microphone']},
      roomConfig:{name:roomName,emptyTimeout:30,departureTimeout:20,maxParticipants:2,agents:[{agentName:'astreis-transcriber'}]},
    };
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({alg:'HS256',typ:'JWT'})}.${encode(payload)}`;
    const participantToken = `${body}.${createHmac('sha256',env.LIVEKIT_API_SECRET).update(body).digest('base64url')}`;
    return Response.json({serverUrl:url.href.replace(/\/$/,''),participantToken,roomName,participantIdentity},{headers:{'Cache-Control':'no-store'}});
  };
}
