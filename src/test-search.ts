import { embed } from './embedder.js';
import { searchSimilar } from './db.js';

async function testSearch() {
  const query = "workflow execution engine";
  console.log(`\n🔍 Searching for: "${query}"\n`);
  
  const queryEmbedding = await embed(query);
  const results = searchSimilar(queryEmbedding, 5);
  
  if (results.length === 0) {
    console.log("No results found. Have you indexed a repository yet?");
    return;
  }
  
  console.log("🏆 Top 5 results:\n");
  results.forEach((r: any, i: number) => {
    console.log(`${i + 1}. [${r.distance.toFixed(4)}] ${r.type} ${r.name} in ${r.file_path}:${r.start_line}`);
  });
}

testSearch().catch(console.error);
