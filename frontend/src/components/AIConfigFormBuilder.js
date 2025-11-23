/**
 * AIConfigFormBuilder - Generic form builder for AI configuration
 * Dynamically creates form fields based on AI configuration schema
 */

export class AIConfigFormBuilder {
  /**
   * Build a configuration form from a schema
   * @param {Object} schema - Configuration schema from AI
   * @param {Object} currentConfig - Current configuration values (optional)
   * @param {HTMLElement} container - Container element to render form into
   * @returns {Object} Configuration object with current values
   */
  buildForm(schema, currentConfig = {}, container) {
    // Clear container
    container.innerHTML = '';

    if (!schema || Object.keys(schema).length === 0) {
      const noConfigMsg = document.createElement('p');
      noConfigMsg.className = 'ai-config-no-fields';
      noConfigMsg.textContent = 'This AI has no configurable options.';
      container.appendChild(noConfigMsg);
      return {};
    }

    const formData = { ...currentConfig };
    const form = document.createElement('div');
    form.className = 'ai-config-form';

    // Create form fields for each schema property
    for (const [key, fieldSchema] of Object.entries(schema)) {
      const fieldGroup = this.createFieldGroup(key, fieldSchema, formData);
      form.appendChild(fieldGroup);
    }

    container.appendChild(form);

    // Return getter function for form data
    return {
      getData: () => {
        const data = {};
        for (const [key, fieldSchema] of Object.entries(schema)) {
          const input = form.querySelector(`[data-field="${key}"]`);
          if (input) {
            const value = this.getValueFromInput(input, fieldSchema.type);
            if (value !== null && value !== undefined) {
              data[key] = value;
            } else {
              // Use default if no value
              data[key] = fieldSchema.default;
            }
          }
        }
        return data;
      },
      validate: () => {
        const errors = [];
        for (const [key, fieldSchema] of Object.entries(schema)) {
          const input = form.querySelector(`[data-field="${key}"]`);
          if (input) {
            const value = this.getValueFromInput(input, fieldSchema.type);
            if (fieldSchema.required && (value === null || value === undefined || value === '')) {
              errors.push(`${fieldSchema.label || key} is required`);
            } else if (value !== null && value !== undefined && value !== '') {
              // Validate min/max for numbers
              if (fieldSchema.type === 'number') {
                if (fieldSchema.min !== undefined && value < fieldSchema.min) {
                  errors.push(`${fieldSchema.label || key} must be at least ${fieldSchema.min}`);
                }
                if (fieldSchema.max !== undefined && value > fieldSchema.max) {
                  errors.push(`${fieldSchema.label || key} must be at most ${fieldSchema.max}`);
                }
              }
            }
          }
        }
        return errors;
      }
    };
  }

  /**
   * Create a form field group (label, input, description)
   * @param {string} key - Field key
   * @param {Object} fieldSchema - Field schema
   * @param {Object} formData - Current form data
   * @returns {HTMLElement} Field group element
   */
  createFieldGroup(key, fieldSchema, formData) {
    const group = document.createElement('div');
    group.className = 'ai-config-field-group';

    // Label with help icon
    const labelContainer = document.createElement('div');
    labelContainer.className = 'ai-config-label-container';

    const label = document.createElement('label');
    label.textContent = fieldSchema.label || key;
    label.setAttribute('for', `ai-config-${key}`);

    // Help icon for description
    if (fieldSchema.description) {
      const helpIcon = document.createElement('span');
      helpIcon.className = 'ai-config-help-icon';
      helpIcon.textContent = '?';
      helpIcon.title = fieldSchema.description;
      helpIcon.setAttribute('aria-label', 'Help');
      
      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'ai-config-tooltip';
      tooltip.textContent = fieldSchema.description;
      
      helpIcon.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
      });
      helpIcon.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
      helpIcon.addEventListener('click', (e) => {
        e.preventDefault();
        tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
      });

      labelContainer.appendChild(label);
      labelContainer.appendChild(helpIcon);
      labelContainer.appendChild(tooltip);
    } else {
      labelContainer.appendChild(label);
    }

    group.appendChild(labelContainer);

    // Input field
    const input = this.createInput(key, fieldSchema, formData[key] ?? fieldSchema.default);
    group.appendChild(input);

    // Value display for sliders
    if (fieldSchema.type === 'number' && fieldSchema.min !== undefined && fieldSchema.max !== undefined) {
      const valueDisplay = document.createElement('div');
      valueDisplay.className = 'ai-config-value-display';
      valueDisplay.textContent = input.value;
      input.addEventListener('input', () => {
        valueDisplay.textContent = input.value;
      });
      group.appendChild(valueDisplay);
    }

    return group;
  }

  /**
   * Create an input element based on field schema
   * @param {string} key - Field key
   * @param {Object} fieldSchema - Field schema
   * @param {*} defaultValue - Default value
   * @returns {HTMLElement} Input element
   */
  createInput(key, fieldSchema, defaultValue) {
    const input = document.createElement('input');
    input.id = `ai-config-${key}`;
    input.setAttribute('data-field', key);
    input.type = fieldSchema.type === 'number' ? 'range' : 'text';
    
    if (fieldSchema.type === 'number') {
      input.type = 'range';
      input.min = fieldSchema.min ?? 0;
      input.max = fieldSchema.max ?? 100;
      input.step = fieldSchema.step ?? 1;
      input.value = defaultValue ?? fieldSchema.default ?? fieldSchema.min ?? 0;
    } else {
      input.type = 'text';
      input.value = defaultValue ?? fieldSchema.default ?? '';
    }

    input.className = 'ai-config-input';
    return input;
  }

  /**
   * Get value from input element based on type
   * @param {HTMLElement} input - Input element
   * @param {string} type - Field type
   * @returns {*} Parsed value
   */
  getValueFromInput(input, type) {
    if (type === 'number') {
      const value = parseFloat(input.value);
      return isNaN(value) ? null : value;
    }
    return input.value;
  }
}

