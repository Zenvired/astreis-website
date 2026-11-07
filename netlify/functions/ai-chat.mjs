import { createChatHandler } from '../../server/ai.mjs';

export default createChatHandler();

// This is enforced by Netlify across instances, rather than a per-process counter.
export const config = {
  path: '/api/ai/chat',
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
