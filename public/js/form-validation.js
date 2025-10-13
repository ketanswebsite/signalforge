/**
 * Form Validation Utilities
 * Provides input validation for trade forms and other user inputs
 */

window.FormValidation = {
    /**
     * Validation rules
     */
    rules: {
        required: (value) => value !== null && value !== undefined && value !== '',
        positive: (value) => parseFloat(value) > 0,
        nonNegative: (value) => parseFloat(value) >= 0,
        number: (value) => !isNaN(parseFloat(value)) && isFinite(value),
        integer: (value) => Number.isInteger(parseFloat(value)),
        date: (value) => !isNaN(Date.parse(value)),
        futureDate: (value) => new Date(value) > new Date(),
        pastDate: (value) => new Date(value) <= new Date(),
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        minLength: (min) => (value) => value && value.length >= min,
        maxLength: (max) => (value) => value && value.length <= max,
        min: (min) => (value) => parseFloat(value) >= min,
        max: (max) => (value) => parseFloat(value) <= max,
        symbol: (value) => /^[A-Z0-9.\-]+$/i.test(value)
    },

    /**
     * Error messages
     */
    messages: {
        required: 'This field is required',
        positive: 'Value must be greater than 0',
        nonNegative: 'Value cannot be negative',
        number: 'Please enter a valid number',
        integer: 'Please enter a whole number',
        date: 'Please enter a valid date',
        futureDate: 'Date cannot be in the future',
        pastDate: 'Date cannot be in the past',
        email: 'Please enter a valid email',
        minLength: (min) => `Must be at least ${min} characters`,
        maxLength: (max) => `Must be no more than ${max} characters`,
        min: (min) => `Value must be at least ${min}`,
        max: (max) => `Value must be no more than ${max}`,
        symbol: 'Please enter a valid stock symbol (letters, numbers, dots, dashes only)'
    },

    /**
     * Validate a single field
     * @param {HTMLElement} field - Input field element
     * @param {Array} validations - Array of validation rule names or objects
     * @returns {Object} - { valid: boolean, message: string }
     */
    validateField(field, validations = []) {
        const value = field.value;

        for (const validation of validations) {
            let ruleName, ruleParam, customMessage;

            if (typeof validation === 'string') {
                ruleName = validation;
            } else if (typeof validation === 'object') {
                ruleName = validation.rule;
                ruleParam = validation.param;
                customMessage = validation.message;
            }

            const rule = typeof this.rules[ruleName] === 'function'
                ? (ruleParam !== undefined ? this.rules[ruleName](ruleParam) : this.rules[ruleName])
                : null;

            if (rule && !rule(value)) {
                const message = customMessage || (typeof this.messages[ruleName] === 'function'
                    ? this.messages[ruleName](ruleParam)
                    : this.messages[ruleName]);

                this.showError(field, message);
                return { valid: false, message };
            }
        }

        this.clearError(field);
        return { valid: true, message: '' };
    },

    /**
     * Validate trade entry form
     * @param {Object} formData - Form data object
     * @returns {Object} - { valid: boolean, errors: Object }
     */
    validateTrade(formData) {
        const errors = {};

        // Symbol validation
        if (!formData.symbol || !this.rules.symbol(formData.symbol)) {
            errors.symbol = 'Please enter a valid stock symbol';
        }

        // Entry price validation
        if (!formData.entryPrice) {
            errors.entryPrice = 'Entry price is required';
        } else if (!this.rules.positive(formData.entryPrice)) {
            errors.entryPrice = 'Entry price must be greater than 0';
        }

        // Entry date validation
        if (!formData.entryDate) {
            errors.entryDate = 'Entry date is required';
        } else if (!this.rules.date(formData.entryDate)) {
            errors.entryDate = 'Please enter a valid date';
        } else if (new Date(formData.entryDate) > new Date()) {
            errors.entryDate = 'Entry date cannot be in the future';
        }

        // Shares validation (if provided)
        if (formData.shares !== undefined && formData.shares !== '') {
            if (!this.rules.positive(formData.shares)) {
                errors.shares = 'Shares must be greater than 0';
            }
        }

        // Target price validation (if provided)
        if (formData.targetPrice !== undefined && formData.targetPrice !== '') {
            if (!this.rules.positive(formData.targetPrice)) {
                errors.targetPrice = 'Target price must be greater than 0';
            } else if (parseFloat(formData.targetPrice) <= parseFloat(formData.entryPrice)) {
                errors.targetPrice = 'Target price should be higher than entry price';
            }
        }

        // Stop loss validation (if provided)
        if (formData.stopLoss !== undefined && formData.stopLoss !== '') {
            if (!this.rules.positive(formData.stopLoss)) {
                errors.stopLoss = 'Stop loss must be greater than 0';
            } else if (parseFloat(formData.stopLoss) >= parseFloat(formData.entryPrice)) {
                errors.stopLoss = 'Stop loss should be lower than entry price';
            }
        }

        // Exit price validation (if trade is closed)
        if (formData.exitPrice !== undefined && formData.exitPrice !== '') {
            if (!this.rules.positive(formData.exitPrice)) {
                errors.exitPrice = 'Exit price must be greater than 0';
            }
        }

        // Exit date validation (if provided)
        if (formData.exitDate !== undefined && formData.exitDate !== '') {
            if (!this.rules.date(formData.exitDate)) {
                errors.exitDate = 'Please enter a valid date';
            } else if (formData.entryDate && new Date(formData.exitDate) < new Date(formData.entryDate)) {
                errors.exitDate = 'Exit date cannot be before entry date';
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Show error message for field
     * @param {HTMLElement} field - Input field element
     * @param {string} message - Error message
     */
    showError(field, message) {
        if (!field) return;

        // Remove existing error
        this.clearError(field);

        // Add error class
        field.classList.add('input-error');

        // Create error message element
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error-message';
        errorEl.textContent = message;
        errorEl.id = `error-${field.id || field.name}`;

        // Insert after field
        field.parentNode.insertBefore(errorEl, field.nextSibling);
    },

    /**
     * Clear error message for field
     * @param {HTMLElement} field - Input field element
     */
    clearError(field) {
        if (!field) return;

        field.classList.remove('input-error');

        const errorEl = document.getElementById(`error-${field.id || field.name}`);
        if (errorEl) {
            errorEl.remove();
        }
    },

    /**
     * Setup real-time validation for form
     * @param {HTMLFormElement} form - Form element
     * @param {Object} fieldValidations - Object mapping field IDs to validation rules
     */
    setupRealtimeValidation(form, fieldValidations) {
        Object.keys(fieldValidations).forEach(fieldId => {
            const field = form.querySelector(`#${fieldId}`);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateField(field, fieldValidations[fieldId]);
                });

                field.addEventListener('input', () => {
                    if (field.classList.contains('input-error')) {
                        this.validateField(field, fieldValidations[fieldId]);
                    }
                });
            }
        });
    }
};

// Add validation styles

