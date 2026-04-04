import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

// Ensure this matches your Primary URL in Render exactly
const API_URL = "https://buybites-monitor.onrender.com/api/v1";
const ADMIN_KEY = "Olarewaju@1994"; // Must match Render's ADMIN_SECRET_KEY

function App() {
  const [view, setView] = useState('overview');
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState({ userLiability: 0, peyflexBalance: 0, netLiquidity: 0 });
  const [analytics, setAnalytics] = useState({ profit: 0, revenue: 0 });
  const [loading, setLoading] = useState(false);
  const [creditForm, setCreditForm] = useState({ phone: '', amount: '', reason: 'Cash Transfer' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const config = { headers: { 'x-admin-key': ADMIN_KEY } };
    try {
      const [ov, an] = await Promise.all([
        axios.get(`${API_URL}/overview`, config),
        axios.get(`${API_URL}/analytics?period=${period}`, config)
      ]);
      setData(ov.data);
      setAnalytics(an.data);
    } catch (err) { 
      console.error("Network Error:", err.message); 
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const handleManualCredit = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Credit ${creditForm.phone} with ₦${creditForm.amount}?`)) return;
    try {
      await axios.post(`${API_URL}/credit-user`, creditForm, {
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      alert("Credit Successful!");
      setCreditForm({ phone: '', amount: '', reason: 'Cash Transfer' });
      fetchData();
    } catch (err) { 
      alert(err.response?.data?.error || "Failed to credit user"); 
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h2>BuyBites Admin</h2>
        {loading && <div className="loading-bar">Syncing Live Data...</div>}
        <div className="tabs">
          <button className={`tab-btn ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>Monitor</button>
          <button className={`tab-btn ${view === 'actions' ? 'active' : ''}`} onClick={() => setView('actions')}>Actions</button>
        </div>
      </header>

      {view === 'overview' ? (
        <main>
          <div className={`card ${data.netLiquidity >= 0 ? 'success' : 'danger'}`}>
            <div className="label">Total Net Profit/Liquidity</div>
            <div className="value">₦{data.netLiquidity.toLocaleString()}</div>
          </div>

          <div className="stats-row">
            <div className="mini-card">
              <div className="label">Peyflex</div>
              <div className="value" style={{fontSize: '18px'}}>₦{data.peyflexBalance.toLocaleString()}</div>
            </div>
            <div className="mini-card">
              <div className="label">User Liability</div>
              <div className="value" style={{fontSize: '18px'}}>₦{data.userLiability.toLocaleString()}</div>
            </div>
          </div>

          <hr style={{margin: '30px 0', borderColor: '#334155'}} />
          
          <div className="label" style={{marginBottom: '10px'}}>Performance Analytics</div>
          <div className="tabs">
            {['today', 'week', 'month'].map(p => (
              <button key={p} className={`tab-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="card" style={{borderLeftColor: 'var(--success)'}}>
            <div className="label">{period.toUpperCase()} PROFIT</div>
            <div className="value">₦{analytics.profit.toLocaleString()}</div>
            <div className="label" style={{marginTop: '10px'}}>Revenue: ₦{analytics.revenue.toLocaleString()}</div>
          </div>
        </main>
      ) : (
        <main className="card">
          <h3>Manual Wallet Credit</h3>
          <form onSubmit={handleManualCredit}>
            <input type="text" value={creditForm.phone} onChange={e => setCreditForm({...creditForm, phone: e.target.value})} placeholder="User Phone Number" required />
            <input type="number" value={creditForm.amount} onChange={e => setCreditForm({...creditForm, amount: e.target.value})} placeholder="Amount (₦)" required />
            <select value={creditForm.reason} onChange={e => setCreditForm({...creditForm, reason: e.target.value})}>
              <option value="Cash Transfer">Direct Bank Transfer</option>
              <option value="Manual Refund">Failed Transaction Assist</option>
              <option value="Promo">Promotional Credit</option>
            </select>
            <button type="submit" className="action-btn">Apply Credit</button>
          </form>
        </main>
      )}

      <footer style={{marginTop: '30px', textAlign: 'center'}}>
        <button className="action-btn" style={{background: '#334155'}} onClick={fetchData}>Sync Now</button>
      </footer>
    </div>
  );
}

export default App;