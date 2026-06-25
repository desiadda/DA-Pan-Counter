import { describe, it, expect } from "vitest";
import { dbService } from "../db/index";

describe("dbService", () => {
  it("exports all expected methods", () => {
    expect(typeof dbService.getProducts).toBe("function");
    expect(typeof dbService.saveProduct).toBe("function");
    expect(typeof dbService.deleteProduct).toBe("function");
    expect(typeof dbService.getTransactions).toBe("function");
    expect(typeof dbService.addTransaction).toBe("function");
    expect(typeof dbService.deleteTransaction).toBe("function");
    expect(typeof dbService.getCustomers).toBe("function");
    expect(typeof dbService.saveCustomer).toBe("function");
    expect(typeof dbService.updateUdhaarBalance).toBe("function");
    expect(typeof dbService.getExpenses).toBe("function");
    expect(typeof dbService.addExpense).toBe("function");
    expect(typeof dbService.deleteExpense).toBe("function");
    expect(typeof dbService.login).toBe("function");
    expect(typeof dbService.logout).toBe("function");
    expect(typeof dbService.getCurrentUser).toBe("function");
    expect(typeof dbService.onAuthStateChangedListener).toBe("function");
    expect(typeof dbService.saveConfig).toBe("function");
    expect(typeof dbService.clearConfig).toBe("function");
    expect(typeof dbService.getConfig).toBe("function");
    expect(typeof dbService.isFirebase).toBe("function");
  });

  it("exports EXPENSE_CATEGORIES", () => {
    expect(Array.isArray(dbService.EXPENSE_CATEGORIES)).toBe(true);
  });
});
