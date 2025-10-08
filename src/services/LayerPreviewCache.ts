/**
 * Layer Preview Cache Service
 * Manages caching of layer preview images using IndexedDB for performance optimization
 */

const DB_NAME = 'LayerPreviewCache';
const STORE_NAME = 'previews';
const DB_VERSION = 1;
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface CachedPreview {
  url: string;
  blob: Blob;
  timestamp: number;
}

class LayerPreviewCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get cached preview image
   */
  async get(url: string): Promise<string | null> {
    try {
      await this.init();

      if (!this.db) return null;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(url);

        request.onsuccess = () => {
          const cached: CachedPreview | undefined = request.result;

          if (!cached) {
            resolve(null);
            return;
          }

          // Check if cache is expired
          const now = Date.now();
          if (now - cached.timestamp > CACHE_DURATION) {
            // Cache expired, delete it
            this.delete(url);
            resolve(null);
            return;
          }

          // Convert blob to object URL
          const objectUrl = URL.createObjectURL(cached.blob);
          resolve(objectUrl);
        };

        request.onerror = () => {
          console.error('Failed to get cached preview:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Error getting cached preview:', error);
      return null;
    }
  }

  /**
   * Cache preview image
   */
  async set(url: string, blob: Blob): Promise<void> {
    try {
      await this.init();

      if (!this.db) return;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const cached: CachedPreview = {
          url,
          blob,
          timestamp: Date.now()
        };

        const request = store.put(cached);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Failed to cache preview:', request.error);
          resolve(); // Don't reject, just log the error
        };
      });
    } catch (error) {
      console.error('Error caching preview:', error);
    }
  }

  /**
   * Delete cached preview
   */
  async delete(url: string): Promise<void> {
    try {
      await this.init();

      if (!this.db) return;

      return new Promise((resolve) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(url);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Failed to delete cached preview:', request.error);
          resolve();
        };
      });
    } catch (error) {
      console.error('Error deleting cached preview:', error);
    }
  }

  /**
   * Clear all cached previews
   */
  async clear(): Promise<void> {
    try {
      await this.init();

      if (!this.db) return;

      return new Promise((resolve) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Failed to clear cache:', request.error);
          resolve();
        };
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Fetch and cache preview image
   */
  async fetchAndCache(url: string): Promise<string | null> {
    try {
      // Check cache first
      const cachedUrl = await this.get(url);
      if (cachedUrl) {
        return cachedUrl;
      }

      // Fetch from network
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch preview: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Cache the blob
      await this.set(url, blob);

      // Return object URL
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error fetching and caching preview:', error);
      return null;
    }
  }
}

export const layerPreviewCache = new LayerPreviewCacheService();
