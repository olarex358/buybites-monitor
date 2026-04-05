import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = "https://buybites-admin-monitor.onrender.com/api/v1";

function App() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [secretInput, setSecretInput] = useState('');
  const [view, setView] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualAmt, setManualAmt] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, { secretKey: secretInput });
      localStorage.setItem('adminToken', res.data.token);
      setToken(res.data.token);
    } catch (err) { alert("Invalid Secret Key"); }
  };

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) setToken(null);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleService = async () => {
    try {
      const res = await axios.post(`${API_URL}/toggle-service`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(prev => ({ ...prev, serviceEnabled: res.data.enabled }));
    } catch (err) { alert("Action failed"); }
  };

  const handleManualUpdate = async (platform) => {
    if (!manualAmt) return alert("Enter balance");
    try {
      setLoading(true);
      await axios.post(`${API_URL}/wallets/manual`, 
        { platform, balance: parseFloat(manualAmt) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setManualAmt('');
      fetchData();
    } catch (err) { alert("Failed to update"); }
    finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin} className="card">
          <h2>BuyBites Admin</h2>
          <input type="password" placeholder="Admin Secret Key" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} />
          <button type="submit" className="action-btn">Enter Command Center</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>BuyBites Monitor</h1>
        <nav>
          <button onClick={() => setView('overview')} className={view === 'overview' ? 'active' : ''}>Finance</button>
          <button onClick={() => setView('controls')} className={view === 'controls' ? 'active' : ''}>Controls</button>
          <button onClick={() => { localStorage.removeItem('adminToken'); setToken(null); }} className="btn-secondary">Exit</button>
        </nav>
      </header>

      {view === 'overview' ? (
        <main>
          <div className="card success" style={{marginBottom: '15px', background: '#f0fdf4', border: '1px solid #bbf7d0'}}>
            <div className="label" style={{color: '#166534'}}>Real-Time Profit</div>
            <div className="value" style={{color: '#15803d'}}>₦{data?.realTimeProfit?.toLocaleString()}</div>
          </div>

          <div className={`card ${data?.netLiquidity >= 0 ? 'success' : 'danger'}`}>
            <div className="label">Total Net Liquidity</div>
            <div className="value">₦{data?.netLiquidity?.toLocaleString()}</div>
          </div>

          <div className="stats-row">
            <div className="mini-card">
              <div className="label">Peyflex ({data?.wallets?.peyflex?.source})</div>
              <div className="value">₦{data?.wallets?.peyflex?.bal?.toLocaleString()}</div>
            </div>
            <div className="mini-card">
              <div className="label">SME Data ({data?.wallets?.sme?.source})</div>
              <div className="value">₦{data?.wallets?.sme?.bal?.toLocaleString()}</div>
            </div>
          </div>

          <div className="card" style={{marginTop: '20px'}}>
             <h4>Manual Sync Fallback</h4>
             <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                <input type="number" placeholder="Actual Balance" value={manualAmt} onChange={(e) => setManualAmt(e.target.value)} style={{flex: 1}}/>
                <button onClick={() => handleManualUpdate('PEYFLEX')} className="btn-secondary">Peyflex</button>
                <button onClick={() => handleManualUpdate('SME_DATA')} className="btn-secondary">SME</button>
             </div>
          </div>
        </main>
      ) : (
        <main className="card">
          <h3>System Kill-Switch</h3>
          <button onClick={toggleService} className="action-btn" style={{background: data?.serviceEnabled ? '#ef4444' : '#22c55e'}}>
            {data?.serviceEnabled ? "SHUTDOWN SERVICES" : "ACTIVATE SERVICES"}
          </button>
        </main>
      )}

      <footer style={{marginTop: '30px', textAlign: 'center'}}>
        <button className="btn-secondary" onClick={fetchData} disabled={loading}>{loading ? "Syncing..." : "Sync Now"}</button>
      </footer>
    </div>
  );
}

export default App;

