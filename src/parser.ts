import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = typeof _traverse === 'function' ? _traverse : _traverse.default;
import * as t from '@babel/types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface CodeChunk {
  id: string;
  filePath: string;
  code: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'export' | 'file';
  name: string;
}

export async function parseRepository(repoPath: string): Promise<CodeChunk[]> {
  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    cwd: repoPath,
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'build/**', 'coverage/**'],
    absolute: true,
  });

  const chunks: CodeChunk[] = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Chunk de contexto del archivo (top-level)
    if (lines.length > 5) {
      chunks.push({
        id: `${path.relative(repoPath, filePath)}:top`,
        filePath: path.relative(repoPath, filePath),
        code: lines.slice(0, Math.min(50, lines.length)).join('\n'),
        startLine: 1,
        endLine: Math.min(50, lines.length),
        type: 'file',
        name: path.basename(filePath),
      });
    }

    // Si el archivo es muy grande, chunking por bloques
    if (lines.length > 500) {
      const blockSize = 100;
      const overlap = 20;
      for (let i = 50; i < lines.length; i += blockSize - overlap) {
        const end = Math.min(i + blockSize, lines.length);
        chunks.push({
          id: `${path.relative(repoPath, filePath)}:block:${i}`,
          filePath: path.relative(repoPath, filePath),
          code: lines.slice(i, end).join('\n'),
          startLine: i + 1,
          endLine: end,
          type: 'file',
          name: `${path.basename(filePath)}:${i}`,
        });
      }
    }

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        tokens: true,
      });

      traverse(ast, {
        FunctionDeclaration(nodePath) {
          const node = nodePath.node;
          if (node.id?.name) {
            chunks.push(createChunk(repoPath, filePath, content, node, node.id.name, 'function'));
          }
        },
        ClassDeclaration(nodePath) {
          const node = nodePath.node;
          if (node.id?.name) {
            chunks.push(createChunk(repoPath, filePath, content, node, node.id.name, 'class'));
          }
        },
        ArrowFunctionExpression(nodePath) {
          const parent = nodePath.parent;
          if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
            const loc = nodePath.node.loc!;
            chunks.push({
              id: `${path.relative(repoPath, filePath)}:${parent.id.name}`,
              filePath: path.relative(repoPath, filePath),
              code: content.slice(parent.start!, parent.end!),
              startLine: loc.start.line,
              endLine: loc.end.line,
              type: 'function',
              name: parent.id.name,
            });
          }
        },
        ExportNamedDeclaration(nodePath) {
          const node = nodePath.node;
          if (node.declaration && 'id' in node.declaration && t.isIdentifier(node.declaration.id)) {
            const name = node.declaration.id.name;
            chunks.push(createChunk(repoPath, filePath, content, node.declaration as any, name, 'export'));
          }
        },
      });
    } catch (err) {
      console.warn(`⚠️  Parse error in ${path.relative(repoPath, filePath)}: ${(err as Error).message}`);
    }
  }

  return chunks;
}

function createChunk(repoPath: string, filePath: string, content: string, node: any, name: string, type: CodeChunk['type']): CodeChunk {
  const loc = node.loc!;
  return {
    id: `${path.relative(repoPath, filePath)}:${name}`,
    filePath: path.relative(repoPath, filePath),
    code: content.slice(node.start!, node.end!),
    startLine: loc.start.line,
    endLine: loc.end.line,
    type,
    name,
  };
}
