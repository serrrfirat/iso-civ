// Web Worker for game save/load operations
// Handles expensive JSON serialization and LZ-string compression off the main thread
// This file is bundled separately by Next.js/Webpack

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

export type SaveWorkerMessage = 
  | { type: 'serialize-compress'; id: number; state: unknown }
  | { type: 'decompress-parse'; id: number; compressed: string };

export type SaveWorkerResponse = 
  | { type: 'serialized-compressed'; id: number; compressed: string; error?: string }
  | { type: 'decompressed-parsed'; id: number; state: unknown; error?: string };

// Worker message handler
self.onmessage = (event: MessageEvent<SaveWorkerMessage>) => {
  const { type, id } = event.data;
  
  // Serialize game state to JSON and compress
  if (type === 'serialize-compress') {
    try {
      const { state } = event.data as { type: 'serialize-compress'; id: number; state: unknown };
      // Both operations happen in the worker - no main thread blocking!
      const serialized = JSON.stringify(state);
      const compressed = compressToUTF16(serialized);
      
      self.postMessage({
        type: 'serialized-compressed',
        id,
        compressed,
      });
    } catch (error) {
      self.postMessage({
        type: 'serialized-compressed',
        id,
        compressed: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // Decompress and parse JSON back to game state
  if (type === 'decompress-parse') {
    try {
      const { compressed } = event.data as { type: 'decompress-parse'; id: number; compressed: string };
      
      // Try to decompress (might be legacy uncompressed format)
      let jsonString = decompressFromUTF16(compressed);
      if (!jsonString || !jsonString.startsWith('{')) {
        // Legacy format - already JSON
        if (compressed.startsWith('{')) {
          jsonString = compressed;
        } else {
          throw new Error('Invalid compressed data');
        }
      }
      
      const state = JSON.parse(jsonString);
      
      self.postMessage({
        type: 'decompressed-parsed',
        id,
        state,
      });
    } catch (error) {
      self.postMessage({
        type: 'decompressed-parsed',
        id,
        state: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};
