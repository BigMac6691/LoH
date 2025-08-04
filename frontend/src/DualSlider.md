# DualSlider Component

A reusable dual-handle range slider component for selecting min/max values with visual feedback and automatic constraint handling.

## Features

- **Dual handles**: Two draggable handles for min and max values
- **Visual feedback**: Colored fill between handles, value labels below each handle
- **Automatic constraints**: Prevents min from exceeding max and vice versa
- **Touch support**: Works on both desktop and mobile devices
- **Customizable**: Configurable range, initial values, and styling
- **Event callbacks**: Optional onChange callback for real-time updates

## Usage

### Basic Usage

```javascript
import { DualSlider } from './DualSlider.js';

const slider = new DualSlider(containerElement, {
  min: 0,
  max: 9,
  minValue: 2,
  maxValue: 7,
  width: 300,
  height: 60,
  onChange: (values) => {
    console.log('Values changed:', values);
  }
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `min` | number | 0 | Minimum value of the range |
| `max` | number | 9 | Maximum value of the range |
| `minValue` | number | 2 | Initial minimum value |
| `maxValue` | number | 7 | Initial maximum value |
| `step` | number | 1 | Step increment (currently always 1) |
| `width` | number | 300 | Width of the slider in pixels |
| `height` | number | 60 | Height of the slider in pixels |
| `onChange` | function | null | Callback function called when values change |

### Methods

#### `getValues()`
Returns the current min and max values.

```javascript
const values = slider.getValues();
console.log(values.min, values.max);
```

#### `setValues(min, max)`
Programmatically set the min and max values.

```javascript
slider.setValues(1, 8);
```

#### `destroy()`
Remove the slider from the DOM and clean up event listeners.

```javascript
slider.destroy();
```

## Behavior

### Constraint Handling

The component automatically handles constraints to ensure valid ranges:

- If min handle is dragged to a value ≥ max, max is automatically adjusted to min + 1
- If max handle is dragged to a value ≤ min, min is automatically adjusted to max - 1
- Values are always constrained to the specified min/max range

### Interaction

- **Drag handles**: Click and drag either handle to change values
- **Click track**: Click anywhere on the track to move the nearest handle to that position
- **Touch support**: Full touch support for mobile devices
- **Visual feedback**: Handles scale up when dragging, track highlights on hover

## Integration Example

The component is currently integrated into the map generation UI to replace the separate min/max star density inputs:

```javascript
// In UIController.js
this.starDensitySlider = new DualSlider(this.starDensitySliderContainer, {
  min: 0,
  max: 9,
  minValue: 2,
  maxValue: 7,
  width: 280,
  height: 60,
  onChange: (values) => {
    console.log('Star density changed:', values);
  }
});

// Get values for map generation
const config = {
  minStarDensity: this.starDensitySlider.getValues().min,
  maxStarDensity: this.starDensitySlider.getValues().max,
  // ... other config values
};
```

## Styling

The component uses inline styles for consistency but can be customized with CSS:

```css
.dual-slider-handle:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.dual-slider-track:hover {
  background: #444;
}

.dual-slider-label {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  text-shadow: 0 0 5px rgba(0, 255, 136, 0.5);
}
```

## Testing

A test page is available at `test-dual-slider.html` to demonstrate the component's functionality with various configurations and interactive controls. 