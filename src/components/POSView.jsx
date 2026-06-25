import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { useConfirm } from "../context/ConfirmContext";
import { playSaleSound } from "../utils/sound";
import ProductGrid from "./ProductGrid";
import CartSidebar from "./CartSidebar";
import MobileCartDrawer from "./MobileCartDrawer";
import VariantModal from "./VariantModal";
import { logError } from "../db/errorLog";
import CheckoutModal from "./CheckoutModal";
import QuickKeysBar from "./QuickKeysBar";

import ScanBarcode from "./ScanBarcode";
import DashboardWidgets from "./DashboardWidgets";
import ShortcutsModal from "./ShortcutsModal";

export default function POSView({ user }) {
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [showCheckout, setShowCheckout] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [receivedCash, setReceivedCash] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [promptpayNumber] = useState(localStorage.getItem("pan_promptpay_number") || "0912345678");
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState("");

  const getDiscountReasons = () => {
    try {
      const raw = localStorage.getItem("pan_discount_reasons");
      return raw ? JSON.parse(raw) : ["Loyalty Discount", "Festival Offer", "Damaged Product", "Bulk Purchase", "Staff Discount"];
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      console.error(err);
      return ["Loyalty Discount", "Festival Offer", "Damaged Product", "Bulk Purchase", "Staff Discount"];
    }
  };

  const getQuickKeys = () => {
    try {
      return JSON.parse(localStorage.getItem("pan_quick_keys") || "{}");
    } catch { return {}; }
  };

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const keys = getQuickKeys();
        const mapping = keys[`slot${num}`];
        if (!mapping) return;
        const product = products.find(p => p.id === mapping.productId);
        if (product) addToCart(product, mapping.isPack ? "pack" : null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [products]);

  const loadProducts = async () => {
    try {
      const list = await dbService.getProducts();
      setProducts(list);
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load products"));
      console.error(err);
    }
  };

  const loadCustomers = async () => {
    try {
      const list = await dbService.getCustomers();
      setCustomers(list);
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load customers"));
      console.error(err);
    }
  };

  const addToCart = (product, forcedVariant = null) => {
    if (product.isCigarette && !forcedVariant) {
      setVariantProduct(product);
      return;
    }

    const isPack = forcedVariant === "pack";
    const price = isPack ? product.sellingPricePack : product.sellingPrice;
    const cost = isPack ? product.costPricePack : product.costPrice;
    const requiredSticks = isPack ? (product.packSize || 20) : 1;

    if (product.stock < requiredSticks) {
      alert("Not enough stock available for this selection.");
      return;
    }

    setCart(prev => {
      const cartItemId = isPack ? `${product.id}_pack` : product.id;
      const existing = prev.find(item => item.productId === cartItemId);

      const totalSticksInCart = prev
        .filter(item => item.realProductId === product.id || item.productId === product.id)
        .reduce((sum, item) => sum + (item.quantity * (item.isPack ? (product.packSize || 20) : 1)), 0);

      if (totalSticksInCart + requiredSticks > product.stock) {
        alert("Cannot add more. Exceeds total available stock!");
        return prev;
      }

      if (existing) {
        return prev.map(item =>
          item.productId === cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, {
        productId: cartItemId,
        realProductId: product.id,
        name: product.name + (isPack ? " (Pack)" : " (Single)"),
        sellingPrice: price,
        costPrice: cost,
        quantity: 1,
        currentStock: product.stock,
        packSize: product.packSize || 20,
        isPack,
      }];
    });
  };

  const updateCartQty = (productId, change) => {
    setCart(prev => {
      const targetItem = prev.find(item => item.productId === productId);
      if (!targetItem) return prev;

      const newQty = targetItem.quantity + change;
      if (newQty <= 0) return prev.filter(item => item.productId !== productId);

      const targetRealId = targetItem.realProductId || targetItem.productId;
      const otherSticksInCart = prev
        .filter(item => (item.realProductId === targetRealId || item.productId === targetRealId) && item.productId !== productId)
        .reduce((sum, item) => sum + (item.quantity * (item.isPack ? (item.packSize || 20) : 1)), 0);

      const newSticksForTarget = newQty * (targetItem.isPack ? (targetItem.packSize || 20) : 1);

      if (otherSticksInCart + newSticksForTarget > targetItem.currentStock) {
        alert("Not enough stock available!");
        return prev;
      }

      return prev.map(item =>
        item.productId === productId
          ? { ...item, quantity: newQty }
          : item
      );
    });
  };

  const getCartSubtotal = () => {
    return cart.reduce((total, item) => total + (item.sellingPrice * item.quantity), 0);
  };

  const getTaxSettings = () => {
    const enabled = localStorage.getItem("pan_tax_enabled") === "true";
    const rate = parseFloat(localStorage.getItem("pan_tax_rate") || "7");
    return { enabled, rate };
  };

  const getTaxAmount = (subtotal) => {
    const { enabled, rate } = getTaxSettings();
    if (!enabled) return 0;
    return subtotal * (rate / 100);
  };

  const cartSubtotal = getCartSubtotal();
  const { enabled: taxEnabled, rate: taxRate } = getTaxSettings();
  const discountAmount = discountType === "percent"
    ? cartSubtotal * (Math.min(discountValue, 100) / 100)
    : discountType === "fixed"
      ? Math.min(discountValue, cartSubtotal)
      : 0;
  const discountedSubtotal = cartSubtotal - discountAmount;
  const taxAmountDisplay = getTaxAmount(discountedSubtotal);
  const cartTotal = discountedSubtotal + taxAmountDisplay;
  const changeToReturn = parseFloat(receivedCash) >= cartTotal ? (parseFloat(receivedCash) - cartTotal) : 0;

  const handleCashReceived = (amount) => {
    setReceivedCash(amount);
  };

  const handleAddQuickCash = (val) => {
    const current = parseFloat(receivedCash) || 0;
    setReceivedCash((current + val).toString());
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    try {
      await dbService.saveCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        balance: 0,
        ledger: [],
      });
      setNewCustomerName("");
      setNewCustomerPhone("");
      loadCustomers();
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to create customer"));
      console.error(err);
    }
  };

  const handleCheckoutSubmit = async () => {
    const subtotal = cartSubtotal;
    const { enabled: taxE, rate: taxR } = getTaxSettings();
    const taxAmt = getTaxAmount(discountedSubtotal);
    const total = discountedSubtotal + taxAmt;

    if (paymentMode === "Cash" && parseFloat(receivedCash) < total) {
      alert("Received cash must be greater or equal to total.");
      return;
    }
    if (paymentMode === "Udhaar" && !selectedCustomerId) {
      alert("Please select a customer for Udhaar.");
      return;
    }

    try {
      const transaction = {
        timestamp: Date.now(),
        items: cart,
        subtotal,
        discountType: discountType || null,
        discountValue: discountValue || 0,
        discountAmount,
        discountReason: discountReason || null,
        taxEnabled: taxE,
        taxRate: taxE ? taxR : 0,
        taxAmount: taxAmt,
        totalAmount: total,
        paymentMode,
        receivedAmount: paymentMode === "Cash" ? parseFloat(receivedCash) : total,
        changeAmount: paymentMode === "Cash" ? (parseFloat(receivedCash) - total) : 0,
        cashierEmail: user.email || "staff@pan.com",
        cashierId: user.id,
        cashierName: user.name,
      };

      if (paymentMode === "Udhaar") {
        transaction.customerId = selectedCustomerId;
        const customer = customers.find(c => c.id === selectedCustomerId);
        const ledgerEntry = {
          date: Date.now(),
          type: "Purchase",
          amount: total,
          description: `Bill processed with ${cart.length} items.`,
        };
        await dbService.updateUdhaarBalance(selectedCustomerId, total, ledgerEntry);
      }

      await dbService.addTransaction(transaction);

      setCart([]);
      setShowCheckout(false);
      setReceivedCash("");
      setSelectedCustomerId("");
      loadProducts();
      loadCustomers();
      playSaleSound();
      alert("Transaction completed successfully! ฿" + total);
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      alert("❌ " + (err.message || "Transaction failed"));
      console.error(err);
    }
  };

  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleClearCart = async () => {
    const ok = await confirm("Clear entire cart?", { title: "Clear Cart", confirmLabel: "Clear", variant: "danger" });
    if (ok) setCart([]);
  };

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
        <ScanBarcode products={products} onAddToCart={addToCart} />
        <button onClick={() => setShowShortcuts(true)} style={styles.shortcutBtn} title="Keyboard Shortcuts">⌨️</button>
      </div>
      <div className="pos-layout">
        <div>
          <QuickKeysBar products={products} onAddToCart={addToCart} />
          <ProductGrid products={products} onAddToCart={addToCart} />
        </div>

        <CartSidebar
          cart={cart}
          cartSubtotal={cartSubtotal}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          taxAmount={taxAmountDisplay}
          cartTotal={cartTotal}
          onUpdateQty={updateCartQty}
          onClear={handleClearCart}
          onCheckout={() => setShowCheckout(true)}
        />
      </div>

      <DashboardWidgets onNavigate={(tab) => { window.location.hash = tab; }} />

      {cart.length > 0 && (
        <div className="mobile-cart-summary-bar" onClick={() => setShowMobileCart(true)}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.2rem" }}>🛒</span>
            <span style={{ fontWeight: "bold" }}>{cart.reduce((sum, item) => sum + item.quantity, 0)} Items</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontWeight: "800", fontSize: "1.1rem" }}>฿{cartTotal.toFixed(2)}</span>
            <span style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold" }}>Review Order</span>
          </div>
        </div>
      )}

      {showMobileCart && cart.length > 0 && (
        <MobileCartDrawer
          cart={cart}
          cartSubtotal={cartSubtotal}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          taxAmount={taxAmountDisplay}
          cartTotal={cartTotal}
          onUpdateQty={updateCartQty}
          onClear={handleClearCart}
          onCheckout={() => setShowCheckout(true)}
          onClose={() => setShowMobileCart(false)}
        />
      )}

      {variantProduct && (
        <VariantModal
          product={variantProduct}
          onSelect={addToCart}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          cart={cart}
          cartSubtotal={cartSubtotal}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          taxAmount={taxAmountDisplay}
          cartTotal={cartTotal}
          paymentMode={paymentMode}
          receivedCash={receivedCash}
          selectedCustomerId={selectedCustomerId}
          customers={customers}
          newCustomerName={newCustomerName}
          newCustomerPhone={newCustomerPhone}
          promptpayNumber={promptpayNumber}
          changeToReturn={changeToReturn}
          onClose={() => setShowCheckout(false)}
          setPaymentMode={setPaymentMode}
          handleCashReceived={handleCashReceived}
          handleAddQuickCash={handleAddQuickCash}
          setSelectedCustomerId={setSelectedCustomerId}
          setNewCustomerName={setNewCustomerName}
          setNewCustomerPhone={setNewCustomerPhone}
          handleCreateCustomer={handleCreateCustomer}
          handleCheckoutSubmit={handleCheckoutSubmit}
          discountType={discountType}
          discountValue={discountValue}
          discountReason={discountReason}
          setDiscountType={setDiscountType}
          setDiscountValue={setDiscountValue}
          setDiscountReason={setDiscountReason}
          discountReasons={getDiscountReasons()}
          discountAmount={discountAmount}
          finalTotal={cartTotal}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

const styles = {
  shortcutBtn: {
    background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px",
    padding: "0.4rem 0.5rem", cursor: "pointer", fontFamily: "inherit",
    fontSize: "0.85rem", lineHeight: 1,
  },
  container: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
};
