const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const DeliveryPersonnel = require('../models/DeliveryPersonnel');
const sendEmail = require('../utils/sendEmail');
const generateToken = require('../utils/generateToken');
const { protect, authorize } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation, forgotPasswordValidation } = require('../validators/authValidators');


const checkValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return true; 
  }
  return false;
};


router.post('/register', registerValidation, async (req, res) => {
  try {
    if (checkValidation(req, res)) return;

    const { name, email, password, phone, role, address } = req.body;

   
    const safeRole = ['customer', 'vendor', 'delivery'].includes(role) ? role : 'customer';

    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken  = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

    const user = await User.create({
      name,
      email:               email.toLowerCase(),
      password:            hashedPassword,
      phone:               phone || '',
      role:                safeRole,
      address:             address || '',
      
      accountStatus:       'active',
      isEmailVerified:     false,
      verificationToken,
      verificationExpires,
    });

   
    if (safeRole === 'vendor') {
      await Vendor.create({
        user:             user._id,
        restaurantName:   req.body.restaurantName || `${name}'s Kitchen`,
        description:      '',
        phone:            phone || '',
        address:          address || '',
        approvalStatus:   'approved',
        verificationStatus: 'verified',
      });
    }

    if (safeRole === 'delivery') {
      await DeliveryPersonnel.create({
        user:               user._id,
        phone:              phone || '',
        verificationStatus: 'pending',
        vehicleDetails: {
          vehicleType: 'Car',
          licensePlate: '',
          model: '',
        },
      });
    }

    
    const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    sendEmail({
      to:      user.email,
      subject: 'Verify your BiteExpress account',
      text:    `Hello ${name},\n\nVerify your account: ${verifyUrl}`,
      html:    `<p>Hello <strong>${name}</strong>,</p><p>Click below to verify your BiteExpress account:</p><p><a href="${verifyUrl}" style="background:#f26b38;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Verify Email</a></p><p>Link expires in 24 hours.</p>`,
    }); 

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        user: {
          id:              user._id,
          name:            user.name,
          email:           user.email,
          role:            user.role,
          accountStatus:   user.accountStatus,
          isEmailVerified: user.isEmailVerified,
          phone:           user.phone,
          address:         user.address,
        },
      },
    });
  } catch (error) {
    console.error('[POST /auth/register] Error:', error);
    
    const message = process.env.NODE_ENV === 'production'
      ? 'Registration failed. Please try again.'
      : (error.message || 'Registration failed');
    return res.status(500).json({ success: false, message });
  }
});


router.post('/login', loginValidation, async (req, res) => {
  try {
    if (checkValidation(req, res)) return;

    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact support.' });
    }

   
    if (user.role === 'vendor' && user.accountStatus === 'pending') {
      
      
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id:              user._id,
          name:            user.name,
          email:           user.email,
          role:            user.role,
          accountStatus:   user.accountStatus,
          isEmailVerified: user.isEmailVerified,
          phone:           user.phone,
          address:         user.address,
        },
      },
    });
  } catch (error) {
    console.error('[POST /auth/login] Error:', error);
    const message = process.env.NODE_ENV === 'production'
      ? 'Login failed. Please try again.'
      : (error.message || 'Login failed');
    return res.status(500).json({ success: false, message });
  }
});


router.get('/me', protect, async (req, res) => {
  try {
    res.json({ success: true, data: req.user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to fetch profile.' });
  }
});


router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    const user = await User.findOne({
      verificationToken:   token,
      verificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification token is invalid or has expired.' });
    }

    user.isEmailVerified      = true;
    user.verificationToken    = undefined;
    user.verificationExpires  = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Email verification failed.' });
  }
});


router.post('/forgot-password', forgotPasswordValidation, async (req, res) => {
  try {
    if (checkValidation(req, res)) return;

    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    
    if (!user) {
      return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken   = resetToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; 
    await user.save();

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    sendEmail({
      to:      user.email,
      subject: 'BiteExpress — password reset',
      text:    `Reset your password: ${resetLink}`,
      html:    `<p>You requested a password reset for your BiteExpress account.</p><p><a href="${resetLink}" style="background:#f26b38;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p><p>Link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    }); 

    res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Password reset request failed.' });
  }
});


router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
    }

    user.password             = await bcrypt.hash(password, 10);
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
});


router.post('/admin/create', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Admin password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const admin = await User.create({
      name,
      email:           email.toLowerCase(),
      password:        hashedPassword,
      role:            'admin',
      accountStatus:   'active',
      isEmailVerified: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully.',
      data: {
        id:    admin._id,
        name:  admin.name,
        email: admin.email,
        role:  admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create admin account.' });
  }
});

module.exports = router;
