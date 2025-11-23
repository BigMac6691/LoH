import * as THREE from 'three';
import { mem } from '../engine/MemoryManager.js';

/**
 * Memory Test Harness - Development tool for testing GPU memory management
 * Creates test meshes, tracks them with MemoryManager, and logs memory usage
 */

/**
 * Run a comprehensive memory test
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
 * @param {THREE.Camera} camera - The Three.js camera
 */
export function runMemoryTest(scene, renderer, camera) {
  console.log('🧪 MEMORY TEST: Starting comprehensive memory test...');
  
  // Get baseline memory info
  const baselineMemory = getMemoryInfo(renderer);
  console.log('🧪 MEMORY TEST: Baseline memory:', baselineMemory);
  
  // Test 1: Create and track meshes
  console.log('\n🧪 MEMORY TEST: Test 1 - Creating and tracking meshes...');
  console.log(`🧪 MEMORY TEST: Tracked objects before creating meshes: ${mem.getTrackedCount()}`);
  const testGroup = createTestMeshes(350); // Create ~350 meshes
  scene.add(testGroup);
  
  // Force a render to ensure GPU resources are allocated
  renderer.render(scene, camera);
  
  const afterCreateMemory = getMemoryInfo(renderer);
  console.log('🧪 MEMORY TEST: After creating meshes:', afterCreateMemory);
  console.log(`🧪 MEMORY TEST: Memory delta: +${afterCreateMemory.geometries - baselineMemory.geometries} geometries, +${afterCreateMemory.textures - baselineMemory.textures} textures`);
  console.log(`🧪 MEMORY TEST: Tracked objects: ${mem.getTrackedCount()}`);
  
  // Debug: Show what's being tracked
  const debugInfoBefore = mem.getDebugInfo();
  console.log('🧪 MEMORY TEST: Tracked object types:', debugInfoBefore.objects.map(obj => obj.type).slice(0, 10)); // Show first 10 types
  
  // Test 2: Dispose meshes
  console.log('\n🧪 MEMORY TEST: Test 2 - Disposing meshes...');
  console.log(`🧪 MEMORY TEST: Tracked objects before disposal: ${mem.getTrackedCount()}`);
  mem.dispose(testGroup);
  scene.remove(testGroup);
  
  const afterDisposeMemory = getMemoryInfo(renderer);
  console.log('🧪 MEMORY TEST: After disposing meshes:', afterDisposeMemory);
  console.log(`🧪 MEMORY TEST: Memory delta from baseline: +${afterDisposeMemory.geometries - baselineMemory.geometries} geometries, +${afterDisposeMemory.textures - baselineMemory.textures} textures`);
  console.log(`🧪 MEMORY TEST: Tracked objects after disposal: ${mem.getTrackedCount()}`);
  
  // Debug: Show what's still being tracked
  const debugInfoAfter = mem.getDebugInfo();
  console.log('🧪 MEMORY TEST: Remaining tracked objects:', debugInfoAfter.objects.slice(0, 10)); // Show first 10
  
  // Test 3: Double dispose (should be idempotent)
  console.log('\n🧪 MEMORY TEST: Test 3 - Testing double dispose (idempotency)...');
  try {
    mem.dispose(testGroup);
    console.log('🧪 MEMORY TEST: Double dispose completed without errors (idempotent)');
  } catch (error) {
    console.error('🧪 MEMORY TEST: Double dispose failed:', error);
  }
  
  const afterDoubleDisposeMemory = getMemoryInfo(renderer);
  console.log('🧪 MEMORY TEST: After double dispose:', afterDoubleDisposeMemory);
  
  // Test 4: Stress test with create→dispose loop
  console.log('\n🧪 MEMORY TEST: Test 4 - Stress test (10 iterations of create→dispose)...');
  const stressTestMemory = runStressTest(scene, renderer, 10);
  console.log('🧪 MEMORY TEST: After stress test:', stressTestMemory);
  console.log(`🧪 MEMORY TEST: Final memory delta from baseline: +${stressTestMemory.geometries - baselineMemory.geometries} geometries, +${stressTestMemory.textures - baselineMemory.textures} textures`);
  
  // Test 5: disposeAll test (only for test objects)
  console.log('\n🧪 MEMORY TEST: Test 5 - Testing disposeAll for test objects only...');
  const finalGroup = createTestMeshes(100);
  scene.add(finalGroup);
  
  // Get count before disposal
  const beforeDisposal = mem.getTrackedCount();
  console.log(`🧪 MEMORY TEST: Tracked objects before disposal: ${beforeDisposal}`);
  
  // Dispose only the test group, not everything
  mem.dispose(finalGroup);
  scene.remove(finalGroup);
  
  const finalMemory = getMemoryInfo(renderer);
  console.log('🧪 MEMORY TEST: After final disposal:', finalMemory);
  console.log(`🧪 MEMORY TEST: Note: disposeAll() was not tested as it would clear ALL tracked objects including game objects`);
  
  // Summary
  console.log('\n🧪 MEMORY TEST: === SUMMARY ===');
  console.log(`🧪 MEMORY TEST: Baseline geometries: ${baselineMemory.geometries}`);
  console.log(`🧪 MEMORY TEST: After stress test geometries: ${stressTestMemory.geometries}`);
  console.log(`🧪 MEMORY TEST: Baseline textures: ${baselineMemory.textures}`);
  console.log(`🧪 MEMORY TEST: After stress test textures: ${stressTestMemory.textures}`);
  console.log(`🧪 MEMORY TEST: Memory leak check: ${stressTestMemory.geometries === baselineMemory.geometries && stressTestMemory.textures === baselineMemory.textures ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🧪 MEMORY TEST: Final tracked objects: ${mem.getTrackedCount()}`);
  
  console.log('🧪 MEMORY TEST: Memory test completed!');
}

