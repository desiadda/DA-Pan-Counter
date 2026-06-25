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

  useEffect(() => { loadExpenses(); }, []);

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
      await dbService.addExpense({ amount: parseFloat(amount), category, note: note.trim(), date: Date.now() });
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
    const ok = await confirm("Delete this expense entry?", { title: "Delete Expense", confirmLabel: "Delete", variant: "danger" });
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

  const getCategoryTotal = (cat) => expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="content-section">
      <h2 className="section-title">Expense Tracking</h2>

      <div className="card">
        <h3 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>Add Expense</h3>
        <form onSubmit={handleAdd} className="flex-col gap-md">
          <div className="input-group">
            <label className="input-label">Amount (฿)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" className="input-field" />
          </div>
          <div className="input-group">
            <label className="input-label">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly electricity bill" className="input-field" />
          </div>
          <button type="submit" className="btn btn-primary">Add Expense</button>
        </form>
      </div>

      <div className="card">
        <h3 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>Overview</h3>
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-label">Total Expenses</span>
            <span className="stat-value stat-value-error">฿{totalExpenses.toFixed(2)}</span>
            <span className="stat-sub">{expenses.length} entries</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Highest Category</span>
            <span className="stat-value" style={{ fontSize: "0.9rem", color: "var(--text)" }}>
              {categories.map(c => ({ cat: c, total: getCategoryTotal(c) })).sort((a, b) => b.total - a.total)[0]?.cat || "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>Category Breakdown</h3>
        <div className="flex-col gap-sm">
          {categories.map((cat) => {
            const catTotal = getCategoryTotal(cat);
            const pct = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
            return (
              <div key={cat} className="breakdown-row">
                <span className="breakdown-label">{cat}</span>
                <div className="breakdown-bar">
                  <div className="breakdown-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="breakdown-amount">฿{catTotal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>History</h3>
        {loading ? (
          <div className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>Loading...</div>
        ) : expenses.length === 0 ? (
          <div className="coh-empty">No expenses recorded yet.</div>
        ) : (
          <div className="coh-tx-list" style={{ maxHeight: "300px" }}>
            {expenses.map((exp) => (
              <div key={exp.id} className="expense-item">
                <div className="expense-left">
                  <span className="expense-category">{exp.category}</span>
                  <span className="expense-note">{exp.note || "—"} · {new Date(exp.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="expense-amount">฿{exp.amount.toFixed(2)}</span>
                  <button onClick={() => handleDelete(exp.id)} className="btn-icon" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
