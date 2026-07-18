import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { hashPin } from "./hash";
import { logError } from "./errorLog";

export const factoryReset = async () => {
  try {
    // 1. Clear Local Storage keys
    const lsKeys = [
      "pan_user",
      "pan_users",
      "pan_products",
      "pan_customers",
      "pan_transactions",
      "pan_coh_balances",
      "pan_coh_transactions",
      "pan_expenses",
      "pan_suppliers",
      "pan_purchase_orders",
      "pan_shifts",
      "pan_price_history",
      "pan_error_logs",
      "pan_admin_pin",
      "pan_staff_pin"
    ];
    lsKeys.forEach(k => localStorage.removeItem(k));

    if (isFirebaseEnabled && db) {
      // List of collections to completely clear
      const collectionsToClear = [
        "products",
        "customers",
        "transactions",
        "coh_balances",
        "coh_transactions",
        "expenses",
        "suppliers",
        "purchases",
        "shifts",
        "price_history",
        "error_logs"
      ];

      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }
      }

      // Reset the users collection to contain only default Admin and Staff with default PINs
      const usersSnap = await getDocs(collection(db, "users"));
      if (!usersSnap.empty) {
        const userDeleteBatch = writeBatch(db);
        usersSnap.docs.forEach(docSnap => {
          userDeleteBatch.delete(docSnap.ref);
        });
        await userDeleteBatch.commit();
      }

      const defaultAdminPin = await hashPin("1234");
      const defaultStaffPin = await hashPin("5555");

      const defaultUsers = [
        {
          id: "u1",
          name: "Admin",
          email: "admin@pan.com",
          pin: defaultAdminPin,
          role: "admin",
          permissions: {
            pos: true,
            stock: true,
            khata: true,
            reports: true,
            expenses: true,
            settings: true
          }
        },
        {
          id: "u2",
          name: "Staff",
          email: "staff@pan.com",
          pin: defaultStaffPin,
          role: "staff",
          permissions: {
            pos: true,
            stock: false,
            khata: false,
            reports: false,
            expenses: false,
            settings: false
          }
        }
      ];

      const userCreateBatch = writeBatch(db);
      defaultUsers.forEach(u => {
        userCreateBatch.set(doc(db, "users", u.id), u);
      });
      await userCreateBatch.commit();
    }
  } catch (err) {
    logError("SYSTEM", `Factory reset failed: ${err.message}`, err.stack);
    throw err;
  }
};
