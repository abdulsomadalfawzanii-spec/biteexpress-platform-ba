require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function activateAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const admin = await User.findOneAndUpdate(
      { email: 'abdulsomadabdulsemiu8@gmail.com', role: 'admin' },
      {
        accountStatus: 'active',
        isEmailVerified: true
      },
      { new: true }
    ).select('-password');

    if (!admin) {
      console.log('❌ Admin account not found');
      return;
    }

    console.log('✅ Admin account activated:');
    console.log({
      name: admin.name,
      email: admin.email,
      role: admin.role,
      accountStatus: admin.accountStatus,
      isEmailVerified: admin.isEmailVerified
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

activateAdmin();