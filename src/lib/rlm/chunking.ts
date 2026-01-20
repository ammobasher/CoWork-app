/**
 * Chunking Utilities for RLM
 *
 * Split large data into manageable chunks for recursive processing
 */

import { ChunkingStrategy } from './types';

export class DataChunker {
  /**
   * Chunk data according to strategy
   */
  static chunk(data: string | any[], strategy: ChunkingStrategy): any[] {
    if (Array.isArray(data)) {
      return this.chunkArray(data, strategy);
    }

    if (typeof data === 'string') {
      return this.chunkString(data, strategy);
    }

    throw new Error('Unsupported data type for chunking');
  }

  /**
   * Chunk string data
   */
  private static chunkString(data: string, strategy: ChunkingStrategy): string[] {
    switch (strategy.method) {
      case 'fixed-size':
        return this.fixedSizeChunking(data, strategy.chunkSize || 1000, strategy.overlap || 0);

      case 'semantic':
        return this.semanticChunking(data, strategy.chunkSize || 1000);

      case 'structural':
        return this.structuralChunking(data, strategy.separator || '\n\n');

      case 'custom':
        if (!strategy.customChunker) {
          throw new Error('Custom chunker function required');
        }
        return strategy.customChunker(data);

      default:
        return this.fixedSizeChunking(data, 1000, 0);
    }
  }

  /**
   * Chunk array data
   */
  private static chunkArray(data: any[], strategy: ChunkingStrategy): any[][] {
    const chunkSize = strategy.chunkSize || 10;
    const chunks: any[][] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Fixed-size chunking with optional overlap
   */
  private static fixedSizeChunking(
    text: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;

      if (start >= text.length - overlap) break;
    }

    return chunks;
  }

  /**
   * Semantic chunking - try to break at sentence boundaries
   */
  private static semanticChunking(text: string, targetSize: number): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > targetSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Structural chunking - split by separator (paragraphs, sections, etc.)
   */
  private static structuralChunking(text: string, separator: string): string[] {
    return text
      .split(separator)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);
  }

  /**
   * Smart chunking for code files - try to preserve function boundaries
   */
  static chunkCode(code: string, language: string, maxSize: number = 2000): string[] {
    const chunks: string[] = [];

    // For now, use semantic chunking
    // TODO: Implement language-specific AST-based chunking
    const lines = code.split('\n');
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (const line of lines) {
      const lineSize = line.length + 1; // +1 for newline

      if (currentSize + lineSize > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [line];
        currentSize = lineSize;
      } else {
        currentChunk.push(line);
        currentSize += lineSize;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * Chunk multiple files into a manageable structure
   */
  static chunkFiles(
    files: Record<string, string>,
    maxChunkSize: number = 2000
  ): Record<string, string[]> {
    const chunkedFiles: Record<string, string[]> = {};

    for (const [path, content] of Object.entries(files)) {
      const ext = path.split('.').pop() || '';
      const isCode = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs'].includes(ext);

      if (isCode) {
        chunkedFiles[path] = this.chunkCode(content, ext, maxChunkSize);
      } else {
        chunkedFiles[path] = this.semanticChunking(content, maxChunkSize);
      }
    }

    return chunkedFiles;
  }
}
