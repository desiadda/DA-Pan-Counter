import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db/config", () => ({
  isFirebaseEnabled: false,
  db: null,
  auth: null,
}));

const { getProducts, saveProduct, deleteProduct } = await import("../db/products");
const { DEFAULT_PRODUCTS } = await import("../constants");

describe("getProducts (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default products when localStorage is empty", async () => {
    const products = await getProducts();
    expect(products).toEqual(DEFAULT_PRODUCTS);
  });

  it("returns stored products when localStorage has data", async () => {
    const custom = [{ id: "p_custom", name: "Custom", category: "Other", sellingPrice: 10 }];
    localStorage.setItem("pan_products", JSON.stringify(custom));
    const products = await getProducts();
    expect(products).toEqual(custom);
  });
});

describe("saveProduct (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a new product without an id", async () => {
    await saveProduct({ name: "New Item", category: "Other", sellingPrice: 50 });
    const products = JSON.parse(localStorage.getItem("pan_products"));
    expect(products.length).toBe(9);
    const added = products.find(p => p.name === "New Item");
    expect(added).toBeTruthy();
    expect(added.id).toMatch(/^p_/);
  });

  it("updates an existing product with matching id", async () => {
    const products = [...DEFAULT_PRODUCTS];
    products[0].sellingPrice = 999;
    await saveProduct(products[0]);
    const stored = JSON.parse(localStorage.getItem("pan_products"));
    const updated = stored.find(p => p.id === products[0].id);
    expect(updated.sellingPrice).toBe(999);
  });

  it("does not duplicate product on update", async () => {
    const product = { ...DEFAULT_PRODUCTS[0], sellingPrice: 111 };
    await saveProduct(product);
    const stored = JSON.parse(localStorage.getItem("pan_products"));
    expect(stored.filter(p => p.id === product.id)).toHaveLength(1);
  });
});

describe("deleteProduct (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pan_products", JSON.stringify(DEFAULT_PRODUCTS));
  });

  it("removes a product by id", async () => {
    await deleteProduct("p1");
    const stored = JSON.parse(localStorage.getItem("pan_products"));
    expect(stored.find(p => p.id === "p1")).toBeUndefined();
  });

  it("keeps other products intact", async () => {
    await deleteProduct("p1");
    const stored = JSON.parse(localStorage.getItem("pan_products"));
    expect(stored).toHaveLength(DEFAULT_PRODUCTS.length - 1);
    expect(stored[0].id).toBe("p2");
  });
});
