import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

let embedder: FeatureExtractionPipeline | null = null;

export async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    console.log('🧠 Loading Xenova/all-MiniLM-L6-v2 (first run downloads ~80MB)...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true, // Más rápido, menos RAM
    });
    console.log('✅ Model loaded');
  }
  return embedder;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getEmbedder();
  
  // Truncar si es muy largo (límite del modelo ~512 tokens)
  const truncated = text.length > 2000 ? text.slice(0, 2000) : text;
  
  const output = await extractor(truncated, { 
    pooling: 'mean', 
    normalize: true 
  });
  
  return Array.from(output.data) as number[];
}
