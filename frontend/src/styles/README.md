# CSS Structure and Organization

This directory contains the organized CSS files for the LoH frontend, replacing inline styles with external CSS files.

## File Structure

```
frontend/src/styles/
├── main.css          # Main CSS file that imports all others
├── base.css          # Base styles, CSS custom properties, and utilities
├── dev-panels.css    # Development panel styles (BackendTestPanel, DevPanel)
├── ui-components.css # UI component styles (PlayerSetupUI, MoveDialog, etc.)
├── test-pages.css    # Test page styles for HTML test files
└── README.md         # This documentation file
```

## CSS Custom Properties (Variables)

All colors, spacing, typography, and other design tokens are defined as CSS custom properties in `base.css`:

### Colors
- `--color-primary`: #00ff00 (Green)
- `--color-secondary`: #00ffff (Cyan)
- `--color-accent`: #ff4444 (Red)
- `--color-success`: #00aa00 (Dark Green)
- `--color-warning`: #ffff00 (Yellow)
- `--color-error`: #ff0000 (Red)

### Background Colors
- `--bg-dark`: rgba(0, 0, 0, 0.9)
- `--bg-darker`: #222
- `--bg-medium`: #333
- `--bg-light`: #444
- `--bg-lighter`: #666

### Text Colors
- `--text-primary`: white
- `--text-secondary`: #ccc
- `--text-muted`: #666

### Spacing
- `--spacing-xs`: 3px
- `--spacing-sm`: 5px
- `--spacing-md`: 8px
- `--spacing-lg`: 10px
- `--spacing-xl`: 15px
- `--spacing-xxl`: 20px

### Typography
- `--font-family-mono`: monospace
- `--font-family-default`: Arial, sans-serif
- `--font-size-xs`: 10px
- `--font-size-sm`: 11px
- `--font-size-md`: 12px
- `--font-size-lg`: 14px

## Component Classes

### Common Utility Classes
- `.text-center`, `.text-muted`
- `.mb-sm`, `.mb-md`, `.mb-lg`, `.mb-xl`
- `.mt-lg`, `.mt-xl`
- `.hidden`, `.loading`

### Form Classes
- `.form-input`, `.form-label`, `.form-group`
- `.btn`, `.btn-primary`, `.btn-secondary`

### Panel Classes
- `.panel`, `.panel-header`, `.panel-section`
- `.dev-tools-section`, `.dev-tools-header`

### Status Classes
- `.status-message`, `.status-loading`, `.status-success`, `.status-error`

## Files Refactored

### JavaScript Files
- `frontend/src/dev/BackendTestPanel.js` - Replaced inline styles with CSS classes
- `frontend/src/dev/DevPanel.js` - Replaced inline styles with CSS classes
- `frontend/src/PlayerSetupUI.js` - Replaced inline styles with CSS classes

### HTML Files
- `frontend/index.html` - Added CSS import, kept only game-specific inline styles

### Test HTML Files (Ready for Refactoring)
- `test-star-names.html`
- `frontend/test-player-setup.html`
- `test-move-dialog.html`
- `test-dual-slider.html`

## Benefits

1. **Maintainability**: Centralized styling makes it easier to maintain and update
2. **Consistency**: CSS custom properties ensure consistent design tokens
3. **Reusability**: Utility classes can be reused across components
4. **Performance**: External CSS files can be cached by browsers
5. **Accessibility**: Better support for high contrast and reduced motion preferences
6. **Responsive Design**: Easier to implement responsive breakpoints

## Usage

To use the new CSS system:

1. Import the main CSS file in your HTML:
   ```html
   <link rel="stylesheet" href="/src/styles/main.css">
   ```

2. Use the provided CSS classes instead of inline styles:
   ```html
   <!-- Before -->
   <div style="background: #333; color: white; padding: 10px;">
   
   <!-- After -->
   <div class="panel">
   ```

3. Use utility classes for common styling needs:
   ```html
   <button class="btn btn-primary mb-lg">Submit</button>
   ```

## Future Improvements

1. **Test Pages**: Refactor remaining test HTML files to use CSS classes
2. **MoveDialog**: Update MoveDialog.js to use CSS classes
3. **Responsive Design**: Add more responsive breakpoints
4. **Theme Support**: Add support for different color themes
5. **CSS Modules**: Consider using CSS modules for better component isolation
