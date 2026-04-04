require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to BuyBites DB"))
  .catch(err => console.error("❌ DB Connection Error:", err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  walletBalance: { type: Number, default: 0 },
  fullName: String,
  phone: String
}));

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  amount: Number,
  costPrice: { type: Number, default: 0 },
  status: String,
  type: String, // 'sme', 'airtime', 'data'
  network: String,
  phone: String,
  createdAt: { type: Date, default: Date.now }
}));

// Middleware
const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-key'];
  if (secret !== process.env.ADMIN_SECRET_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
};

// 1. Monitor Overview
app.get('/api/v1/overview', adminAuth, async (req, res) => {
  try {
    const userStats = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);
    const pFlex = await axios.get("https://peyflex.com.ng/api/user/", {
      headers: { "Authorization": `Token ${process.env.PEYFLEX_TOKEN}` }
    });
    const liability = userStats[0]?.total || 0;
    const balance = pFlex.data.wallet_balance;

    res.json({
      userLiability: liability,
      peyflexBalance: balance,
      netLiquidity: balance - liability
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 2. Profit Analytics with SME Breakdown
app.get('/api/v1/analytics', adminAuth, async (req, res) => {
  const { period } = req.query; 
  let startDate = new Date();
  if (period === 'today') startDate.setHours(0,0,0,0);
  else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);

  try {
    const stats = await Transaction.aggregate([
      { $match: { status: 'SUCCESS', createdAt: { $gte: startDate } } },
      { $group: {
          _id: "$type", 
          revenue: { $sum: "$amount" },
          cost: { $sum: "$costPrice" }
      }}
    ]);
    res.json({
      profit: stats.reduce((acc, curr) => acc + (curr.revenue - curr.cost), 0),
      breakdown: stats
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Manual Credit
app.post('/api/v1/credit-user', adminAuth, async (req, res) => {
  const { phone, amount, reason } = req.body;
  try {
    const user = await User.findOneAndUpdate({ phone }, { $inc: { walletBalance: amount } }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    await Transaction.create({ amount, costPrice: 0, status: 'SUCCESS', type: 'MANUAL_CREDIT', phone, remark: reason });
    res.json({ message: `Credited ₦${amount} to ${user.fullName}` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Monitor live on ${PORT}`));