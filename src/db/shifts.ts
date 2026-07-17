import { collection, doc, setDoc, getDocs, getDoc, query, where, limit } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";

export const getOpenShift = async (userId) => {
  try {
    if (!isFirebaseEnabled) return null;
    const q = query(
      collection(db, "shifts"),
      where("userId", "==", userId),
      where("status", "==", "open"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return null;
  }
};

export const getAllShifts = async (userId) => {
  try {
    if (!isFirebaseEnabled) return [];
    let q = collection(db, "shifts") as any;
    if (userId) {
      q = query(collection(db, "shifts"), where("userId", "==", userId));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
  }
};

export const openShift = async (userId, userName, startingCash) => {
  try {
    const existing = await getOpenShift(userId);
    if (existing) return existing;

    const id = "shift_" + Date.now();
    const shift = {
      id,
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

    if (isFirebaseEnabled) {
      await setDoc(doc(db, "shifts", id), shift);
    }
    return shift;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to open shift");
  }
};

export const closeShift = async (userId, actualCash) => {
  try {
    const shift = (await getOpenShift(userId)) as any;
    if (!shift) throw new Error("No open shift found");

    const q = query(
      collection(db, "transactions"), 
      where("timestamp", ">=", shift.openTime)
    );
    const snap = await getDocs(q);
    const sinceOpen = snap.docs
      .map(d => d.data())
      .filter((t: any) => t.cashierId === userId);

    const cashSales = sinceOpen.filter((t: any) => t.paymentMode === "Cash").reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0);

    const actual = parseFloat(actualCash) || 0;
    const expected = shift.startingCash + cashSales;
    shift.closeTime = Date.now();
    shift.expectedCash = expected;
    shift.actualCash = actual;
    shift.difference = +(actual - expected).toFixed(2);
    shift.status = "closed";

    if (isFirebaseEnabled) {
      await setDoc(doc(db, "shifts", shift.id), shift);
    }
    return shift;
  } catch (err: any) {
    logError("STORAGE", err.message, err.stack);
    throw new Error(err.message || "Failed to close shift");
  }
};

export const getTodayShiftSummary = async (userId) => {
  try {
    if (!isFirebaseEnabled) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "shifts"),
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    const todayShifts = snap.docs
      .map(d => d.data())
      .filter((s: any) => s.openTime >= today.getTime());
    if (todayShifts.length === 0) return null;
    const last = todayShifts[todayShifts.length - 1];
    const openCount = todayShifts.filter(s => s.status === "open").length;
    return { ...last, totalToday: todayShifts.length, openCount };
  } catch {
    return null;
  }
};
