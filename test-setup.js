// Test setup file for Vitest
// This file configures the testing environment

// Mock WebGL context for Three.js tests
const mockWebGLContext = {
  createBuffer: () => ({}),
  bindBuffer: () => {},
  bufferData: () => {},
  createTexture: () => ({}),
  bindTexture: () => {},
  texImage2D: () => {},
  texParameteri: () => {},
  createShader: () => ({}),
  shaderSource: () => {},
  compileShader: () => {},
  createProgram: () => ({}),
  attachShader: () => {},
  linkProgram: () => {},
  useProgram: () => {},
  getAttribLocation: () => 0,
  getUniformLocation: () => ({}),
  enableVertexAttribArray: () => {},
  vertexAttribPointer: () => {},
  uniformMatrix4fv: () => {},
  uniform3f: () => {},
  uniform1i: () => {},
  drawArrays: () => {},
  drawElements: () => {},
  clear: () => {},
  clearColor: () => {},
  viewport: () => {},
  enable: () => {},
  depthFunc: () => {},
  blendFunc: () => {},
  cullFace: () => {},
  frontFace: () => {},
  getError: () => 0,
  getExtension: () => null,
  canvas: {
    width: 800,
    height: 600,
    style: {}
  }
};

// Mock canvas
global.HTMLCanvasElement.prototype.getContext = function(type) {
  if (type === 'webgl' || type === 'webgl2') {
    return mockWebGLContext;
  }
  return null;
};

// Mock other browser APIs that might be needed
global.window = global;
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        getContext: (type) => {
          if (type === 'webgl' || type === 'webgl2') {
            return mockWebGLContext;
          }
          return null;
        },
        width: 800,
        height: 600,
        style: {}
      };
    }
    return {};
  },
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  setTimeout(callback, 16);
  return 1;
};

global.cancelAnimationFrame = () => {};

// Mock performance API
global.performance = {
  now: () => Date.now()
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

console.log('🧪 Test environment configured');
