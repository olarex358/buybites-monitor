import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = "https://buybites-admin-monitor.onrender.com";

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [passKey, setPassKey] = useState(localStorage.getItem('bb_key') || '');
  const [view, setView] = useState('monitor');
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const sync = async () => {
    if (!passKey) return;
    setLoading(true);
    const config = { headers: { 'x-admin-key': passKey } };
    try {
      const [ov, an] = await Promise.all([
        axios.get(`${API_URL}/overview`, config),
        axios.get(`${API_URL}/analytics?period=${period}`, config)
      ]);
      setData({ ...ov.data, analytics: an.data });
      setIsLocked(false);
      localStorage.setItem('bb_key', passKey);
    } catch (err) {
      if (err.response?.status === 401) alert("Wrong Key!");
    }
    setLoading(false);
  };

  useEffect(() => { if (!isLocked) sync(); }, [period]);

  if (isLocked) {
    return (
      <div className="container" style={{display: 'flex', alignItems: 'center', height: '80vh'}}>
        <div className="card" style={{width: '100%'}}>
          <h2>BuyBites Admin</h2>
          <input type="password" value={passKey} onChange={e => setPassKey(e.target.value)} placeholder="Enter Admin Key" />
          <button className="action-btn" onClick={sync}>Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="tabs">
          <button className={`tab-btn ${view === 'monitor' ? 'active' : ''}`} onClick={() => setView('monitor')}>Monitor</button>
          <button className={`tab-btn ${view === 'actions' ? 'active' : ''}`} onClick={() => setView('actions')}>Actions</button>
        </div>
      </header>

      {view === 'monitor' ? (
        <main>
          <div className={`card ${data?.netLiquidity >= 0 ? 'success' : 'danger'}`}>
            <div className="label">Net Liquidity</div>
            <div className="value">₦{data?.netLiquidity?.toLocaleString()}</div>
          </div>
          <div className="stats-row">
            <div className="mini-card"><div className="label">Peyflex</div><div className="value" style={{fontSize: '18px'}}>₦{data?.peyflexBalance?.toLocaleString()}</div></div>
            <div className="mini-card"><div className="label">Liability</div><div className="value" style={{fontSize: '18px'}}>₦{data?.userLiability?.toLocaleString()}</div></div>
          </div>
          <div className="card" style={{marginTop: '20px', borderLeftColor: 'var(--success)'}}>
            <div className="tabs">
              {['today', 'week', 'month'].map(p => (
                <button key={p} className={`tab-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
            <div className="label">{period} Profit</div>
            <div className="value">₦{data?.analytics?.profit?.toLocaleString()}</div>
            {data?.analytics?.breakdown?.map(item => (
              <div key={item._id} style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '5px'}}>
                <span>{item._id || 'Airtime'}</span>
                <span style={{fontWeight: 'bold'}}>₦{(item.revenue - item.cost).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </main>
      ) : (
        <ManualCredit onComplete={sync} passKey={passKey} />
      )}
      <button className="action-btn" style={{marginTop: '20px', background: '#334155'}} onClick={sync}>{loading ? '...' : 'Sync Now'}</button>
    </div>
  );
}

function ManualCredit({ onComplete, passKey }) {
  const [f, setF] = useState({ phone: '', amount: '', reason: 'Cash Transfer' });
  const sub = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/credit-user`, f, { headers: { 'x-admin-key': passKey } });
      alert("Success");
      onComplete();
    } catch (err) { alert("Failed"); }
  };
  return (
    <div className="card">
      <h3>Manual Credit</h3>
      <form onSubmit={sub}>
        <input type="text" placeholder="Phone" onChange={e => setF({...f, phone: e.target.value})} required />
        <input type="number" placeholder="Amount" onChange={e => setF({...f, amount: e.target.value})} required />
        <button type="submit" className="action-btn">Send</button>
      </form>
    </div>
  );
}

export default App;