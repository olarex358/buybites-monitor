require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();

// FIXED CORS: Explicitly allowing localhost and all origins for easier mobile testing
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Monitor Engine Active"))
  .catch(err => console.error("❌ DB Error:", err));

// --- MODELS ---
const User = mongoose.model('User', new mongoose.Schema({ walletBalance: Number }));

// Stores your manual entries and settings
const AdminStats = mongoose.model('AdminStats', new mongoose.Schema({
  peyflexManual: { type: Number, default: 0 },
  korapayManual: { type: Number, default: 0 },
  smeManual: { type: Number, default: 0 },
  useAutoSync: { type: Boolean, default: false }
}));

// --- API: FETCH OVERVIEW ---
app.get('/api/v1/overview', async (req, res) => {
  try {
    // 1. Calculate Liability from actual User balances
    const userStats = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);
    const liability = userStats[0]?.total || 0;

    // 2. Get saved manual balances
    let stats = await AdminStats.findOne();
    if (!stats) stats = await AdminStats.create({});

    let peyflex = stats.peyflexManual;
    let korapay = stats.korapayManual;
    let sme = stats.smeManual;
    let source = stats.useAutoSync ? 'LIVE' : 'MANUAL';

    // 3. API Sync (Only if toggled ON)
    if (stats.useAutoSync) {
      try {
        const peyRes = await axios.get("https://client.peyflex.com.ng/api/wallet/balance/", {
          headers: { "Authorization": `Token ${process.env.PEYFLEX_TOKEN}` },
          timeout: 4000
        });
        peyflex = parseFloat(peyRes.data.wallet_balance || 0);
      } catch (e) { 
        source = 'LIVE (FALLBACK TO MANUAL)'; 
      }
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
      peyflexManual: Number(peyflex),
      korapayManual: Number(korapay),
      smeManual: Number(sme),
      useAutoSync
    }, { upsert: true });
    res.json({ message: "Balances Updated" });
  } catch (e) { 
    res.status(500).json({ error: "Update Failed" }); 
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));