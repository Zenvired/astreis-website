import { createVoiceHandler } from '../../server/voice.mjs';
export default createVoiceHandler();
export const config = {path:'/api/voice/session',rateLimit:{windowLimit:8,windowSize:60,aggregateBy:['ip','domain']}};
