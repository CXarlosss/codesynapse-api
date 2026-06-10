import Fastify from 'fastify';
import cors from '@fastify/cors';
import queryRoutes from './routes/query.js';
import graphRoutes from './routes/graph.js';

const fastify = Fastify({ logger: true });

async function start() {
  await fastify.register(cors, {
    origin: '*',
  });

  await fastify.register(queryRoutes, { prefix: '/api' });
  await fastify.register(graphRoutes, { prefix: '/api' });

  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 CodeSynapse API running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
