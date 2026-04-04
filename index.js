const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- DB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Monitor connected to BuyBites DB"))
  .catch(err => console.error("Database connection failed:", err));

// --- MINIMAL SCHEMAS (To avoid breaking your main app) ---
const User = mongoose.model('User', new mongoose.Schema({
  walletBalance: { type: Number, default: 0 },
  fullName: String,
  phone: String
}));

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  amount: Number,
  costPrice: Number, // Your main app must save this for profit tracking
  status: String,    // 'SUCCESS', 'FAILED', 'PENDING'
  network: String,   // 'MTN', 'GLO', etc.
  createdAt: { type: Date, default: Date.now }
}));

// --- SECURITY MIDDLEWARE ---
const authorizeAdmin = (req, res, next) => {
  const secret = req.headers['x-admin-key'];
  if (secret !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ message: "Access Denied: Invalid Key" });
  }
  next();
};

// --- ROUTES ---

// 1. THE OVERVIEW (Liability vs. Provider Balance)
app.get('/api/v1/monitor/overview', authorizeAdmin, async (req, res) => {
  try {
    // Get total money users have in BuyBites
    const userStats = await User.aggregate([
      { $group: { _id: null, totalLiability: { $sum: "$walletBalance" }, count: { $sum: 1 } } }
    ]);

    // Get your actual cash in Peyflex
    const pflex = await axios.get("https://peyflex.com.ng/api/user/", {
      headers: { "Authorization": `Token ${process.env.PEYFLEX_TOKEN}` }
    });

    res.json({
      totalUsers: userStats[0]?.count || 0,
      userLiability: userStats[0]?.totalLiability || 0,
      peyflexBalance: pflex.data.wallet_balance,
      netLiquidity: pflex.data.wallet_balance - (userStats[0]?.totalLiability || 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. THE PROFIT ENGINE (Daily/Weekly/Monthly)
app.get('/api/v1/monitor/analytics', authorizeAdmin, async (req, res) => {
  const { period } = req.query; // e.g., 'today', 'week', 'month'
  let startDate = new Date();
  
  if (period === 'today') startDate.setHours(0,0,0,0);
  else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);

  try {
    const stats = await Transaction.aggregate([
      { $match: { status: 'SUCCESS', createdAt: { $gte: startDate } } },
      { $group: {
          _id: null,
          revenue: { $sum: "$amount" },
          cost: { $sum: "$costPrice" },
          salesCount: { $sum: 1 }
      }},
      { $project: {
          revenue: 1,
          salesCount: 1,
          profit: { $subtract: ["$revenue", "$cost"] },
          margin: { $multiply: [{ $divide: [{ $subtract: ["$revenue", "$cost"] }, "$revenue"] }, 100] }
      }}
    ]);
    res.json(stats[0] || { revenue: 0, profit: 0, salesCount: 0, margin: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. MANUAL OVERRIDE: DIRECT CREDIT (For Cash Transfers)
app.post('/api/v1/monitor/credit-user', authorizeAdmin, async (req, res) => {
  const { phone, amount, reason } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { phone: phone },
      { $inc: { walletBalance: amount } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // Log the manual credit in your transactions for history
    await Transaction.create({
      amount: amount,
      costPrice: 0, // Manual credit has no "cost" to you initially
      status: 'SUCCESS',
      type: 'MANUAL_CREDIT',
      phone: phone,
      remark: reason
    });

    res.json({ message: `Successfully credited ${user.fullName} with ₦${amount}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`BuyBites Monitor API live on port ${PORT}`));