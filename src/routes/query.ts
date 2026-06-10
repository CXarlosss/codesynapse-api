import { FastifyInstance, FastifyReply } from 'fastify';
import { embed } from '../embedder.js';
import { searchSimilar } from '../db.js';
import * as fs from 'fs';
import * as path from 'path';
import http from 'http';

const REPO_PATH = process.env.INDEXED_REPO || '../fluxforge';
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2'; // o 'codellama', 'mistral'

export default async function queryRoutes(fastify: FastifyInstance) {
  
  // --- Endpoint: Leer archivo seguro ---
  fastify.get('/file', async (request, reply) => {
    const { path: filePath } = request.query as { path: string };
    
    if (!filePath) return reply.status(400).send({ error: 'Path required' });
    
    // Sanitización anti path traversal
    const safePath = path.resolve(REPO_PATH, filePath);
    const resolvedRepo = path.resolve(REPO_PATH);
    
    if (!safePath.startsWith(resolvedRepo)) {
      return reply.status(403).send({ error: 'Access denied' });
    }
    
    try {
      const content = fs.readFileSync(safePath, 'utf-8');
      return { content, path: filePath };
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
  });

  // --- Endpoint: Chat con SSE Streaming ---
  fastify.get('/chat/stream', async (request, reply) => {
    const { question } = request.query as { question: string };
    
    if (!question) return reply.status(400).send({ error: 'Question required' });

    // 1. Embedding de la pregunta
    const questionEmbedding = await embed(question);
    
    // 2. Buscar chunks relevantes
    const chunks = searchSimilar(questionEmbedding, 5) as any[];
    
    // 3. Construir contexto
    const context = chunks.map((c, i) => 
      `[CHUNK ${i+1}: ${c.file_path} (${c.type} '${c.name}')]\n\`\`\`typescript\n${c.code.slice(0, 800)}\n\`\`\``
    ).join('\n\n');

    const fullPrompt = `Eres un asistente técnico experto en código. Basado ÚNICAMENTE en estos fragmentos de código:\n\n${context}\n\nResponde de forma concisa y técnica a esta pregunta: ${question}\n\nSi el código no tiene la respuesta, dilo claramente.`;

    // 4. Configurar SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // 5. Intentar Ollama
    const ollamaAvailable = await checkOllama();

    if (ollamaAvailable) {
      // MODO STREAMING CON OLLAMA
      const ollamaBody = JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: true,
        options: { temperature: 0.3, num_predict: 500 }
      });

      return new Promise((resolve) => {
        const req = http.request(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, async (res) => {
          if (res.statusCode !== 200) {
            // Si el modelo no existe o da error, fallback a offline
            await sendOfflineMode(reply, chunks, question);
            return resolve(reply);
          }

          let buffer = '';
          
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  reply.raw.write(`data: ${JSON.stringify({ token: data.response })}\n\n`);
                }
              } catch { /* ignore malformed */ }
            }
          });

          res.on('end', () => {
            // Enviar referencias al final
            reply.raw.write(`data: ${JSON.stringify({ references: chunks.map(c => ({
              path: c.file_path,
              name: c.name,
              type: c.type,
              line: c.start_line
            })) })}\n\n`);
            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
            resolve(reply);
          });
        });

        req.on('error', async () => {
          // Fallback si Ollama falla mid-stream
          await sendOfflineMode(reply, chunks, question);
          resolve(reply);
        });

        req.write(ollamaBody);
        req.end();
      });
      
    } else {
      // MODO OFFLINE INTELIGENTE
      await sendOfflineMode(reply, chunks, question);
      return reply;
    }
  });
}

// --- Helper: Modo Offline ---
function sendOfflineMode(reply: FastifyReply, chunks: any[], question: string): Promise<void> {
  return new Promise((resolve) => {
    const analysis = generateOfflineAnalysis(chunks, question);
    
    // Simular streaming enviando palabra por palabra
    const words = analysis.split(' ');
    let i = 0;
    
    const interval = setInterval(() => {
      if (i >= words.length) {
        clearInterval(interval);
        reply.raw.write(`data: ${JSON.stringify({ references: chunks.map(c => ({
          path: c.file_path,
          name: c.name,
          type: c.type,
          line: c.start_line
        })) })}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        resolve();
        return;
      }
      
      // Configurado a 5 palabras por batch para que no sea muy robótico
      const batch = words.slice(i, i + 5).join(' ') + ' ';
      console.log('Sending token batch:', batch);
      reply.raw.write(`data: ${JSON.stringify({ token: batch })}\n\n`);
      i += 5;
    }, 30); // 30ms por batch
  });
}

function generateOfflineAnalysis(chunks: any[], question: string): string {
  const intro = `Encontré ${chunks.length} referencias relevantes para "${question}":\n\n`;
  const details = chunks.map((c, i) => 
    `${i+1}. **${c.name}** (${c.type}) en \`${c.file_path}:${c.start_line}\`:\n> ${c.code.replace(/\n/g, ' ').slice(0, 150)}...`
  ).join('\n\n');
  
  const conclusion = `\n\nEstas piezas de código manejan la lógica relacionada con tu consulta. Revisa especialmente \`${chunks[0]?.file_path}\` donde se define la funcionalidad principal.`;
  
  return intro + details + conclusion;
}

// --- Helper: Check Ollama ---
function checkOllama(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}
