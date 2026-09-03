export type ExpenseTotals = {
  expenseAmount: number;
  parkingExpense: number;
  tollExpense: number;
};

export type ExpenseFact = {
  amount: number;
  category: string | null | undefined;
};

function money(value: number) {
  return Number(Math.max(0, value).toFixed(2));
}

export function isParking(category: string | null | undefined) {
  return category?.trim().toLowerCase() === 'parking';
}

export function isToll(category: string | null | undefined) {
  const normalized = category?.trim().toLowerCase();
  return normalized === 'toll' || normalized === 'tolls';
}

export function applyExpenseCorrection(totals: ExpenseTotals, current: ExpenseFact, next: ExpenseFact): ExpenseTotals {
  const amountDelta = next.amount - current.amount;
  const parkingDelta = (isParking(next.category) ? next.amount : 0) - (isParking(current.category) ? current.amount : 0);
  const tollDelta = (isToll(next.category) ? next.amount : 0) - (isToll(current.category) ? current.amount : 0);
  return {
    expenseAmount: money(totals.expenseAmount + amountDelta),
    parkingExpense: money(totals.parkingExpense + parkingDelta),
    tollExpense: money(totals.tollExpense + tollDelta),
  };
}

export function removeExpenseFromTotals(totals: ExpenseTotals, current: ExpenseFact): ExpenseTotals {
  return {
    expenseAmount: money(totals.expenseAmount - current.amount),
    parkingExpense: money(totals.parkingExpense - (isParking(current.category) ? current.amount : 0)),
    tollExpense: money(totals.tollExpense - (isToll(current.category) ? current.amount : 0)),
  };
}

export function canRemoveFutureCall(call: { status: string; arrivalAt?: unknown; actualStart?: unknown }) {
  return call.status === 'upcoming' && !call.arrivalAt && !call.actualStart;
}
