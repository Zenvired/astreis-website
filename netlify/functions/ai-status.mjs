// Public setup diagnostic: reveals no credential values and makes no paid API call.
export default async function status(request) {
  if (request.method !== 'GET') return new Response(null, {status:405,headers:{Allow:'GET'}});
  return Response.json({service:'astreis-ai',configured:Boolean(process.env.GROQ_API_KEY?.trim()),signInRequired:true,voiceConfigured:['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET'].every(key=>Boolean(process.env[key]?.trim()))},{headers:{'Cache-Control':'no-store'}});
}
export const config = {path:'/api/ai/status'};
