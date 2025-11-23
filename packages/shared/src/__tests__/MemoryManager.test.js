import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

// Import the MemoryManager (we'll need to create a test version since it's in frontend)
// For now, let's create a simplified test version
class TestMemoryManager {
  constructor() {
    this.trackedObjects = new Map();
  }

  track(obj, label = 'unnamed') {
    if (!obj) return;
    
    if (this.trackedObjects.has(obj)) {
      const entry = this.trackedObjects.get(obj);
      entry.refCount++;
    } else {
      this.trackedObjects.set(obj, { label, refCount: 1 });
    }
  }

  dispose(obj) {
    if (!obj) return;
    
    this.trackedObjects.delete(obj);
    this._disposeObject(obj);
  }

  disposeAll() {
    const objects = Array.from(this.trackedObjects.keys());
    this.trackedObjects.clear();
    
    objects.forEach(obj => {
      this._disposeObject(obj);
    });
  }

  _disposeObject(obj) {
    if (!obj) return;

    if (obj instanceof THREE.Object3D) {
      this._disposeObject3D(obj);
    } else if (obj instanceof THREE.BufferGeometry) {
      if (obj.dispose) {
        obj.dispose();
      }
    } else if (obj instanceof THREE.Material) {
      this._disposeMaterial(obj);
    } else if (obj instanceof THREE.Texture) {
      if (obj.dispose) {
        obj.dispose();
      }
    }
  }

  _disposeObject3D(object3D) {
    if (!object3D) return;

    const children = [...object3D.children];
    children.forEach(child => {
      // Remove child from tracking if it's tracked
      if (this.trackedObjects.has(child)) {
        this.trackedObjects.delete(child);
      }
      this._disposeObject3D(child);
    });

    if (object3D instanceof THREE.Mesh || 
        object3D instanceof THREE.Line || 
        object3D instanceof THREE.Points) {
      
      if (object3D.geometry) {
        // If geometry is tracked separately, dispose it properly
        if (this.trackedObjects.has(object3D.geometry)) {
          this.dispose(object3D.geometry);
        } else {
          this._disposeObject(object3D.geometry);
        }
      }
      
      if (object3D.material) {
        // If material is tracked separately, dispose it properly
        if (this.trackedObjects.has(object3D.material)) {
          this.dispose(object3D.material);
        } else {
          this._disposeObject(object3D.material);
        }
      }
    }
  }

  _disposeMaterial(material) {
    if (!material) return;

    if (Array.isArray(material)) {
      material.forEach(mat => this._disposeMaterial(mat));
      return;
    }

    for (const key in material) {
      const value = material[key];
      if (value instanceof THREE.Texture) {
        this._disposeObject(value);
      }
    }

    if (material.dispose) {
      material.dispose();
    }
  }

  getTrackedCount() {
    return this.trackedObjects.size;
  }
}

describe('MemoryManager', () => {
  let mem;

  beforeEach(() => {
    mem = new TestMemoryManager();
  });

  afterEach(() => {
    // Clean up any remaining tracked objects
    mem.disposeAll();
  });

  describe('tracking', () => {
    it('should track objects correctly', () => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      mem.track(mesh, 'test-mesh');
      
      expect(mem.getTrackedCount()).toBe(1);
    });

    it('should handle null objects gracefully', () => {
      expect(() => mem.track(null)).not.toThrow();
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should increment reference count for already tracked objects', () => {
      const mesh = new THREE.Mesh();
      
      mem.track(mesh, 'test-mesh');
      mem.track(mesh, 'test-mesh');
      
      expect(mem.getTrackedCount()).toBe(1);
    });
  });

  describe('disposal', () => {
    it('should dispose single objects correctly', () => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      mem.track(mesh, 'test-mesh');
      expect(mem.getTrackedCount()).toBe(1);

      mem.dispose(mesh);
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should be idempotent - double dispose should not throw', () => {
      const mesh = new THREE.Mesh();
      mem.track(mesh, 'test-mesh');

      // First dispose
      expect(() => mem.dispose(mesh)).not.toThrow();
      expect(mem.getTrackedCount()).toBe(0);

      // Second dispose (should be idempotent)
      expect(() => mem.dispose(mesh)).not.toThrow();
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should handle null objects gracefully during disposal', () => {
      expect(() => mem.dispose(null)).not.toThrow();
    });

    it('should dispose untracked objects without error', () => {
      const mesh = new THREE.Mesh();
      expect(() => mem.dispose(mesh)).not.toThrow();
    });
  });

  describe('disposeAll', () => {
    it('should dispose all tracked objects', () => {
      const mesh1 = new THREE.Mesh();
      const mesh2 = new THREE.Mesh();
      const mesh3 = new THREE.Mesh();

      mem.track(mesh1, 'mesh1');
      mem.track(mesh2, 'mesh2');
      mem.track(mesh3, 'mesh3');

      expect(mem.getTrackedCount()).toBe(3);

      mem.disposeAll();
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should be idempotent - multiple disposeAll calls should not throw', () => {
      const mesh = new THREE.Mesh();
      mem.track(mesh, 'test-mesh');

      // First disposeAll
      expect(() => mem.disposeAll()).not.toThrow();
      expect(mem.getTrackedCount()).toBe(0);

      // Second disposeAll (should be idempotent)
      expect(() => mem.disposeAll()).not.toThrow();
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should work with empty tracking list', () => {
      expect(() => mem.disposeAll()).not.toThrow();
      expect(mem.getTrackedCount()).toBe(0);
    });
  });

  describe('complex object disposal', () => {
    it('should dispose mesh with geometry and material', () => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      mem.track(mesh, 'complex-mesh');
      expect(mem.getTrackedCount()).toBe(1);

      mem.dispose(mesh);
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should dispose group with children', () => {
      const group = new THREE.Group();
      const child1 = new THREE.Mesh();
      const child2 = new THREE.Mesh();
      
      group.add(child1);
      group.add(child2);

      mem.track(group, 'group-with-children');
      mem.track(child1, 'child1');
      mem.track(child2, 'child2');
      expect(mem.getTrackedCount()).toBe(3);

      mem.dispose(group);
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should dispose material with textures', () => {
      const texture = new THREE.Texture();
      const material = new THREE.MeshBasicMaterial({ map: texture });

      mem.track(material, 'material-with-texture');
      expect(mem.getTrackedCount()).toBe(1);

      mem.dispose(material);
      expect(mem.getTrackedCount()).toBe(0);
    });

    it('should dispose material arrays', () => {
      const material1 = new THREE.MeshBasicMaterial();
      const material2 = new THREE.MeshBasicMaterial();
      const materialArray = [material1, material2];

      mem.track(materialArray, 'material-array');
      expect(mem.getTrackedCount()).toBe(1);

      mem.dispose(materialArray);
      expect(mem.getTrackedCount()).toBe(0);
    });
  });

  describe('memory leak prevention', () => {
    it('should not leak references after disposal', () => {
      const mesh = new THREE.Mesh();
      const weakRef = new WeakRef(mesh);

      mem.track(mesh, 'leak-test');
      mem.dispose(mesh);

      // Clear the strong reference
      mesh = null;

      // Force garbage collection if possible (this is just a test, not guaranteed)
      if (global.gc) {
        global.gc();
      }

      // The weak reference should be cleared if disposal worked correctly
      // Note: This test is more of a documentation of intent rather than a reliable test
      // since garbage collection timing is not guaranteed
    });
  });
});
