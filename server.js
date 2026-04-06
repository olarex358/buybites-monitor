require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Monitor Engine Active"))
  .catch(err => console.error("❌ DB Error:", err));

// --- MODELS ---
const User = mongoose.model('User', new mongoose.Schema({ walletBalance: Number }));

const AdminStats = mongoose.model('AdminStats', new mongoose.Schema({
  peyflexManual: { type: Number, default: 0 },
  korapayManual: { type: Number, default: 0 },
  smeManual: { type: Number, default: 0 },
  useAutoSync: { type: Boolean, default: false }
}));

// --- API: FETCH OVERVIEW ---
app.get('/api/v1/overview', async (req, res) => {
  try {
    // 1. Get User Liability
    const userStats = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);
    const liability = userStats[0]?.total || 0;

    // 2. Get Admin Settings/Manual Balances
    let stats = await AdminStats.findOne();
    if (!stats) stats = await AdminStats.create({});

    let peyflex = stats.peyflexManual;
    let korapay = stats.korapayManual;
    let sme = stats.smeManual;
    let source = stats.useAutoSync ? 'LIVE' : 'MANUAL';

    // 3. Optional Auto-Sync (Only if enabled)
    if (stats.useAutoSync) {
      try {
        const peyRes = await axios.get("https://client.peyflex.com.ng/api/wallet/balance/", {
          headers: { "Authorization": `Token ${process.env.PEYFLEX_TOKEN}` },
          timeout: 3000
        });
        peyflex = parseFloat(peyRes.data.wallet_balance || 0);
      } catch (e) { source = 'LIVE (FALLBACK TO MANUAL)'; }
    }

    const totalAssets = peyflex + korapay + sme;

    res.json({
      peyflex,
      korapay,
      sme,
      liability,
      totalAssets,
      netProfit: totalAssets - liability,
      source,
      useAutoSync: stats.useAutoSync
    });
  } catch (error) {
    res.status(500).json({ error: "Sync Error" });
  }
});

// --- API: UPDATE BALANCES ---
app.post('/api/v1/update-balances', async (req, res) => {
  try {
    const { peyflex, korapay, sme, useAutoSync } = req.body;
    await AdminStats.findOneAndUpdate({}, {
      peyflexManual: peyflex,
      korapayManual: korapay,
      smeManual: sme,
      useAutoSync
    }, { upsert: true });
    res.json({ message: "Balances Locked In" });
  } catch (e) { res.status(500).json({ error: "Update Failed" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));