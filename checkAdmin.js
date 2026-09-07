require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const admin = await User.findOne({
      email: 'adminexample@gmail.com'
    }).select('-password');

    if (!admin) {
      console.log('❌ Admin account NOT found');
    } else {
      console.log('✅ Admin found:');
      console.log({
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        accountStatus: admin.accountStatus,
        isEmailVerified: admin.isEmailVerified
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAdmin();