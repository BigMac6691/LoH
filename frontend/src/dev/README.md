# Development Tools

This directory contains development tools and testing utilities for the LoH game.

## Memory Test Harness

The memory test harness is a comprehensive tool for testing GPU memory management in Three.js applications. It helps identify memory leaks and ensures proper resource cleanup.

### Features

- **Comprehensive Testing**: Creates 300-400 test meshes with varying complexity
- **Memory Tracking**: Uses MemoryManager to track all created objects
- **Stress Testing**: Performs multiple create→dispose cycles to test memory resilience
- **Idempotency Testing**: Verifies that double disposal doesn't cause errors
- **Memory Leak Detection**: Compares baseline vs final memory usage

### Usage

#### In Development Mode

When `DEV_MODE` is enabled, a dev panel will appear in the top-right corner of the screen with the following options:

- **Run Memory Test**: Executes the full memory test suite
- **Log Memory Usage**: Shows current memory usage and tracked objects
- **Toggle Panel**: Shows/hides the dev panel

#### Keyboard Shortcuts

- **M**: Toggle the dev panel
- **T**: Run memory test

#### Programmatic Usage

```javascript
import { runMemoryTest, logMemoryUsage } from './dev/MemoryTest.js';

// Run the full memory test
runMemoryTest(scene, renderer);

// Log current memory usage
logMemoryUsage(renderer);
```

### Test Results

The memory test outputs detailed information to the console:

1. **Baseline Memory**: Initial memory usage before creating test objects
2. **After Creation**: Memory usage after creating test meshes
3. **After Disposal**: Memory usage after disposing test meshes
4. **Double Dispose**: Verifies idempotency
5. **Stress Test**: Results from 10 iterations of create→dispose cycles
6. **disposeAll Test**: Tests bulk disposal functionality
7. **Summary**: Final comparison and leak detection

### Expected Results

A successful memory test should show:
- Memory usage returning close to baseline after disposal
- No errors during double disposal (idempotency)
- Consistent memory usage across stress test iterations
- All tracked objects properly disposed

### Memory Leak Detection

The test checks for memory leaks by comparing:
- Geometry count before and after testing
- Texture count before and after testing
- Triangle count before and after testing

If memory usage doesn't return to baseline, it indicates a potential memory leak.

## Running Tests

### Unit Tests

Run the MemoryManager unit tests:

```bash
npm run test
```

Or run tests once:

```bash
npm run test:run
```

### Manual Testing

1. Start the development server: `npm run frontend`
2. Open the browser console
3. Use the dev panel or keyboard shortcuts to run memory tests
4. Monitor console output for test results

## Troubleshooting

### Common Issues

1. **Memory not returning to baseline**: Check for untracked objects or manual Three.js object creation
2. **Test objects visible in scene**: Ensure test objects are properly removed from the scene
3. **Console errors during disposal**: Verify MemoryManager is properly tracking all objects

### Debug Information

Use the "Log Memory Usage" button to see:
- Current memory usage statistics
- List of tracked objects with reference counts
- Object types and labels

## Architecture

### MemoryTest.js

Main test harness that:
- Creates test meshes with varying complexity
- Tracks objects with MemoryManager
- Performs comprehensive disposal testing
- Logs memory usage at each stage

### DevPanel.js

UI component that provides:
- Easy access to memory testing tools
- Keyboard shortcuts for quick testing
- Visual feedback for test status

### Integration

The dev tools are automatically initialized when `DEV_MODE` is enabled in `devScenarios.js`. The dev panel appears by default in development mode and can be toggled with the 'M' key.
