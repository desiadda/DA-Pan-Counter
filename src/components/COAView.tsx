import { useEffect, useMemo, useState, useCallback } from "react";
import { useDBStore } from "../stores/dbStore";
import { useLangStore } from "../stores/langStore";
import { useConfirmStore } from "../stores/confirmStore";
import ModalPortal from "./ModalPortal";
import { dbService } from "../firebase";
import { getUsers } from "../db/auth";
import { useT } from "../lang/translations";

const TYPE_LABELS = ["asset", "liability", "equity", "income", "expense"];
const TYPE_ORDER = { asset: 0, liability: 1, equity: 2, income: 3, expense: 4 };

function fmt(n: number) {
  return "฿" + (isFinite(n) ? n.toFixed(2) : "0.00");
}

function fmtDate(ts: number) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function csvEscape(v: string) {
  return '"' + String(v).replace(/"/g, '""') + '"';
}

export default function COAView({ user }) {
  const tr = useT(useLangStore((s) => s.lang));
  const confirm = useConfirmStore((s) => s.confirm);

  const products = useDBStore((s) => s.products);
  const customers = useDBStore((s) => s.customers);
  const transactions = useDBStore((s) => s.transactions);

  const [suppliers, setSuppliers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cohBalances, setCohBalances] = useState([]);
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", type: "asset", openingBalance: "", description: "" });

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryTarget, setEntryTarget] = useState(null);
  const [entryForm, setEntryForm] = useState({ date: Date.now(), debit: "", credit: "", note: "" });

  const [stmtAccountId, setStmtAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const refresh = useCallback(() => {
    Promise.all([
      dbService.getCoaAccounts(),
      dbService.getCoaEntries(),
      dbService.getSuppliers(),
      dbService.getBanks(),
      dbService.getExpenses(),
      dbService.getAllBalances(),
    ]).then(([accs, ents, sups, bks, exps, coh]) => {
      setAccounts(accs);
      setEntries(ents);
      setSuppliers(sups || []);
      setBanks(bks || []);
      setExpenses(exps || []);
      setCohBalances(coh || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handleChanged = () => refresh();
    window.addEventListener("coa-changed", handleChanged);
    return () => window.removeEventListener("coa-changed", handleChanged);
  }, [refresh]);

  useEffect(() => {
    if (accounts.length && !stmtAccountId) setStmtAccountId(accounts[0].id);
  }, [accounts, stmtAccountId]);

  const liveBalances = useMemo(() => {
    const b = {};
    let cash = 0;
    (cohBalances || []).forEach(c => { cash += c.balance || 0; });
    b["coh"] = cash;
    b["bank"] = (banks || []).reduce((s, x) => s + (x.balance || 0), 0);
    b["receivable"] = (customers || []).reduce((s, c) => s + (c.balance || 0), 0);
    b["inventory"] = (products || []).reduce((s, p) => s + (p.stock || 0) * (p.costPrice || 0), 0);
    b["payable"] = (suppliers || []).reduce((s, x) => s + (x.balance || 0), 0);
    b["sales"] = (transactions || []).filter(t => t.type !== "return" && !t.isReturn).reduce((s, t) => s + (t.totalAmount || t.amount || 0), 0);
    b["sales"] -= (transactions || []).filter(t => t.type === "return" || t.isReturn).reduce((s, t) => s + (t.amount || t.totalAmount || 0), 0);
    b["expenses"] = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
    return b;
  }, [cohBalances, banks, customers, products, suppliers, transactions, expenses]);

  const accountBalances = useMemo(() => {
    const map = {};
    accounts.forEach(a => {
      if (a.system) {
        map[a.id] = liveBalances[a.source] || 0;
      } else {
        const isCreditType = a.type === "liability" || a.type === "equity" || a.type === "income";
        let bal = a.openingBalance || 0;
        entries.filter(e => e.accountId === a.id).forEach(e => {
          if (isCreditType) {
            bal += (e.credit || 0) - (e.debit || 0);
          } else {
            bal += (e.debit || 0) - (e.credit || 0);
          }
        });
        map[a.id] = bal;
      }
    });
    return map;
  }, [accounts, entries, liveBalances]);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      if (TYPE_ORDER[a.type] !== TYPE_ORDER[b.type]) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
      return String(a.code).localeCompare(String(b.code));
    });
  }, [accounts]);

  const trial = useMemo(() => {
    let debit = 0, credit = 0;
    const rows = sortedAccounts.map(a => {
      const bal = accountBalances[a.id] || 0;
      const isDebitType = a.type === "asset" || a.type === "expense";
      if (bal >= 0) {
        if (isDebitType) debit += bal; else credit += bal;
        return { a, debit: isDebitType ? bal : 0, credit: isDebitType ? 0 : bal, bal };
      }
      if (isDebitType) { credit += -bal; return { a, debit: 0, credit: -bal, bal }; }
      debit += -bal; return { a, debit: -bal, credit: 0, bal };
    });
    return { rows, debit, credit, diff: Math.abs(debit - credit) };
  }, [sortedAccounts, accountBalances]);

  const openAdd = () => {
    setEditAccount(null);
    setForm({ code: "", name: "", type: "asset", openingBalance: "", description: "" });
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditAccount(a);
    setForm({ code: a.code, name: a.name, type: a.type, openingBalance: a.openingBalance || "", description: a.description || "" });
    setShowForm(true);
  };

  const submitAccount = async () => {
    if (!form.code.trim()) { alert(tr("coa.codeRequired")); return; }
    if (!form.name.trim()) { alert(tr("coa.nameRequired")); return; }
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type,
      openingBalance: parseFloat(form.openingBalance) || 0,
      description: form.description.trim(),
      system: false,
    };
    if (editAccount) payload.id = editAccount.id;
    await dbService.saveCoaAccount(payload);
    setShowForm(false);
    refresh();
  };

  const removeAccount = async (a) => {
    if (a.system) { alert(tr("coa.cannotDeleteSystem")); return; }
    const ok = await confirm(tr("coa.deleteAccountConfirm"), {
      title: tr("coa.deleteAccount"), confirmLabel: tr("coa.deleteAccount"), variant: "danger",
    });
    if (!ok) return;
    await dbService.deleteCoaAccount(a.id);
    refresh();
  };

  const openEntry = (a) => {
    setEntryTarget(a);
    setEntryForm({ date: Date.now(), debit: "", credit: "", note: "" });
    setShowEntryForm(true);
  };

  const submitEntry = async () => {
    const debit = parseFloat(entryForm.debit) || 0;
    const credit = parseFloat(entryForm.credit) || 0;
    if (debit <= 0 && credit <= 0) { alert(tr("coa.notBalanced")); return; }
    if (debit > 0 && credit > 0) { alert(tr("coa.notBalanced")); return; }
    await dbService.addCoaEntry({
      accountId: entryTarget.id,
      date: entryForm.date || Date.now(),
      debit, credit,
      note: entryForm.note.trim(),
    });
    setShowEntryForm(false);
    refresh();
  };

  const removeEntry = async (e) => {
    const ok = await confirm(tr("coa.deleteEntry"), { confirmLabel: tr("coa.deleteEntry"), variant: "danger" });
    if (!ok) return;
    await dbService.deleteCoaEntry(e.id);
    refresh();
  };

  const stmt = useMemo(() => {
    const acc = accounts.find(a => a.id === stmtAccountId);
    if (!acc) return { acc: null, rows: [], opening: 0, closing: 0, totalDebit: 0, totalCredit: 0 };
    const from = fromDate ? new Date(fromDate + "T00:00:00").getTime() : 0;
    const to = toDate ? new Date(toDate + "T23:59:59").getTime() : Infinity;
    const isCredit = acc.type === "liability" || acc.type === "equity" || acc.type === "income";
    let opening = acc.openingBalance || 0;
    let totalDebit = 0, totalCredit = 0;
    const rows = entries
      .filter(e => e.accountId === acc.id && e.date >= from && e.date <= to)
      .map(e => ({ ...e, dr: e.debit || 0, cr: e.credit || 0 }))
      .sort((a, b) => (a.date || 0) - (b.date || 0));
    let running = opening;
    rows.forEach(e => {
      totalDebit += e.dr;
      totalCredit += e.cr;
      running += isCredit ? (e.cr - e.dr) : (e.dr - e.cr);
      e.balance = running;
    });
    const closing = running;
    return { acc, rows, opening, closing, totalDebit, totalCredit };
  }, [accounts, entries, stmtAccountId, fromDate, toDate]);

  const downloadCsv = () => {
    if (!stmt.acc) return;
    let running = stmt.opening;
    const lines = [
      [csvEscape("Account"), csvEscape(stmt.acc.code), csvEscape(stmt.acc.name)].join(","),
      [csvEscape("Date"), csvEscape("Note"), csvEscape("Debit"), csvEscape("Credit"), csvEscape("Balance")].join(","),
      ...stmt.rows.map(r => {
        running += r.dr - r.cr;
        return [csvEscape(fmtDate(r.date)), csvEscape(r.note || ""), r.dr || "", r.cr || "", running.toFixed(2)].join(",");
      }),
      ["", "TOTAL", stmt.totalDebit, stmt.totalCredit, stmt.closing].join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coa-${stmt.acc.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printStatement = () => {
    if (!stmt.acc) return;
    const storeName = (() => { try { return JSON.parse(localStorage.getItem("pan_store_settings") || "{}").name || "Paan Counter"; } catch { return "Paan Counter"; } })();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${stmt.acc.name}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h2{margin:0 0 2px} .muted{color:#666;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}
      th{background:#f3f4f6} td:first-child,th:first-child{text-align:left}
      .t{font-weight:700;background:#f9fafb}
    </style></head><body>
      <h2>${storeName}</h2>
      <div class="muted">${stmt.acc.code} · ${stmt.acc.name} — ${new Date().toLocaleString()}</div>
      <table><tr><th>Date</th><th>Note</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
      <tr><td colspan="4">Opening Balance B/F</td><td>${stmt.opening.toFixed(2)}</td></tr>
      ${stmt.rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${r.note || ""}</td><td>${r.dr ? r.dr.toFixed(2) : ""}</td><td>${r.cr ? r.cr.toFixed(2) : ""}</td><td>${r.balance.toFixed(2)}</td></tr>`).join("")}
      <tr class="t"><td colspan="2">Total</td><td>${stmt.totalDebit.toFixed(2)}</td><td>${stmt.totalCredit.toFixed(2)}</td><td>${stmt.closing.toFixed(2)}</td></tr>
      <tr><td colspan="4">Closing Balance C/F</td><td>${stmt.closing.toFixed(2)}</td></tr>
      </table><script>window.print();</script></body></html>`);
    w.document.close();
  };

  const TYPE_ICON = { asset: "🏦", liability: "💳", equity: "📊", income: "📈", expense: "📉" };

  const groups = useMemo(() => {
    const g = {};
    TYPE_LABELS.forEach(t => g[t] = []);
    sortedAccounts.forEach(a => g[a.type].push(a));
    return g;
  }, [sortedAccounts]);

  if (loading) return <div className="empty-state" style={{ padding: "3rem", textAlign: "center" }}>{tr("common.loading")}…</div>;

  return (
    <div className="view-container coa-view">
      <div className="view-header">
        <h2>📒 {tr("coa.title")}</h2>
        <div className="view-tabs">
          {[
            { key: "accounts", label: tr("coa.accounts") },
            { key: "trial", label: tr("coa.trialBalance") },
            { key: "statement", label: tr("coa.statement") },
          ].map(t => (
            <button key={t.key} className={`view-tab ${activeTab === t.key ? "view-tab-active" : ""}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "accounts" && (
        <>
          <div className="card coa-toolbar">
            <span>{tr("coa.accounts")}</span>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>＋ {tr("coa.addAccount")}</button>
          </div>
          {TYPE_LABELS.map(t => {
            const list = groups[t];
            if (!list || !list.length) return null;
            const total = list.reduce((s, a) => s + (accountBalances[a.id] || 0), 0);
            return (
              <div key={t} className="card" style={{ marginBottom: 12 }}>
                <div className="card-header">
                  <span>{TYPE_ICON[t]} {tr("coa." + t)} <span className="text-muted">({list.length})</span></span>
                  <span className="coa-badge coa-badge-info coa-mono">{fmt(total)}</span>
                </div>
                <table>
                  <thead>
                    <tr><th>{tr("coa.code")}</th><th>{tr("coa.name")}</th><th>{tr("coa.balance")}</th><th></th></tr>
                  </thead>
                  <tbody>
                    {list.map(a => (
                      <tr key={a.id}>
                        <td className="text-muted coa-mono">{a.code}</td>
                        <td>
                          {a.name}
                          {a.system
                            ? <span className="coa-badge coa-badge-live" style={{ marginLeft: 6 }}>🔗 {tr("coa.live")}</span>
                            : <span className="coa-badge coa-badge-manual" style={{ marginLeft: 6 }}>{tr("coa.manual")}</span>}
                        </td>
                        <td className="coa-mono">{fmt(accountBalances[a.id] || 0)}</td>
                        <td className="coa-actions">
                          {!a.system && (
                            <>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>✏️ {tr("common.edit")}</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEntry(a)}>＋ {tr("coa.addEntry")}</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeAccount(a)}>🗑 {tr("common.delete")}</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!list.length && <div className="empty-state">{tr("common.noData")}</div>}
              </div>
            );
          })}
        </>
      )}

      {activeTab === "trial" && (
        <div className="card">
          <div className="card-header">
            <span>{tr("coa.trialBalance")}</span>
            <span className={`coa-badge ${trial.diff < 0.01 ? "coa-badge-ok" : "coa-badge-warn"}`}>
              {trial.diff < 0.01 ? "✓ " + tr("coa.balanced") : "⚠ " + tr("coa.notBalanced")}
            </span>
          </div>
          <table>
            <thead>
              <tr><th>{tr("coa.code")}</th><th>{tr("coa.name")}</th><th>{tr("coa.type")}</th><th>{tr("coa.debit")}</th><th>{tr("coa.credit")}</th></tr>
            </thead>
            <tbody>
              {trial.rows.map(({ a, debit, credit }) => (
                <tr key={a.id}>
                  <td className="text-muted coa-mono">{a.code}</td>
                  <td>{a.name}{a.system && <span className="coa-badge coa-badge-live" style={{ marginLeft: 6 }}>🔗</span>}</td>
                  <td className="text-muted">{tr("coa." + a.type)}</td>
                  <td className="coa-mono">{debit ? fmt(debit) : ""}</td>
                  <td className="coa-mono">{credit ? fmt(credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="coa-total-row">
                <td colSpan={3}>{tr("coa.total")}</td>
                <td className="coa-mono">{fmt(trial.debit)}</td>
                <td className="coa-mono">{fmt(trial.credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeTab === "statement" && (
        <div className="card">
          <div className="card-header coa-stmt-filters">
            <select className="input-field" style={{ maxWidth: 240 }} value={stmtAccountId} onChange={e => setStmtAccountId(e.target.value)}>
              {sortedAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <input type="date" className="input-field" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span className="text-muted">→</span>
            <input type="date" className="input-field" value={toDate} onChange={e => setToDate(e.target.value)} />
            <span style={{ flex: 1 }} />
            <button className="btn btn-outline btn-sm" onClick={downloadCsv}>⬇ {tr("common.download")}</button>
            <button className="btn btn-outline btn-sm" onClick={printStatement}>🖨 {tr("common.print")}</button>
          </div>
          {stmt.acc && (
            <div className="coa-stmt-meta">
              <span className="coa-badge coa-badge-info">{stmt.acc.code} · {stmt.acc.name}</span>
              <span className="coa-badge coa-badge-manual">{tr("coa.openingBalance")}: {fmt(stmt.opening)}</span>
              <span className="coa-badge coa-badge-ok">{tr("coa.outstanding")}: {fmt(stmt.closing)}</span>
              {stmt.acc.system && <span className="coa-badge coa-badge-warn">🔗 {tr("coa.systemAccountHint")}</span>}
            </div>
          )}
          <table>
            <thead>
              <tr><th>{tr("coa.date")}</th><th>{tr("coa.note")}</th><th>{tr("coa.debit")}</th><th>{tr("coa.credit")}</th><th>{tr("coa.runningBalance")}</th>{!stmt.acc?.system && <th></th>}</tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="text-muted">{tr("coa.openingBalance")} B/F</td>
                <td className="coa-mono">{fmt(stmt.opening)}</td>
                {!stmt.acc?.system && <td></td>}
              </tr>
              {stmt.rows.map(r => (
                <tr key={r.id}>
                  <td className="text-muted">{fmtDate(r.date)}</td>
                  <td>{r.note || "—"}</td>
                  <td className="coa-mono">{r.dr ? fmt(r.dr) : ""}</td>
                  <td className="coa-mono">{r.cr ? fmt(r.cr) : ""}</td>
                  <td className="coa-mono">{fmt(r.balance)}</td>
                  {!stmt.acc?.system && <td className="coa-actions"><button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeEntry(r)}>🗑</button></td>}
                </tr>
              ))}
              {!stmt.rows.length && <tr><td colSpan={6} className="empty-state">{tr("common.noData")}</td></tr>}
            </tbody>
            <tfoot>
              <tr className="coa-total-row">
                <td colSpan={2}>{tr("coa.total")}</td>
                <td className="coa-mono">{fmt(stmt.totalDebit)}</td>
                <td className="coa-mono">{fmt(stmt.totalCredit)}</td>
                <td className="coa-mono">{fmt(stmt.closing)}</td>
                {!stmt.acc?.system && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showForm && (
        <ModalPortal onClose={() => setShowForm(false)}>
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content coa-modal" onClick={e => e.stopPropagation()}>
              <div className="coa-modal-title">
                <span>{editAccount ? tr("coa.editAccount") : tr("coa.addAccount")}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.code")}</label>
                <input className="input-field" placeholder="e.g. 1100" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.name")}</label>
                <input className="input-field" placeholder="e.g. Petty Cash" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.accountType")}</label>
                <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {TYPE_LABELS.map(t => <option key={t} value={t}>{tr("coa." + t)}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.openingBalance")}</label>
                <input className="input-field" type="number" placeholder="0.00" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.description")}</label>
                <input className="input-field" placeholder={tr("common.optional")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="coa-modal-actions">
                <button className="btn btn-outline" onClick={() => setShowForm(false)}>{tr("common.cancel")}</button>
                <button className="btn btn-primary" onClick={submitAccount}>{tr("common.save")}</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {showEntryForm && entryTarget && (
        <ModalPortal onClose={() => setShowEntryForm(false)}>
          <div className="modal-overlay" onClick={() => setShowEntryForm(false)}>
            <div className="modal-content coa-modal" onClick={e => e.stopPropagation()}>
              <div className="coa-modal-title">
                <span>{tr("coa.addEntry")} — {entryTarget.code} {entryTarget.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEntryForm(false)}>✕</button>
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.date")}</label>
                <input type="date" className="input-field" value={entryForm.date ? new Date(entryForm.date).toISOString().slice(0, 10) : ""} onChange={e => setEntryForm({ ...entryForm, date: new Date(e.target.value + "T12:00:00").getTime() })} />
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.debit")} (฿)</label>
                <input className="input-field" type="number" placeholder="0.00" value={entryForm.debit} onChange={e => setEntryForm({ ...entryForm, debit: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.credit")} (฿)</label>
                <input className="input-field" type="number" placeholder="0.00" value={entryForm.credit} onChange={e => setEntryForm({ ...entryForm, credit: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">{tr("coa.note")}</label>
                <input className="input-field" placeholder="e.g. Rent payment" value={entryForm.note} onChange={e => setEntryForm({ ...entryForm, note: e.target.value })} />
              </div>
              <div className="coa-modal-actions">
                <button className="btn btn-outline" onClick={() => setShowEntryForm(false)}>{tr("common.cancel")}</button>
                <button className="btn btn-primary" onClick={submitEntry}>{tr("common.save")}</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
