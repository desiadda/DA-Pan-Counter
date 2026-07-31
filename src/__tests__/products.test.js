import { describe, it, expect, beforeEach, vi } from "vitest";
let mockProducts = [];

vi.mock("firebase/firestore", () => {
  return {
    collection: () => "products",
    doc: (db, col, id) => {
      const generatedId = id || "p_" + Math.random().toString(36).substring(2);
      return {
        id: generatedId,
        _path: generatedId
      };
    },
    deleteDoc: vi.fn(async (docRef) => {
      const id = docRef.id || docRef;
      mockProducts = mockProducts.filter(p => p.id !== id);
      localStorage.setItem("pan_products", JSON.stringify(mockProducts));
    }),
    getDocs: vi.fn(async () => {
      return {
        docs: mockProducts.map(p => ({
          id: p.id,
          data: () => {
            const rest = { ...p };
            delete rest.id;
            return rest;
          }
        }))
      };
    }),
    setDoc: vi.fn(async () => {}),
    runTransaction: vi.fn(async (db, cb) => {
      const firestoreTx = {
        get: async (docRef) => {
          const id = docRef.id || docRef;
          const p = mockProducts.find(prod => prod.id === id);
          return {
            exists: () => !!p,
            data: () => p
          };
        },
        set: (docRef, data) => {
          const id = docRef.id || docRef;
          // If it's a product
          const idx = mockProducts.findIndex(prod => prod.id === id);
          if (idx !== -1) {
            mockProducts[idx] = { id, ...data };
          } else {
            mockProducts.push({ id, ...data });
          }
          localStorage.setItem("pan_products", JSON.stringify(mockProducts));
        },
        update: (docRef, data) => {
          const id = docRef.id || docRef;
          const idx = mockProducts.findIndex(prod => prod.id === id);
          if (idx !== -1) {
            mockProducts[idx] = { ...mockProducts[idx], ...data };
          }
          localStorage.setItem("pan_products", JSON.stringify(mockProducts));
        }
      };
      await cb(firestoreTx);
    })
  };
});

vi.mock("../db/config", () => ({
  isFirebaseEnabled: true,
  db: {},
  auth: null,
  localizeError: (en) => en,
}));

const { getProducts, saveProduct, deleteProduct, addStockAdjustment } = await import("../db/products");
const { DEFAULT_PRODUCTS } = await import("../constants");

describe("getProducts (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockProducts = [...DEFAULT_PRODUCTS];
  });

  it("returns default products when localStorage is empty", async () => {
    const products = await getProducts();
    expect(products.length).toBe(DEFAULT_PRODUCTS.length);
    expect(products[0].batches).toBeDefined();
  });

  it("returns stored products when localStorage has data", async () => {
    const custom = [{ id: "p_custom", name: "Custom", category: "Other", sellingPrice: 10 }];
    mockProducts = custom;
    const products = await getProducts();
    expect(products[0].id).toBe("p_custom");
    expect(products[0].batches).toEqual([]);
  });
});

describe("saveProduct (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockProducts = [...DEFAULT_PRODUCTS];
  });

  it("adds a new product without an id", async () => {
    await saveProduct({ name: "New Item", category: "Other", sellingPrice: 50 });
    const products = mockProducts;
    expect(products.length).toBe(9);
    const added = products.find(p => p.name === "New Item");
    expect(added).toBeTruthy();
    expect(added.id).toMatch(/^p_/);
  });

  it("updates an existing product with matching id", async () => {
    const products = [...DEFAULT_PRODUCTS];
    products[0].sellingPrice = 999;
    await saveProduct(products[0]);
    const stored = mockProducts;
    const updated = stored.find(p => p.id === products[0].id);
    expect(updated.sellingPrice).toBe(999);
  });

  it("does not duplicate product on update", async () => {
    const product = { ...DEFAULT_PRODUCTS[0], sellingPrice: 111 };
    await saveProduct(product);
    const stored = mockProducts;
    expect(stored.filter(p => p.id === product.id)).toHaveLength(1);
  });
});

describe("deleteProduct (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockProducts = [...DEFAULT_PRODUCTS];
  });

  it("removes a product by id", async () => {
    await deleteProduct("p1");
    const stored = mockProducts;
    expect(stored.find(p => p.id === "p1")).toBeUndefined();
  });

  it("keeps other products intact", async () => {
    await deleteProduct("p1");
    const stored = mockProducts;
    expect(stored).toHaveLength(DEFAULT_PRODUCTS.length - 1);
    expect(stored[0].id).toBe("p2");
  });
});

describe("addStockAdjustment (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockProducts = [...DEFAULT_PRODUCTS];
  });

  it("increases stock and adds a batch layer for positive qty", async () => {
    const before = mockProducts.find(p => p.id === "p1").stock;
    await addStockAdjustment({ productId: "p1", qty: 5, reason: "Restock", note: "test" });
    const after = mockProducts.find(p => p.id === "p1");
    expect(after.stock).toBe(before + 5);
    expect(after.batches.some(b => b.quantity === 5 && b.costPrice === DEFAULT_PRODUCTS[0].costPrice)).toBe(true);
  });

  it("decreases stock for negative qty", async () => {
    const before = mockProducts.find(p => p.id === "p1").stock;
    await addStockAdjustment({ productId: "p1", qty: -5, reason: "Damage", note: "" });
    const after = mockProducts.find(p => p.id === "p1");
    expect(after.stock).toBe(before - 5);
  });

  it("never drops stock below zero", async () => {
    await addStockAdjustment({ productId: "p1", qty: -99999, reason: "Damage", note: "" });
    const after = mockProducts.find(p => p.id === "p1");
    expect(after.stock).toBe(0);
  });

  it("rejects zero or missing qty", async () => {
    await expect(addStockAdjustment({ productId: "p1", qty: 0 })).rejects.toThrow();
    await expect(addStockAdjustment({ productId: "p1" })).rejects.toThrow();
  });

  it("keeps box/loose stock consistent for cigarette products", async () => {
    const cig = mockProducts.find(p => p.id === "p4");
    await addStockAdjustment({ productId: "p4", qty: 40, reason: "Restock", note: "" });
    const after = mockProducts.find(p => p.id === "p4");
    expect(after.stock).toBe(cig.stock + 40);
    expect(after.stockPack * after.packSize + after.stockLoose).toBe(after.stock);
  });
});
