import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { CodeChunk } from './parser.js';

const DB_PATH = process.env.CODESYNAPSE_DB || './codesynapse.db';

let db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    sqliteVec.load(db);
    
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING vec0(
        embedding float[384],
        +file_path TEXT,
        +code TEXT,
        +type TEXT,
        +name TEXT,
        +start_line INTEGER
      );
    `);
    
    // Tabla de metadatos para búsquedas textuales rápidas
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_meta (
        id INTEGER PRIMARY KEY,
        chunk_id TEXT UNIQUE,
        file_path TEXT,
        name TEXT,
        type TEXT
      );
    `);
  }
  return db;
}

export function insertChunk(chunk: CodeChunk, embedding: number[]) {
  const db = getDB();
  
  const stmt = db.prepare(`
    INSERT INTO chunks (embedding, file_path, code, type, name, start_line)
    VALUES (vec_f32(?), ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    JSON.stringify(embedding),
    chunk.filePath,
    chunk.code,
    chunk.type,
    chunk.name,
    BigInt(Math.floor(chunk.startLine))
  );
}

export function searchSimilar(queryEmbedding: number[], limit = 5) {
  const db = getDB();
  
  const stmt = db.prepare(`
    SELECT 
      file_path,
      code,
      type,
      name,
      start_line,
      distance
    FROM chunks
    WHERE embedding MATCH vec_f32(?)
    ORDER BY distance
    LIMIT ?
  `);
  
  return stmt.all(JSON.stringify(queryEmbedding), limit);
}

export function getStats() {
  const db = getDB();
  const result = db.prepare('SELECT COUNT(*) as total FROM chunks').get() as { total: number };
  return result;
}
