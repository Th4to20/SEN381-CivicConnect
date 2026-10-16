// TC-06, TC-07, TC-08: Black-box testing for Request Validation (FR-001, FR-002, NFR-006)
// Techniques applied: Boundary Value Analysis (BVA) & Equivalence Partitioning (EP)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequestInput, CATEGORIES } from '../../src/domain/requestValidation.js';

// -------------------------------------------------------------
// 1. Boundary Value Analysis (BVA) on Description Length
// Boundaries:
// Min Boundary: 0 (invalid), 1 (valid)
// Max Boundary: 1000 (valid), 1001 (invalid)
// -------------------------------------------------------------

test('BVA - Description Min Boundary: length 0 (empty string) is rejected', () => {
  const result = validateRequestInput({
    category: 'Maintenance',
    description: '',
    location: 'Building A',
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('DESCRIPTION_TOO_SHORT')));
});

test('BVA - Description Min Boundary: length 1 character is accepted', () => {
  const result = validateRequestInput({
    category: 'Maintenance',
    description: 'X',
    location: 'Building A',
  });
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('BVA - Description Max Boundary: length 1000 characters is accepted', () => {
  const boundaryText1000 = 'A'.repeat(1000);
  const result = validateRequestInput({
    category: 'Maintenance',
    description: boundaryText1000,
    location: 'Building A',
  });
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('BVA - Description Max Boundary: length 1001 characters is rejected', () => {
  const boundaryText1001 = 'A'.repeat(1001);
  const result = validateRequestInput({
    category: 'Maintenance',
    description: boundaryText1001,
    location: 'Building A',
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('DESCRIPTION_TOO_LONG')));
});

// -------------------------------------------------------------
// 2. Equivalence Partitioning (EP) on Category Selection (FR-002)
// Partitions:
// Partition 1: Valid controlled categories (7 options)
// Partition 2: Invalid/arbitrary category strings
// -------------------------------------------------------------

test('EP - Valid Partition: all 7 controlled categories are accepted', () => {
  for (const cat of CATEGORIES) {
    const payload = {
      category: cat,
      description: 'Standard issue description',
      location: 'Block C',
      otherDescription: cat === 'Other' ? 'Special circumstances' : undefined,
    };
    const result = validateRequestInput(payload);
    assert.equal(result.isValid, true, `Category "${cat}" should be accepted`);
  }
});

test('EP - Invalid Partition: arbitrary category strings are rejected with controlled error', () => {
  const invalidInputs = ['UnknownFault', 'GarbageCollection', 'TreePruning', '12345', null, ''];
  for (const invalidCat of invalidInputs) {
    const result = validateRequestInput({
      category: invalidCat,
      description: 'Standard issue description',
      location: 'Block C',
    });
    assert.equal(result.isValid, false, `Category "${invalidCat}" should be rejected`);
    assert.ok(result.errors.some((e) => e.includes('INVALID_CATEGORY')));
  }
});

test('EP - Special Rule: "Other" category requires accompanying explanation', () => {
  // Missing otherDescription
  const missingOther = validateRequestInput({
    category: 'Other',
    description: 'General problem',
    location: 'Main Yard',
    otherDescription: '   ',
  });
  assert.equal(missingOther.isValid, false);
  assert.ok(missingOther.errors.some((e) => e.includes('OTHER_DESCRIPTION_REQUIRED')));

  // Provided otherDescription
  const validOther = validateRequestInput({
    category: 'Other',
    description: 'General problem',
    location: 'Main Yard',
    otherDescription: 'Fallen fence on north perimeter',
  });
  assert.equal(validOther.isValid, true);
});
