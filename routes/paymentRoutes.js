const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');

router.post('/create-checkout-session', protect, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(501).json({ success: false, message: 'Stripe is not configured on this server yet.' });
    }

    const { orderId, currency = 'usd', successUrl, cancelUrl } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }
    const order = await Order.findOne({ _id: orderId, customer: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.paymentStatus === 'paid') return res.status(400).json({ success: false, message: 'Order is already paid' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Order ${orderId}` },
            unit_amount: Math.round(Number(order.total) * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { orderId },
      success_url: successUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/order-success?orderId=${orderId}`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout`,
    });

    res.json({ success: true, data: { sessionId: session.id, url: session.url } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Payment session creation failed', error: error.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!stripe) return res.status(501).json({ success: false, message: 'Stripe not configured' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Webhook signature verification failed' });
  }

  try {
    const Order = require('../models/Order');
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: 'paid',
          stripeTransactionId: paymentIntent.id,
          $push: { statusHistory: { status: 'payment_confirmed', note: 'Stripe payment confirmed', timestamp: new Date() } },
        });
      }
    }
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
      }
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: 'paid',
          stripeTransactionId: session.payment_intent,
        });
      }
    }
    res.json({ success: true, received: true, event: event.type });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

module.exports = router;
