import { parseRepository, CodeChunk } from './parser.js';
import { embed } from './embedder.js';
import { insertChunk, getStats } from './db.js';

export async function indexRepository(repoPath: string) {
  console.log(`\n🔍 Scanning: ${repoPath}\n`);
  
  const chunks = await parseRepository(repoPath);
  console.log(`📦 Found ${chunks.length} code chunks\n`);
  
  if (chunks.length === 0) {
    console.log('⚠️  No chunks found. Is this a valid code repository?');
    return;
  }

  console.log('🧠 Generating embeddings...\n');
  const startTime = Date.now();
  let processed = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await embed(chunk.code);
      insertChunk(chunk, embedding);
      processed++;
      
      if (processed % 10 === 0 || processed === chunks.length) {
        process.stdout.write(`\r   Progress: ${processed}/${chunks.length} chunks (${((processed/chunks.length)*100).toFixed(0)}%)`);
      }
    } catch (err) {
      console.warn(`\n⚠️  Failed to embed ${chunk.id}: ${(err as Error).message}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = getStats();
  
  console.log(`\n\n✅ Indexed ${stats.total} chunks in ${duration}s`);
  console.log(`   Database: ${process.env.CODESYNAPSE_DB || './codesynapse.db'}\n`);
}