/**
 * Create test meshes for memory testing
 * @param {number} count - Number of meshes to create
 * @returns {THREE.Group} Group containing all test meshes
 */
function createTestMeshes(count) {
  const group = new THREE.Group();
  group.name = 'memory-test-group';
  
  for (let i = 0; i < count; i++) {
    // Create geometry with varying complexity
    const radius = 0.1 + (Math.random() * 0.2);
    const geometry = new THREE.SphereGeometry(radius, 8 + Math.floor(Math.random() * 8), 6 + Math.floor(Math.random() * 6));
    
    // Create material with varying properties
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.5, 0.5),
      metalness: Math.random(),
      roughness: Math.random(),
      emissive: new THREE.Color().setHSL(Math.random(), 0.3, 0.1)
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `test-mesh-${i}`;
    
    // Position randomly
    mesh.position.set(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    );
    
    // Add to group
    group.add(mesh);
    
    // Track mesh, geometry, and material with MemoryManager
    mem.track(mesh, `test-mesh-${i}`);
    mem.track(geometry, `test-geometry-${i}`);
    mem.track(material, `test-material-${i}`);
  }
  
  console.log(`🧪 MEMORY TEST: Created ${count} test meshes`);
  return group;
}

/**
 * Run a stress test with multiple create→dispose cycles
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
 * @param {number} iterations - Number of iterations
 * @returns {Object} Final memory info
 */
function runStressTest(scene, renderer, iterations) {
  console.log(`🧪 MEMORY TEST: Running stress test with ${iterations} iterations...`);
  
  for (let i = 0; i < iterations; i++) {
    const group = createTestMeshes(50 + Math.floor(Math.random() * 50)); // 50-100 meshes per iteration
    scene.add(group);
    
    // Force a render to ensure GPU resources are allocated
    renderer.render(scene, new THREE.Camera());
    
    // Dispose immediately
    mem.dispose(group);
    scene.remove(group);
    
    if ((i + 1) % 5 === 0) {
      console.log(`🧪 MEMORY TEST: Stress test iteration ${i + 1}/${iterations} completed`);
    }
  }
  
  return getMemoryInfo(renderer);
}

/**
 * Get memory information from the renderer
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
 * @returns {Object} Memory information
 */
function getMemoryInfo(renderer) {
  const info = renderer.info.memory;
  return {
    geometries: info.geometries,
    textures: info.textures,
    triangles: info.triangles,
    points: info.points,
    lines: info.lines
  };
}

/**
 * Get debug information about tracked objects
 * @returns {Object} Debug info from MemoryManager
 */
export function getMemoryDebugInfo() {
  return mem.getDebugInfo();
}

/**
 * Log current memory usage
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
 */
export function logMemoryUsage(renderer) {
  const memory = getMemoryInfo(renderer);
  const debug = getMemoryDebugInfo();
  
  console.log('🧪 MEMORY TEST: Current memory usage:', memory);
  console.log('🧪 MEMORY TEST: Tracked objects:', debug);
}
