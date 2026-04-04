require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// JWT Secret - Add this to your Render Environment Variables
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

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
  amount: Number, costPrice: Number, status: String, type: String, phone: String, createdAt: { type: Date, default: Date.now }
}));

// New Model for Global Controls
const SystemSetting = mongoose.model('SystemSetting', new mongoose.Schema({
  serviceEnabled: { type: Boolean, default: true },
  lowBalanceThreshold: { type: Number, default: 2000 }
}));

// --- AUTH MIDDLEWARE ---
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ error: "No token provided" });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Unauthorized" });
    next();
  });
};

// --- ROUTES ---

// 1. Login Route
app.post('/api/v1/login', (req, res) => {
  const { secretKey } = req.body;
  if (secretKey === process.env.ADMIN_SECRET_KEY) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  }
  res.status(401).json({ error: "Invalid Secret Key" });
});

// 2. Overview with Low Balance Alert Logic
app.get('/api/v1/overview', verifyToken, async (req, res) => {
  try {
    const userStats = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);
    const settings = await SystemSetting.findOne() || await SystemSetting.create({});
    
    const pFlex = await axios.get("https://client.peyflex.com.ng/api/wallet/balance/", {
      headers: { "Authorization": `Token ${process.env.PEYFLEX_TOKEN}` }
    });

    const balance = parseFloat(pFlex.data.wallet_balance || 0);
    const liability = userStats[0]?.total || 0;

    // Logic for Low Balance Alert (Can be extended to send Email/SMS)
    const isLow = balance < settings.lowBalanceThreshold;

    res.json({
      userLiability: liability,
      peyflexBalance: balance,
      netLiquidity: balance - liability,
      serviceEnabled: settings.serviceEnabled,
      isLowBalance: isLow
    });
  } catch (error) { res.status(500).json({ error: "Overview Sync Failed" }); }
});

// 3. Toggle Service (Kill-switch)
app.post('/api/v1/toggle-service', verifyToken, async (req, res) => {
  try {
    const settings = await SystemSetting.findOne();
    settings.serviceEnabled = !settings.serviceEnabled;
    await settings.save();
    res.json({ enabled: settings.serviceEnabled });
  } catch (err) { res.status(500).send(); }
});

// (Keep your existing /analytics and /credit-user routes, but update them to use verifyToken)

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Command Center live on ${PORT}`));