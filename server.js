require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- DB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Command Center Connected"))
  .catch(err => console.error("❌ DB Error:", err));

// --- MODELS ---
const User = mongoose.model('User', new mongoose.Schema({ walletBalance: Number }));

// --- SIMPLIFIED LOGIN ---
app.post('/api/v1/login', (req, res) => {
  const { secretKey } = req.body;
  const VALID_KEY = process.env.ADMIN_SECRET_KEY || "admin123";
  
  if (secretKey === VALID_KEY) {
    return res.json({ authenticated: true });
  }
  res.status(401).json({ error: "Unauthorized" });
});

// --- DASHBOARD DATA ---
app.get('/api/v1/overview', async (req, res) => {
  try {
    // 1. Calculate Liability (Sum of all user balances)
    const userStats = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);
    const liability = userStats[0]?.total || 0;

    // 2. Fetch Peyflex Balance
    let peyflexBal = 0;
    let source = 'OFFLINE';
    try {
      const peyRes = await axios.get("https://client.peyflex.com.ng/api/wallet/balance/", {
        headers: { "Authorization": `Token ${process.env.PEYFLEX_TOKEN}` },
        timeout: 4000
      });
      peyflexBal = parseFloat(peyRes.data.wallet_balance || 0);
      source = 'LIVE';
    } catch (err) {
      console.log("Peyflex API Timeout - showing 0");
    }

    // 3. Send Response (Variable names must match App.js)
    res.json({
      userLiability: liability,
      peyflexBalance: peyflexBal,
      peyflexSource: source,
      netLiquidity: peyflexBal - liability
    });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));