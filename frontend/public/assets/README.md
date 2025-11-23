# Assets Folder

This folder contains 3D models, fonts, and other assets for the game.

## TODO: Add Your Assets Here

### 3D Models (`models/` folder)
- **scene.gltf** - Main 3D scene/model for the game
- Add other GLTF/GLB files as needed

### Fonts (`fonts/` folder)  
- **helvetiker.json** - Font file for 3D text rendering
- Add other font JSON files as needed

### Usage
Assets are loaded through the `AssetManager` class:
```javascript
import { assetManager } from '../src/engine/AssetManager.js';

// Load individual assets
const scene = await assetManager.loadGLTF('models/scene.gltf');
const font = await assetManager.loadFont('fonts/helvetiker.json');

// Load multiple assets
await assetManager.loadAll([
  { type: 'gltf', path: 'models/scene.gltf' },
  { type: 'font', path: 'fonts/helvetiker.json' }
]);

// Listen for loading events
assetManager.addEventListener('asset:loaded', (event) => {
  console.log(`Loaded ${event.detail.type}: ${event.detail.path}`);
});

assetManager.addEventListener('assets:ready', (event) => {
  console.log('All assets loaded!');
});
```

### Asset Requirements
- **GLTF files**: Must be valid GLTF 2.0 format
- **Font files**: Must be Three.js compatible JSON format (can be converted using Three.js FontConverter)
- All assets should be optimized for web delivery (compressed textures, reasonable file sizes) 