import { indexRepository } from './indexer.js';

async function main() {
  const repoPath = process.argv[2];

  if (!repoPath) {
    console.error('\n❌ Usage: npm run index <path-to-repo>\n');
    process.exit(1);
  }

  try {
    await indexRepository(repoPath);
  } catch (err) {
    console.error('\n❌ Indexing failed:', (err as Error).message);
    process.exit(1);
  }
}

main();
