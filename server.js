require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Command Center Connected"))
  .catch(err => console.error("❌ DB Error:", err));

// Models
const User = mongoose.model('User', new mongoose.Schema({ walletBalance: Number }));
const SystemSetting = mongoose.model('SystemSetting', new mongoose.Schema({ serviceEnabled: { type: Boolean, default: true } }));

// --- REMOVED LOGIN ROUTE & MIDDLEWARE ---

app.get('/api/v1/overview', async (req, res) => {
  try {
    // 1. Get User Liability
    const userStats = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);
    const liability = userStats[0]?.total || 0;

    // 2. Get Settings
    const settings = await SystemSetting.findOne() || { serviceEnabled: true };

    // 3. Fetch Peyflex Balance
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
      console.log("Peyflex API Timeout");
    }

    // 4. Send Unified Response
    res.json({
      userLiability: liability,
      peyflexBalance: peyflexBal,
      peyflexSource: source,
      netLiquidity: peyflexBal - liability,
      serviceEnabled: settings.serviceEnabled
    });
  } catch (error) {
    res.status(500).json({ error: "Sync Failed" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));