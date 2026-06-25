import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, isPlainPin } from "../db/hash";

describe("hashPin", () => {
  it("returns a string prefixed with sha256$", async () => {
    const result = await hashPin("1234");
    expect(result).toMatch(/^sha256\$/);
    expect(result.length).toBe(64 + 7);
  });

  it("produces deterministic output for same input", async () => {
    const a = await hashPin("5555");
    const b = await hashPin("5555");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1235");
    expect(a).not.toBe(b);
  });
});

describe("verifyPin", () => {
  it("returns true when pin matches hashed value", async () => {
    const hashed = await hashPin("1234");
    const result = await verifyPin("1234", hashed);
    expect(result).toBe(true);
  });

  it("returns false when pin does not match", async () => {
    const hashed = await hashPin("1234");
    const result = await verifyPin("wrong", hashed);
    expect(result).toBe(false);
  });

  it("falls back to plaintext comparison for non-hashed stored value", async () => {
    const result = await verifyPin("1234", "1234");
    expect(result).toBe(true);
  });

  it("returns false for plaintext mismatch", async () => {
    const result = await verifyPin("1234", "9999");
    expect(result).toBe(false);
  });

  it("returns false for null stored hash", async () => {
    const result = await verifyPin("1234", null);
    expect(result).toBe(false);
  });

  it("returns false for undefined stored hash", async () => {
    const result = await verifyPin("1234", undefined);
    expect(result).toBe(false);
  });
});

describe("isPlainPin", () => {
  it("returns true for a plain numeric pin", () => {
    expect(isPlainPin("1234")).toBe(true);
  });

  it("returns false for a sha256$ prefixed hash", () => {
    expect(isPlainPin("sha256$abc123")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPlainPin(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isPlainPin(undefined)).toBe(false);
  });
});
