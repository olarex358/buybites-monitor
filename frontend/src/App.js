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

  const toggleService = async () => {
    try {
      await axios.post(`${API_URL}/toggle-service`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) { alert("Toggle failed"); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!token) {
    return (
      <div className="container" style={{paddingTop: '100px'}}>
        <div className="card">
          <h3>Admin Login</h3>
          <form onSubmit={handleLogin}>
            <input type="password" placeholder="Enter Secret Key" value={secretInput} onChange={e => setSecretInput(e.target.value)} required />
            <button className="action-btn">Unlock Command Center</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <h2>BuyBites Command</h2>
          <button onClick={() => {localStorage.removeItem('adminToken'); setToken(null);}} style={{background: 'none', border: 'none', color: '#ef4444'}}>Logout</button>
        </div>
        <div className="tabs">
          <button className={`tab-btn ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>Monitor</button>
          <button className={`tab-btn ${view === 'controls' ? 'active' : ''}`} onClick={() => setView('controls')}>System Controls</button>
        </div>
      </header>

      {view === 'overview' ? (
        <main>
          {data?.isLowBalance && <div className="card danger" style={{borderLeft: 'none', textAlign: 'center'}}>⚠️ PEYFLEX BALANCE LOW! ⚠️</div>}
          
          <div className={`card ${data?.netLiquidity >= 0 ? 'success' : 'danger'}`}>
            <div className="label">Total Net Liquidity</div>
            <div className="value">₦{data?.netLiquidity?.toLocaleString()}</div>
          </div>

          <div className="stats-row">
            <div className="mini-card">
              <div className="label">Peyflex</div>
              <div className="value">₦{data?.peyflexBalance?.toLocaleString()}</div>
            </div>
            <div className="mini-card">
              <div className="label">User Liability</div>
              <div className="value">₦{data?.userLiability?.toLocaleString()}</div>
            </div>
          </div>
        </main>
      ) : (
        <main className="card">
          <h3>System Kill-Switch</h3>
          <p style={{fontSize: '12px', color: '#94a3b8'}}>This will stop all new transactions on the main BuyBites app.</p>
          <button 
            onClick={toggleService} 
            className="action-btn" 
            style={{background: data?.serviceEnabled ? '#ef4444' : '#22c55e'}}
          >
            {data?.serviceEnabled ? "SHUTDOWN SERVICES" : "ACTIVATE SERVICES"}
          </button>
        </main>
      )}

      <footer style={{marginTop: '30px', textAlign: 'center'}}>
        <button className="btn-secondary" onClick={fetchData} disabled={loading}>
          {loading ? "Syncing..." : "Sync Now"}
        </button>
      </footer>
    </div>
  );
}

export default App;