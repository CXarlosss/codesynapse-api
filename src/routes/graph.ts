import { FastifyInstance } from 'fastify';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;
import * as t from '@babel/types';
import * as fs from 'fs';
import * as path from 'path';
import { getDB } from '../db.js';

const REPO_PATH = process.env.INDEXED_REPO || './';

export default async function graphRoutes(fastify: FastifyInstance) {
  
  // --- Grafo de dependencias ---
  fastify.get('/graph', async (request, reply) => {
    const db = getDB();
    const files = db.prepare('SELECT DISTINCT file_path FROM chunks').all() as { file_path: string }[];
    
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeSet = new Set<string>();
    
    for (const { file_path } of files) {
      const absPath = path.resolve(REPO_PATH, file_path);
      if (!fs.existsSync(absPath)) continue;
      
      const content = fs.readFileSync(absPath, 'utf-8');
      const lines = content.split('\n').length;
      
      // Calcular complejidad
      const stats = calculateComplexity(content);
      
      nodes.push({
        id: file_path,
        name: path.basename(file_path),
        ...stats,
      });
      nodeSet.add(file_path);
      
      // Parsear imports
      try {
        const ast = parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
        
        traverse(ast, {
          ImportDeclaration(nodePath: any) {
            const source = nodePath.node.source.value;
            if (source.startsWith('.')) {
              const resolved = resolveImportPath(absPath, source);
              if (resolved) {
                const relativeResolved = path.relative(REPO_PATH, resolved).replace(/\\/g, '/');
                edges.push({
                  source: file_path,
                  target: relativeResolved,
                  value: 1,
                });
                if (!nodeSet.has(relativeResolved)) {
                  nodeSet.add(relativeResolved);
                  nodes.push({
                    id: relativeResolved,
                    name: path.basename(relativeResolved),
                    lines: 0, // Archivo no indexado pero referenciado
                    complexity: 0,
                    functions: 0,
                    classes: 0,
                    imports: 0,
                    exports: 0,
                  });
                }
              }
            }
          },
        });
      } catch {
        // Archivo no parseable, ignorar imports
      }
    }
    
    return { nodes, edges };
  });

  // --- Complejidad por archivo ---
  fastify.get('/complexity', async (request, reply) => {
    const db = getDB();
    const files = db.prepare('SELECT DISTINCT file_path FROM chunks').all() as { file_path: string }[];
    
    const result: Record<string, any> = {};
    
    for (const { file_path } of files) {
      const absPath = path.resolve(REPO_PATH, file_path);
      if (!fs.existsSync(absPath)) continue;
      
      const content = fs.readFileSync(absPath, 'utf-8');
      result[file_path] = calculateComplexity(content);
    }
    
    return result;
  });
}

// --- Helpers ---

function calculateComplexity(content: string) {
  const lines = content.split('\n').length;
  
  // Contar estructuras de control (simplificado pero efectivo)
  const controlPatterns = [
    /\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g,
    /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g,
    /\&\&/g, /\|\|/g, /\?.*:/g, // Ternary
  ];
  
  let complexity = 1; // Base
  controlPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  });
  
  // Contar funciones y clases
  let functions = 0;
  let classes = 0;
  let imports = 0;
  let exports = 0;
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    
    traverse(ast, {
      FunctionDeclaration() { functions++; },
      ArrowFunctionExpression() { functions++; },
      ClassDeclaration() { classes++; },
      ImportDeclaration() { imports++; },
      ExportNamedDeclaration() { exports++; },
      ExportDefaultDeclaration() { exports++; },
    });
  } catch {
    // Fallback por regex si el parser falla
    functions = (content.match(/\bfunction\b/g) || []).length;
    classes = (content.match(/\bclass\b/g) || []).length;
  }
  
  return { lines, complexity, functions, classes, imports, exports };
}

function resolveImportPath(fromFile: string, importPath: string): string | null {
  const dir = path.dirname(fromFile);
  let resolved = path.resolve(dir, importPath);
  
  // Intentar extensiones
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    const full = resolved + ext;
    if (fs.existsSync(full)) return full;
  }
  
  return null;
}
