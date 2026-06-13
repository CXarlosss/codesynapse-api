import Fastify from 'fastify';
import cors from '@fastify/cors';
import queryRoutes from './routes/query.js';
import graphRoutes from './routes/graph.js';
import fs from 'fs';
import path from 'path';
import { indexRepository } from './indexer.js';
import { getDB } from './db.js';

const DB_PATH = process.env.CODESYNAPSE_DB || './codesynapse.db';
const DEFAULT_REPO = process.env.DEFAULT_REPO || 'https://github.com/CarlosDePetronila/fluxforge';

const fastify = Fastify({ logger: true });

async function bootstrap() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('⚠️  DB not found (Render cold start or fresh deploy). Re-indexing default repository...');
    
    try {
      if (DEFAULT_REPO.startsWith('http')) {
        const { execSync } = await import('child_process');
        const tmpDir = path.join('/tmp', 'default-repo');
        
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true });
        }
        
        execSync(`git clone --depth 1 ${DEFAULT_REPO} ${tmpDir}`, { stdio: 'inherit' });
        await indexRepository(tmpDir);
        fs.rmSync(tmpDir, { recursive: true });
      } else {
        await indexRepository(DEFAULT_REPO);
      }
      
      console.log('✅ Default repository indexed successfully');
    } catch (err) {
      console.error('❌ Failed to index default repository:', err);
    }
  }
  
  getDB();
}

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

bootstrap().then(() => {
  start();
});
