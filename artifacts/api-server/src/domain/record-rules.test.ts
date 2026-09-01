import assert from 'node:assert/strict';
import test from 'node:test';
import { applyExpenseCorrection, canRemoveFutureCall, removeExpenseFromTotals } from './record-rules.ts';

test('expense correction moves category subtotals without losing the call total', () => {
  const next = applyExpenseCorrection(
    { expenseAmount: 30, parkingExpense: 10, tollExpense: 0 },
    { amount: 10, category: 'Parking' },
    { amount: 12, category: 'Toll' },
  );
  assert.deepEqual(next, { expenseAmount: 32, parkingExpense: 0, tollExpense: 12 });
});

test('expense correction preserves unrelated legacy totals', () => {
  const next = applyExpenseCorrection(
    { expenseAmount: 85, parkingExpense: 20, tollExpense: 5 },
    { amount: 15, category: 'Supplies' },
    { amount: 9.5, category: 'Supplies' },
  );
  assert.deepEqual(next, { expenseAmount: 79.5, parkingExpense: 20, tollExpense: 5 });
});

test('removing a parking expense updates total and parking only', () => {
  const next = removeExpenseFromTotals(
    { expenseAmount: 45, parkingExpense: 15, tollExpense: 8 },
    { amount: 15, category: 'Parking' },
  );
  assert.deepEqual(next, { expenseAmount: 30, parkingExpense: 0, tollExpense: 8 });
});

test('expense totals never drop below zero on legacy mismatches', () => {
  const next = removeExpenseFromTotals(
    { expenseAmount: 5, parkingExpense: 2, tollExpense: 0 },
    { amount: 10, category: 'Parking' },
  );
  assert.deepEqual(next, { expenseAmount: 0, parkingExpense: 0, tollExpense: 0 });
});

test('only untouched upcoming calls can be removed', () => {
  assert.equal(canRemoveFutureCall({ status: 'upcoming', arrivalAt: null, actualStart: null }), true);
  assert.equal(canRemoveFutureCall({ status: 'upcoming', arrivalAt: '2026-09-01T12:00:00Z', actualStart: null }), false);
  assert.equal(canRemoveFutureCall({ status: 'arrived', arrivalAt: null, actualStart: null }), false);
  assert.equal(canRemoveFutureCall({ status: 'active', arrivalAt: null, actualStart: '2026-09-01T12:00:00Z' }), false);
  assert.equal(canRemoveFutureCall({ status: 'finished', arrivalAt: null, actualStart: null }), false);
});
