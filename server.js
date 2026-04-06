require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.error("❌ DB Error:", err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  walletBalance: { type: Number, default: 0 }
}));

const SystemSetting = mongoose.model('SystemSetting', new mongoose.Schema({
  serviceEnabled: { type: Boolean, default: true },
  manualBalance: { type: Number, default: 0 },
  useManual: { type: Boolean, default: false }
}));

// GET OVERVIEW
app.get('/api/v1/overview', async (req, res) => {
  try {
    const userStats = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$walletBalance" } } }
    ]);

    const liability = userStats[0]?.total || 0;

    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({});
    }

    let peyflexBal = 0;
    let source = 'OFFLINE';

    if (settings.useManual) {
      peyflexBal = settings.manualBalance;
      source = 'MANUAL';
    } else {
      try {
        const peyRes = await axios.get(
          "https://client.peyflex.com.ng/api/wallet/balance/",
          {
            headers: { Authorization: `Token ${process.env.PEYFLEX_TOKEN}` },
            timeout: 5000
          }
        );

        peyflexBal = parseFloat(peyRes.data.wallet_balance || 0);
        source = 'LIVE';
      } catch (err) {
        console.log("⚠️ Peyflex failed, fallback to manual");
        peyflexBal = settings.manualBalance;
        source = 'FALLBACK';
      }
    }

    const profit = peyflexBal - liability;

    res.json({
      userLiability: liability,
      peyflexBalance: peyflexBal,
      peyflexSource: source,
      netLiquidity: profit,
      profit,
      serviceEnabled: settings.serviceEnabled,
      useManual: settings.useManual
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// UPDATE MANUAL BALANCE
app.post('/api/v1/manual', async (req, res) => {
  const { manualBalance, useManual } = req.body;

  let settings = await SystemSetting.findOne();
  if (!settings) settings = new SystemSetting();

  settings.manualBalance = manualBalance;
  settings.useManual = useManual;

  await settings.save();

  res.json({ message: "Updated" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));