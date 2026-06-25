import { getLocalData, setLocalData } from "./storage";
import { logError } from "./errorLog";

const LS_KEY = "pan_shifts";

export const getOpenShift = (userId) => {
  try {
    const shifts = getLocalData(LS_KEY, []);
    return shifts.find(s => s.userId === userId && s.status === "open") || null;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return null;
  }
};

export const getAllShifts = (userId) => {
  try {
    const shifts = getLocalData(LS_KEY, []);
    return userId ? shifts.filter(s => s.userId === userId) : shifts;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
  }
};

export const openShift = (userId, userName, startingCash) => {
  try {
    const shifts = getLocalData(LS_KEY, []);
    const existing = shifts.find(s => s.userId === userId && s.status === "open");
    if (existing) return existing;

    const shift = {
      id: "shift_" + Date.now(),
      userId,
      userName,
      openTime: Date.now(),
      closeTime: null,
      startingCash: parseFloat(startingCash) || 0,
      expectedCash: null,
      actualCash: null,
      difference: null,
      status: "open",
      notes: "",
    };
    shifts.push(shift);
    setLocalData(LS_KEY, shifts);
    return shift;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to open shift");
  }
};

export const closeShift = (userId, actualCash) => {
  try {
    const shifts = getLocalData(LS_KEY, []);
    const shift = shifts.find(s => s.userId === userId && s.status === "open");
    if (!shift) throw new Error("No open shift found");

    const transactions = getLocalData("pan_transactions", []);
    const sinceOpen = transactions.filter(t => t.timestamp >= shift.openTime && t.cashierId === userId);
    const cashSales = sinceOpen.filter(t => t.paymentMode === "Cash").reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const cashInflows = sinceOpen.filter(t => t.paymentMode === "Cash" && t.receivedAmount).reduce((sum, t) => sum + parseFloat(t.changeAmount || 0), 0);
    const cashReceived = sinceOpen.filter(t => t.paymentMode === "Cash").reduce((sum, t) => sum + parseFloat(t.receivedAmount || t.totalAmount || 0), 0);

    const actual = parseFloat(actualCash) || 0;
    const expected = shift.startingCash + cashSales;
    shift.closeTime = Date.now();
    shift.expectedCash = expected;
    shift.actualCash = actual;
    shift.difference = +(actual - expected).toFixed(2);
    shift.status = "closed";

    setLocalData(LS_KEY, shifts);
    return shift;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error(err.message || "Failed to close shift");
  }
};

export const getTodayShiftSummary = (userId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shifts = getLocalData(LS_KEY, []);
    const todayShifts = shifts.filter(s => s.userId === userId && s.openTime >= today.getTime());
    if (todayShifts.length === 0) return null;
    const last = todayShifts[todayShifts.length - 1];
    const openCount = todayShifts.filter(s => s.status === "open").length;
    return { ...last, totalToday: todayShifts.length, openCount };
  } catch {
    return null;
  }
};
