import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

/**
 * AssetManager - Handles loading and caching of 3D assets and fonts
 * Extends EventTarget to provide event-driven asset loading
 */
export class AssetManager extends EventTarget {
  constructor() {
    super();
    
    // Initialize loaders
    this.gltfLoader = new GLTFLoader();
    this.fontLoader = new FontLoader();
    
    // Asset caches
    this.gltfCache = new Map();
    this.fontCache = new Map();
    
    // Loading state
    this.loadingAssets = new Set();
    this.loadedAssets = new Set();
  }

  /**
   * Load a GLTF model from the assets folder
   * @param {string} path - Path relative to /assets/ (e.g., 'models/scene.gltf')
   * @returns {Promise<THREE.Group>} Promise that resolves to the loaded GLTF scene
   */
  loadGLTF(path) {
    const fullPath = `/assets/${path}`;
    
    // Return cached asset if available
    if (this.gltfCache.has(fullPath)) {
      return Promise.resolve(this.gltfCache.get(fullPath));
    }
    
    // Return existing promise if already loading
    if (this.loadingAssets.has(fullPath)) {
      return new Promise((resolve, reject) => {
        const checkLoaded = () => {
          if (this.gltfCache.has(fullPath)) {
            resolve(this.gltfCache.get(fullPath));
          } else if (!this.loadingAssets.has(fullPath)) {
            reject(new Error(`Failed to load GLTF: ${path}`));
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }
    
    // Start loading
    this.loadingAssets.add(fullPath);
    
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        fullPath,
        (gltf) => {
          // Cache the loaded asset
          this.gltfCache.set(fullPath, gltf);
          this.loadingAssets.delete(fullPath);
          this.loadedAssets.add(fullPath);
          
          // Fire asset loaded event
          this.dispatchEvent(new CustomEvent('asset:loaded', {
            detail: { type: 'gltf', path: fullPath, asset: gltf }
          }));
          
          resolve(gltf);
        },
        (progress) => {
          // Optional: Fire progress event
          this.dispatchEvent(new CustomEvent('asset:progress', {
            detail: { type: 'gltf', path: fullPath, progress }
          }));
        },
        (error) => {
          this.loadingAssets.delete(fullPath);
          reject(new Error(`Failed to load GLTF ${path}: ${error.message}`));
        }
      );
    });
  }

  /**
   * Load a font from the assets folder
   * @param {string} path - Path relative to /assets/ (e.g., 'fonts/helvetiker.json')
   * @returns {Promise<Object>} Promise that resolves to the loaded font data
   */
  loadFont(path) {
    const fullPath = `/assets/${path}`;
    
    // Return cached asset if available
    if (this.fontCache.has(fullPath)) {
      return Promise.resolve(this.fontCache.get(fullPath));
    }
    
    // Return existing promise if already loading
    if (this.loadingAssets.has(fullPath)) {
      return new Promise((resolve, reject) => {
        const checkLoaded = () => {
          if (this.fontCache.has(fullPath)) {
            resolve(this.fontCache.get(fullPath));
          } else if (!this.loadingAssets.has(fullPath)) {
            reject(new Error(`Failed to load font: ${path}`));
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }
    
    // Start loading
    this.loadingAssets.add(fullPath);
    
    return new Promise((resolve, reject) => {
      this.fontLoader.load(
        fullPath,
        (font) => {
          // Cache the loaded asset
          this.fontCache.set(fullPath, font);
          this.loadingAssets.delete(fullPath);
          this.loadedAssets.add(fullPath);
          
          // Fire asset loaded event
          this.dispatchEvent(new CustomEvent('asset:loaded', {
            detail: { type: 'font', path: fullPath, asset: font }
          }));
          
          resolve(font);
        },
        (progress) => {
          // Optional: Fire progress event
          this.dispatchEvent(new CustomEvent('asset:progress', {
            detail: { type: 'font', path: fullPath, progress }
          }));
        },
        (error) => {
          this.loadingAssets.delete(fullPath);
          reject(new Error(`Failed to load font ${path}: ${error.message}`));
        }
      );
    });
  }

  /**
   * Load multiple assets and wait for all to complete
   * @param {Array} assets - Array of asset objects with type and path
   * @returns {Promise<Object>} Promise that resolves when all assets are loaded
   */
  async loadAll(assets) {
    const loadPromises = assets.map(asset => {
      switch (asset.type) {
        case 'gltf':
          return this.loadGLTF(asset.path);
        case 'font':
          return this.loadFont(asset.path);
        default:
          throw new Error(`Unknown asset type: ${asset.type}`);
      }
    });
    
    try {
      await Promise.all(loadPromises);
      
      // Fire assets ready event
      this.dispatchEvent(new CustomEvent('assets:ready', {
        detail: { assets: this.loadedAssets }
      }));
      
      return {
        success: true,
        loadedCount: this.loadedAssets.size,
        assets: Array.from(this.loadedAssets)
      };
    } catch (error) {
      throw new Error(`Failed to load assets: ${error.message}`);
    }
  }

  /**
   * Get a cached GLTF asset
   * @param {string} path - Asset path
   * @returns {THREE.Group|null} Cached asset or null if not found
   */
  getGLTF(path) {
    const fullPath = `/assets/${path}`;
    return this.gltfCache.get(fullPath) || null;
  }

  /**
   * Get a cached font asset
   * @param {string} path - Asset path
   * @returns {Object|null} Cached asset or null if not found
   */
  getFont(path) {
    const fullPath = `/assets/${path}`;
    return this.fontCache.get(fullPath) || null;
  }

  /**
   * Check if an asset is currently loading
   * @param {string} path - Asset path
   * @returns {boolean} True if asset is loading
   */
  isLoading(path) {
    const fullPath = `/assets/${path}`;
    return this.loadingAssets.has(fullPath);
  }

  /**
   * Check if an asset is loaded
   * @param {string} path - Asset path
   * @returns {boolean} True if asset is loaded
   */
  isLoaded(path) {
    const fullPath = `/assets/${path}`;
    return this.loadedAssets.has(fullPath);
  }

  /**
   * Clear all cached assets
   */
  clearCache() {
    this.gltfCache.clear();
    this.fontCache.clear();
    this.loadedAssets.clear();
  }

  /**
   * Get loading statistics
   * @returns {Object} Statistics about loading state
   */
  getStats() {
    return {
      loading: this.loadingAssets.size,
      loaded: this.loadedAssets.size,
      gltfCached: this.gltfCache.size,
      fontCached: this.fontCache.size
    };
  }
}

// Export singleton instance
export const assetManager = new AssetManager(); 