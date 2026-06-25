import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db/config", () => ({
  isFirebaseEnabled: false,
  db: null,
  auth: null,
}));

const { getExpenses, addExpense, deleteExpense, EXPENSE_CATEGORIES } = await import("../db/expenses");

describe("EXPENSE_CATEGORIES", () => {
  it("contains common expense categories", () => {
    expect(EXPENSE_CATEGORIES).toContain("Rent");
    expect(EXPENSE_CATEGORIES).toContain("Electricity");
    expect(EXPENSE_CATEGORIES).toContain("Salary");
    expect(EXPENSE_CATEGORIES).toContain("Supplies");
    expect(EXPENSE_CATEGORIES).toContain("Maintenance");
    expect(EXPENSE_CATEGORIES).toContain("Other");
  });
});

describe("getExpenses (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no expenses exist", async () => {
    const expenses = await getExpenses();
    expect(expenses).toEqual([]);
  });

  it("returns stored expenses from localStorage", async () => {
    const testExpense = { id: "exp_1", amount: 500, category: "Rent", date: "2026-06-01", description: "Test" };
    localStorage.setItem("pan_expenses", JSON.stringify([testExpense]));
    const expenses = await getExpenses();
    expect(expenses).toEqual([testExpense]);
  });
});

describe("addExpense (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds an expense and returns an id", async () => {
    const id = await addExpense({ amount: 250, category: "Supplies", date: "2026-06-15", description: "Napkins" });
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    const expenses = JSON.parse(localStorage.getItem("pan_expenses"));
    expect(expenses).toHaveLength(1);
    expect(expenses[0].amount).toBe(250);
  });

  it("prepends new expense to the list", async () => {
    await addExpense({ amount: 100, category: "Other", date: "2026-06-10", description: "First" });
    await addExpense({ amount: 200, category: "Rent", date: "2026-06-11", description: "Second" });
    const expenses = JSON.parse(localStorage.getItem("pan_expenses"));
    expect(expenses).toHaveLength(2);
    expect(expenses[0].description).toBe("Second");
  });
});

describe("deleteExpense (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes an expense by id", async () => {
    const id = await addExpense({ amount: 100, category: "Other", date: "2026-06-10", description: "Test" });
    await deleteExpense(id);
    const expenses = JSON.parse(localStorage.getItem("pan_expenses"));
    expect(expenses).toHaveLength(0);
  });

  it("does nothing when id does not exist", async () => {
    await addExpense({ amount: 100, category: "Other", date: "2026-06-10", description: "Test" });
    await deleteExpense("nonexistent");
    const expenses = JSON.parse(localStorage.getItem("pan_expenses"));
    expect(expenses).toHaveLength(1);
  });
});
