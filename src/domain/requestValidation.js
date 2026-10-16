// Pure domain & input validation rules for FR-001, FR-002, NFR-006 (ADR-001)
// DTOValidationLayer: Enforces controlled values and field boundaries before database interaction.

export const CATEGORIES = Object.freeze([
  'Facility Fault',
  'Damaged Equipment',
  'Security Concern',
  'IT Support',
  'Maintenance',
  'Lost Property',
  'Other',
]);

export const LIMITS = Object.freeze({
  DESCRIPTION_MIN_LENGTH: 1,
  DESCRIPTION_MAX_LENGTH: 1000,
  LOCATION_MIN_LENGTH: 1,
  LOCATION_MAX_LENGTH: 255,
});

export function isKnownCategory(category) {
  return typeof category === 'string' && CATEGORIES.includes(category);
}

/**
 * Validates request intake payload according to boundary and equivalence rules.
 * @param {{ category: string, description: string, location: string, otherDescription?: string }} input
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateRequestInput(input = {}) {
  const errors = [];
  const { category, description, location, otherDescription } = input;

  // Category equivalence partitioning (FR-002)
  if (!category || !isKnownCategory(category)) {
    errors.push('INVALID_CATEGORY: Category must be one of the predefined controlled values.');
  } else if (category === 'Other') {
    if (!otherDescription || otherDescription.trim().length === 0) {
      errors.push('OTHER_DESCRIPTION_REQUIRED: A short description is required when "Other" category is selected.');
    }
  }

  // Description boundary checks (FR-001, NFR-006)
  if (typeof description !== 'string' || description.trim().length < LIMITS.DESCRIPTION_MIN_LENGTH) {
    errors.push('DESCRIPTION_TOO_SHORT: Description must be at least 1 non-whitespace character.');
  } else if (description.length > LIMITS.DESCRIPTION_MAX_LENGTH) {
    errors.push('DESCRIPTION_TOO_LONG: Description cannot exceed 1000 characters.');
  }

  // Location boundary checks (FR-001)
  if (typeof location !== 'string' || location.trim().length < LIMITS.LOCATION_MIN_LENGTH) {
    errors.push('LOCATION_TOO_SHORT: Location must be at least 1 non-whitespace character.');
  } else if (location.length > LIMITS.LOCATION_MAX_LENGTH) {
    errors.push('LOCATION_TOO_LONG: Location cannot exceed 255 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
