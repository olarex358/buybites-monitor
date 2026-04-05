require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'buybites_admin_secret_2026';

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Command Center Connected"))
  .catch(err => console.error("❌ DB Error:", err));

// --- MODELS ---
const User = mongoose.model('User', new mongoose.Schema({
  walletBalance: { type: Number, default: 0 },
  fullName: String,
  phone: String
}));

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  amount: Number,
  status: String,
  createdAt: { type: Date, default: Date.now }
}));

const SystemSetting = mongoose.model('SystemSetting', new mongoose.Schema({
  serviceEnabled: { type: Boolean, default: true }
}));

const BalanceSnapshot = mongoose.model('BalanceSnapshot', new mongoose.Schema({
  platform: { type: String, enum: ['PEYFLEX', 'SME_DATA'] },
  balance: Number,
  type: { type: String, enum: ['AUTO', 'MANUAL'] },
  updatedAt: { type: Date, default: Date.now }
}));

// --- PROFIT CONFIGURATION (Zero-Touch Mapping) ---
const COST_STRUCTURE = {
  "300": 235,   // 1GB MTN costs 235
  "600": 470,   // 2GB
  "1500": 1175, // 5GB
  "200": 165,   // Small data
  "500": 415    // 1.5GB
};

// --- AUTH MIDDLEWARE ---
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid Session" });
    next();
  });
};

// --- ROUTES ---

app.post('/api/v1/login', (req, res) => {
  const { secretKey } = req.body;
  if (secretKey === process.env.ADMIN_SECRET_KEY) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  }
  res.status(401).json({ error: "Invalid Key" });
});

app.get('/api/v1/overview', verifyToken, async (req, res) => {
  try {
    const userStats = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);
    const settings = await SystemSetting.findOne() || await SystemSetting.create({});
    const sales = await Transaction.find({ status: 'SUCCESS' }).lean();

    // 1. Profit Calculation
    let totalRevenue = 0, totalCost = 0;
    sales.forEach(tx => {
      totalRevenue += tx.amount;
      totalCost += COST_STRUCTURE[tx.amount.toString()] || (tx.amount * 0.92);
    });

    // 2. Smart-Sync Wallet Helper
    const getBalance = async (platform) => {
      try {
        const url = platform === 'PEYFLEX' ? "https://client.peyflex.com.ng/api/wallet/balance/" : "https://smedata.ng/api/v1/user";
        const token = platform === 'PEYFLEX' ? process.env.PEYFLEX_TOKEN : process.env.SME_DATA_TOKEN;
        const apiRes = await axios.get(url, { headers: { "Authorization": `Token ${token}` }, timeout: 4000 });
        const bal = parseFloat(apiRes.data.wallet_balance || apiRes.data.balance || 0);
        return { bal, source: 'LIVE' };
      } catch (err) {
        const manual = await BalanceSnapshot.findOne({ platform, type: 'MANUAL' }).sort({ updatedAt: -1 });
        return { bal: manual ? manual.balance : 0, source: 'OFFLINE/MANUAL' };
      }
    };

    const peyflex = await getBalance('PEYFLEX');
    const sme = await getBalance('SME_DATA');
    const liability = userStats[0]?.total || 0;

    res.json({
      userLiability: liability,
      wallets: { peyflex, sme },
      netLiquidity: (peyflex.bal + sme.bal) - liability,
      realTimeProfit: totalRevenue - totalCost,
      totalRevenue,
      serviceEnabled: settings.serviceEnabled
    });
  } catch (error) { res.status(500).json({ error: "Overview Sync Failed" }); }
});

app.post('/api/v1/wallets/manual', verifyToken, async (req, res) => {
  const { platform, balance } = req.body;
  await BalanceSnapshot.create({ platform, balance, type: 'MANUAL' });
  res.json({ message: "Updated" });
});

app.post('/api/v1/toggle-service', verifyToken, async (req, res) => {
  const settings = await SystemSetting.findOne();
  settings.serviceEnabled = !settings.serviceEnabled;
  await settings.save();
  res.json({ enabled: settings.serviceEnabled });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Monitor live on ${PORT}`));

