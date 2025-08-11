import * as THREE from 'three';

/**
 * MemoryManager - Centralizes GPU resource cleanup for Three.js objects
 * Provides tracking, disposal, and reference counting to prevent memory leaks
 */
class MemoryManager {
  constructor() {
    /** @type {Map<Object, {label: string, refCount: number}>} */
    this.trackedObjects = new Map();
  }

  /**
   * Track an object for later cleanup
   * @param {THREE.Object3D|THREE.Geometry|THREE.Material|THREE.Texture} obj - Object to track
   * @param {string} [label] - Optional label for debugging
   */
  track(obj, label = 'unnamed') {
    if (!obj) return;
    
    if (this.trackedObjects.has(obj)) {
      // Increment reference count if already tracked
      const entry = this.trackedObjects.get(obj);
      entry.refCount++;
    } else {
      // Add new tracked object
      this.trackedObjects.set(obj, { label, refCount: 1 });
    }
  }

  /**
   * Retain an object (increment reference count)
   * @param {THREE.Object3D|THREE.Geometry|THREE.Material|THREE.Texture} obj - Object to retain
   */
  retain(obj) {
    if (!obj || !this.trackedObjects.has(obj)) return;
    
    const entry = this.trackedObjects.get(obj);
    entry.refCount++;
  }

  /**
   * Release an object (decrement reference count, dispose if count reaches 0)
   * @param {THREE.Object3D|THREE.Geometry|THREE.Material|THREE.Texture} obj - Object to release
   */
  release(obj) {
    if (!obj || !this.trackedObjects.has(obj)) return;
    
    const entry = this.trackedObjects.get(obj);
    entry.refCount--;
    
    if (entry.refCount <= 0) {
      this.dispose(obj);
    }
  }

  /**
   * Dispose a single object and remove it from tracking
   * @param {THREE.Object3D|THREE.Geometry|THREE.Material|THREE.Texture} obj - Object to dispose
   */
  dispose(obj) {
    if (!obj) return;
    
    // Remove from tracking first to prevent double-dispose
    this.trackedObjects.delete(obj);
    
    this._disposeObject(obj);
  }

  /**
   * Dispose all tracked objects
   */
  disposeAll() {
    const objects = Array.from(this.trackedObjects.keys());
    this.trackedObjects.clear();
    
    objects.forEach(obj => {
      this._disposeObject(obj);
    });
  }

  /**
   * Dispose an object and remove it from its parent
   * @param {THREE.Object3D} object3D - Object to dispose and remove
   */
  disposeAndRemoveFromParent(object3D) {
    if (!object3D) return;
    
    // Remove from parent first
    if (object3D.parent) {
      object3D.parent.remove(object3D);
    }
    
    // Then dispose
    this.dispose(object3D);
  }

  /**
   * Internal method to dispose an object and its resources
   * @param {THREE.Object3D|THREE.Geometry|THREE.Material|THREE.Texture} obj - Object to dispose
   * @private
   */
  _disposeObject(obj) {
    if (!obj) return;

    // Handle Object3D (Mesh, Line, Points, Group, etc.)
    if (obj instanceof THREE.Object3D) {
      this._disposeObject3D(obj);
    }
    // Handle Geometry
    else if (obj instanceof THREE.BufferGeometry || obj instanceof THREE.Geometry) {
      if (obj.dispose) {
        obj.dispose();
      }
    }
    // Handle Material
    else if (obj instanceof THREE.Material) {
      this._disposeMaterial(obj);
    }
    // Handle Texture
    else if (obj instanceof THREE.Texture) {
      if (obj.dispose) {
        obj.dispose();
      }
    }
  }

  /**
   * Dispose an Object3D and all its children
   * @param {THREE.Object3D} object3D - Object3D to dispose
   * @private
   */
  _disposeObject3D(object3D) {
    if (!object3D) return;

    // Dispose all children first
    const children = [...object3D.children];
    children.forEach(child => {
      this._disposeObject3D(child);
    });

    // Handle specific object types
    if (object3D instanceof THREE.Mesh || 
        object3D instanceof THREE.Line || 
        object3D instanceof THREE.Points) {
      
      // Dispose geometry
      if (object3D.geometry) {
        this._disposeObject(object3D.geometry);
      }
      
      // Dispose material(s)
      if (object3D.material) {
        this._disposeObject(object3D.material);
      }
    }
  }

  /**
   * Dispose a material and its textures
   * @param {THREE.Material} material - Material to dispose
   * @private
   */
  _disposeMaterial(material) {
    if (!material) return;

    // Handle material arrays
    if (Array.isArray(material)) {
      material.forEach(mat => this._disposeMaterial(mat));
      return;
    }

    // Dispose textures found on the material
    for (const key in material) {
      const value = material[key];
      if (value instanceof THREE.Texture) {
        this._disposeObject(value);
      }
    }

    // Dispose the material itself
    if (material.dispose) {
      material.dispose();
    }
  }

  /**
   * Get the number of tracked objects
   * @returns {number} Number of tracked objects
   */
  getTrackedCount() {
    return this.trackedObjects.size;
  }

  /**
   * Get debug information about tracked objects
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    const info = {
      totalTracked: this.trackedObjects.size,
      objects: []
    };

    this.trackedObjects.forEach((entry, obj) => {
      info.objects.push({
        label: entry.label,
        refCount: entry.refCount,
        type: obj.constructor.name
      });
    });

    return info;
  }
}

// Export singleton instance
export const mem = new MemoryManager(); 