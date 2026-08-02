import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { dbService } from "../firebase";
import { useConfirmStore } from "../stores/confirmStore";
import { useCartStore } from "../stores/cartStore";
import { useDBStore } from "../stores/dbStore";
import { playSaleSound } from "../utils/sound";
import ProductGrid from "./ProductGrid";
import CartSidebar from "./CartSidebar";
import VariantModal from "./VariantModal";
import { logError } from "../db/errorLog";
import CheckoutModal from "./CheckoutModal";
import ScanBarcode from "./ScanBarcode";
import DashboardWidgets from "./DashboardWidgets";
import ShortcutsModal from "./ShortcutsModal";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";
import { DEFAULT_VAT_RATE } from "../constants";

export default function POSView({ user }) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);
  const navigate = useNavigate();
  const confirm = useConfirmStore((s) => s.confirm);
  const openMobileCart = useCartStore((s) => s.openMobileCart);
  const updateMobileCartProps = useCartStore((s) => s.updateMobileCartProps);
  const mobileCartOpen = useCartStore((s) => s.mobileCartOpen);
  const closeMobileCart = useCartStore((s) => s.closeMobileCart);
  
  const products = useDBStore((s) => s.products);
  const customers = useDBStore((s) => s.customers);
  const [cart, setCart] = useState([]);

  const [showCheckout, setShowCheckout] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [receivedCash, setReceivedCash] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [settingsVersion, setSettingsVersion] = useState(0);
  useEffect(() => {
    const bump = () => setSettingsVersion(v => v + 1);
    window.addEventListener("settings-changed", bump);
    return () => window.removeEventListener("settings-changed", bump);
  }, []);
  const promptpayNumber = localStorage.getItem("pan_promptpay_number") || "";
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState("");

  const getDiscountReasons = () => {
    try {
      const raw = localStorage.getItem("pan_discount_reasons");
      return raw ? JSON.parse(raw) : [...DEFAULT_DISCOUNT_REASONS];
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      console.error(err);
      return [...DEFAULT_DISCOUNT_REASONS];
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
    const requiredSticks = isPack ? (product.packSize || DEFAULT_PACK_SIZE) : 1;
    const isUnlimited = product.isNonInventory || product.stock >= 9999;

    if (!isUnlimited && product.stock < requiredSticks) {
      alert("Not enough stock available for this selection.");
      return;
    }

    setCart(prev => {
      const cartItemId = isPack ? `${product.id}_pack` : product.id;
      const existing = prev.find(item => item.productId === cartItemId);

      const totalSticksInCart = prev
        .filter(item => item.realProductId === product.id || item.productId === product.id)
        .reduce((sum, item) => sum + (item.quantity * (item.isPack ? (product.packSize || DEFAULT_PACK_SIZE) : 1)), 0);

      if (!isUnlimited && totalSticksInCart + requiredSticks > product.stock) {
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
        isNonInventory: isUnlimited,
        packSize: product.packSize || DEFAULT_PACK_SIZE,
        isPack,
      }];
    });
  };

  const updateCartQty = (productId, change) => {
    setCart(prev => {
      const targetItem = prev.find(item => item.productId === productId);
      if (!targetItem) return prev;

      const newQty = targetItem.quantity + change;
      if (newQty <= 0) {
        const user = useAuthStore.getState().user;
        const _isAdmin = user?.role === "admin";
        if (user && !_isAdmin && !user.permissions?.posVoidCart) {
          alert("❌ You do not have permission to delete items from the cart.");
          return prev;
        }
        return prev.filter(item => item.productId !== productId);
      }

      const targetRealId = targetItem.realProductId || targetItem.productId;
      const otherSticksInCart = prev
        .filter(item => (item.realProductId === targetRealId || item.productId === targetRealId) && item.productId !== productId)
        .reduce((sum, item) => sum + (item.quantity * (item.isPack ? (item.packSize || DEFAULT_PACK_SIZE) : 1)), 0);

      const newSticksForTarget = newQty * (targetItem.isPack ? (targetItem.packSize || DEFAULT_PACK_SIZE) : 1);
      const isUnlimited = targetItem.isNonInventory || targetItem.currentStock >= 9999;

      if (!isUnlimited && otherSticksInCart + newSticksForTarget > targetItem.currentStock) {
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

  const getItemDiscountAmount = (item) => {
    const lineTotal = (item.sellingPrice || 0) * (item.quantity || 1);
    if (item.discountType === "percent") return lineTotal * Math.min(item.discountValue || 0, 100) / 100;
    if (item.discountType === "fixed") return Math.min(item.discountValue || 0, lineTotal);
    return 0;
  };

  const updateItemDiscount = (productId, discount) => {
    setCart(prev => prev.map(item =>
      item.productId === productId
        ? {
            ...item,
            discountType: discount.type || null,
            discountValue: discount.value || 0,
            discountReason: discount.reason || null,
          }
        : item
    ));
  };

  const getCartSubtotal = () => {
    return cart.reduce((total, item) => total + (item.sellingPrice * item.quantity) - getItemDiscountAmount(item), 0);
  };

  const getTaxSettings = () => {
    const enabled = localStorage.getItem("pan_tax_enabled") === "true";
    const rate = parseFloat(localStorage.getItem("pan_tax_rate") || String(DEFAULT_VAT_RATE));
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

  useEffect(() => {
    if (!mobileCartOpen) return;
    updateMobileCartProps({
      cart,
      cartSubtotal,
      taxEnabled,
      taxRate,
      taxAmount: taxAmountDisplay,
      cartTotal,
      onUpdateItemDiscount: updateItemDiscount,
      discountReasons: getDiscountReasons(),
    });
  }, [mobileCartOpen, cart, cartSubtotal, taxEnabled, taxRate, taxAmountDisplay, cartTotal, updateMobileCartProps]);

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
    if (paymentMode === UDHAAR_MODE && !selectedCustomerId) {
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

      if (paymentMode === UDHAAR_MODE) {
        transaction.customerId = selectedCustomerId;
        const customer = customers.find(c => c.id === selectedCustomerId);
        const ledgerEntry = {
          date: Date.now(),
          type: "Purchase",
          amount: total,
          description: `Bill processed with ${cart.length} items.`,
          recordedBy: user.name || "System",
        };
        await dbService.updateUdhaarBalance(selectedCustomerId, total, ledgerEntry);
      }

      await dbService.addTransaction(transaction);

      setCart([]);
      setShowCheckout(false);
      setReceivedCash("");
      setSelectedCustomerId("");
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
    const user = useAuthStore.getState().user;
    const _isAdmin = user?.role === "admin";
    if (user && !_isAdmin && !user.permissions?.posVoidCart) {
      alert("❌ You do not have permission to clear/void cart.");
      return;
    }
    const ok = await confirm("Clear entire cart?", { title: "Clear Cart", confirmLabel: "Clear", variant: "danger" });
    if (ok) setCart([]);
  };

  const handleOpenMobileCart = () => {
    const checkoutCb = () => setShowCheckout(true);
    openMobileCart({
      cart,
      cartSubtotal,
      taxEnabled,
      taxRate,
      taxAmount: taxAmountDisplay,
      cartTotal,
      onUpdateQty: updateCartQty,
      onClear: handleClearCart,
      onUpdateItemDiscount: updateItemDiscount,
      discountReasons: getDiscountReasons(),
    }, checkoutCb);
  };

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
        <ScanBarcode products={products} onAddToCart={addToCart} />
        <button onClick={() => setShowShortcuts(true)} style={styles.shortcutBtn} title="Keyboard Shortcuts">⌨️</button>
      </div>
      <div className="pos-layout">
        <div className="pos-main-col">
          <ProductGrid products={products} onAddToCart={addToCart} />
        </div>

        <div className="pos-cart-col">
          <CartSidebar
            cart={cart}
            cartSubtotal={cartSubtotal}
            taxEnabled={taxEnabled}
            taxRate={taxRate}
            taxAmount={taxAmountDisplay}
            cartTotal={cartTotal}
            onUpdateQty={updateCartQty}
            onClear={handleClearCart}
            onUpdateItemDiscount={updateItemDiscount}
            discountReasons={getDiscountReasons()}
            onCheckout={() => setShowCheckout(true)}
          />
        </div>
      </div>

      {/* ── Section Separator for Today's Summary / Dashboard Widgets ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        marginTop: "2rem",
        marginBottom: "1rem",
        borderTop: "2px dashed var(--border, #cbd5e1)",
        paddingTop: "1.25rem"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 800,
          fontSize: "0.95rem",
          color: "var(--primary, #047857)",
          letterSpacing: "0.02em"
        }}>
          <span style={{ fontSize: "1.1rem" }}>📊</span>
          <span>{tr("pos.todaySummary")}</span>
        </div>
        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border, #e2e8f0)" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)", fontStyle: "italic" }}>
          {tr("pos.summaryHint")}
        </span>
      </div>

      <div style={{
        backgroundColor: "var(--card-bg, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "16px",
        padding: "1.25rem",
        boxShadow: "0 2px 12px rgba(0,0,0,0.03)"
      }}>
        <DashboardWidgets onNavigate={(tab) => { navigate("/" + tab, { replace: true }); }} />
      </div>

      {cart.length > 0 && createPortal(
        <>
          <div className="mobile-cart-fab" onClick={handleOpenMobileCart}>
            🛒
            <span className="fab-count">{cart.reduce((s,i) => s + i.quantity, 0)}</span>
          </div>
          <div className="mobile-cart-bar" onClick={handleOpenMobileCart}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem" }}>🛒</span>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{cart.reduce((s,i) => s + i.quantity, 0)} Items</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 800, fontSize: "1rem" }}>฿{cartTotal.toFixed(2)}</span>
              <span className="cart-bar-arrow">→</span>
            </div>
          </div>
        </>,
        document.getElementById("app-modal-layer") || document.body
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
    padding: "0.5rem 0.65rem", cursor: "pointer", fontFamily: "inherit",
    fontSize: "0.85rem", lineHeight: 1,
  },
  container: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    paddingBottom: "16px",
  },
};
