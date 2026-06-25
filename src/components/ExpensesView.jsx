import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { useConfirm } from "../context/ConfirmContext";
import { logError } from "../db/errorLog";

export default function ExpensesView() {
  const confirm = useConfirm();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Supplies");
  const [note, setNote] = useState("");

  const categories = dbService.EXPENSE_CATEGORIES;

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const list = await dbService.getExpenses();
      setExpenses(list);
    } catch (err) {
      logError("EXPENSE", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load expenses"));
      console.error(err);
    }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    try {
      await dbService.addExpense({
        amount: parseFloat(amount),
        category,
        note: note.trim(),
        date: Date.now(),
      });
      setAmount("");
      setNote("");
      loadExpenses();
      alert("Expense recorded!");
    } catch (err) {
      logError("EXPENSE", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to add expense"));
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this expense entry?", {
      title: "Delete Expense",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) {
      try {
        await dbService.deleteExpense(id);
        loadExpenses();
    } catch (err) {
      logError("EXPENSE", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to delete expense"));
      console.error(err);
    }
    }
  };

  const getCategoryTotal = (cat) => {
    return expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div style={styles.container}>
      <h2 style={styles.viewTitle}>Expense Tracking</h2>

      <div style={styles.card}>
        <h3 style={styles.formTitle}>Add Expense</h3>
        <form onSubmit={handleAdd} style={styles.formGrid}>
          <div className="input-group">
            <label className="input-label">Amount (฿)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Monthly electricity bill"
              className="input-field"
            />
          </div>

          <button type="submit" className="btn btn-primary">Add Expense</button>
        </form>
      </div>

      <div style={styles.card}>
        <h3 style={styles.formTitle}>Overview</h3>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Total Expenses</span>
            <span style={styles.statValue}>฿{totalExpenses.toFixed(2)}</span>
            <span style={styles.statSub}>{expenses.length} entries</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Highest Category</span>
            <span style={styles.statValue}>
              {categories
                .map((c) => ({ cat: c, total: getCategoryTotal(c) }))
                .sort((a, b) => b.total - a.total)[0]?.cat || "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.formTitle}>Category Breakdown</h3>
        <div style={styles.breakdownGrid}>
          {categories.map((cat) => {
            const catTotal = getCategoryTotal(cat);
            const pct = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
            return (
              <div key={cat} style={styles.breakdownRow}>
                <span style={styles.breakdownLabel}>{cat}</span>
                <div style={styles.barContainer}>
                  <div style={{ ...styles.bar, width: `${pct}%` }} />
                </div>
                <span style={styles.breakdownAmount}>฿{catTotal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.formTitle}>History</h3>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : expenses.length === 0 ? (
          <div style={styles.empty}>No expenses recorded yet.</div>
        ) : (
          <div style={styles.list}>
            {expenses.map((exp) => (
              <div key={exp.id} style={styles.listItem}>
                <div style={styles.listLeft}>
                  <span style={styles.expCategory}>{exp.category}</span>
                  <span style={styles.expNote}>{exp.note || "—"}</span>
                  <span style={styles.expDate}>{new Date(exp.date).toLocaleDateString()}</span>
                </div>
                <div style={styles.listRight}>
                  <span style={styles.expAmount}>฿{exp.amount.toFixed(2)}</span>
                  <button onClick={() => handleDelete(exp.id)} style={styles.delBtn}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" },
  viewTitle: { color: "#047857", fontSize: "1.25rem", fontWeight: "bold" },
  card: {
    backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1",
    padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  formTitle: { fontSize: "1rem", marginBottom: "1rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" },
  formGrid: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  statsGrid: { display: "flex", gap: "0.75rem" },
  statCard: {
    flex: 1, padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "8px",
    border: "1px solid #e2e8f0", display: "flex", flexDirection: "column",
  },
  statLabel: { fontSize: "0.75rem", color: "#64748b", fontWeight: "bold" },
  statValue: { fontSize: "1.1rem", fontWeight: "800", color: "#dc2626", marginTop: "0.25rem" },
  statSub: { fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" },
  breakdownGrid: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  breakdownRow: { display: "flex", alignItems: "center", gap: "0.75rem" },
  breakdownLabel: { fontSize: "0.8rem", fontWeight: "600", width: "100px", color: "#475569" },
  barContainer: { flex: 1, height: "12px", backgroundColor: "#f1f5f9", borderRadius: "99px", overflow: "hidden" },
  bar: { height: "100%", backgroundColor: "#ef4444", borderRadius: "99px", transition: "width 0.3s ease" },
  breakdownAmount: { fontSize: "0.8rem", fontWeight: "700", color: "#1e293b", width: "80px", textAlign: "right" },
  loading: { textAlign: "center", padding: "2rem", color: "#64748b" },
  empty: { textAlign: "center", padding: "2rem", color: "#94a3b8" },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" },
  listItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0.6rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0",
  },
  listLeft: { display: "flex", flexDirection: "column", gap: "2px" },
  expCategory: { fontSize: "0.8rem", fontWeight: "bold", color: "#1e293b" },
  expNote: { fontSize: "0.75rem", color: "#64748b" },
  expDate: { fontSize: "0.65rem", color: "#94a3b8" },
  listRight: { display: "flex", alignItems: "center", gap: "0.5rem" },
  expAmount: { fontSize: "0.9rem", fontWeight: "800", color: "#dc2626" },
  delBtn: {
    background: "none", border: "none", color: "#94a3b8", cursor: "pointer",
    fontSize: "0.9rem", padding: "2px",
  },
};
