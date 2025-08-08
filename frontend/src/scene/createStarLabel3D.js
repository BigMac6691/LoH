import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

/**
 * Create a 3D text label for a star
 * @param {string} name - The star's name to display
 * @param {number} starRadius - The radius of the star for positioning
 * @param {Object} font - The loaded font data from FontLoader
 * @returns {THREE.Mesh} The 3D text label mesh
 */
export function createStarLabel3D(name, starRadius, font) {
  // Create text geometry
  const textGeometry = new TextGeometry(name, {
    font: font,
    size: starRadius * 2, // Scale text size relative to star radius
    depth: 0.3, // Small depth for 3D effect
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.15,
  });

  // Compute bounding box to center the text
  textGeometry.computeBoundingBox();
  const boundingBox = textGeometry.boundingBox;
  
  // Center the text horizontally
  const textWidth = boundingBox.max.x - boundingBox.min.x;
  const centerX = -textWidth / 2;
  
  // Position Y below the star: -(2 * star radius + 0.8 * label size)
  const labelSize = boundingBox.max.y - boundingBox.min.y;
  const positionY = -(2 * starRadius + 0.8 * labelSize);
  
  // Create material with flat shading for better readability
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff, // White color
    flatShading: true,
    transparent: true,
    opacity: 0.9
  });
  
  // Create the mesh
  const labelMesh = new THREE.Mesh(textGeometry, material);
  
  // Position the label
  labelMesh.position.set(centerX, positionY, 0);
  
  return labelMesh;
} 