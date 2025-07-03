import fetch from 'node-fetch';
import Payment from './models/Payment.js';
import { paymentConnection } from './config/database.js';

async function syncPayments() {
  console.log('🔄 Syncing payments from payment server to main backend...\n');

  try {
    // Get payments from payment server
    console.log('📥 Fetching payments from payment server...');
    const response = await fetch('http://localhost:3000/payment-logs');
    const data = await response.json();
    
    if (!data.success) {
      console.log('❌ Failed to fetch from payment server');
      return;
    }

    console.log(`📊 Found ${data.total} payments in payment server`);

    // Get existing payments from main backend
    console.log('📥 Fetching existing payments from main backend...');
    const existingPayments = await Payment.find();
    console.log(`📊 Found ${existingPayments.length} payments in main backend`);

    // Create a map of existing payments by orderId
    const existingMap = new Map();
    existingPayments.forEach(payment => {
      existingMap.set(payment.orderId, payment);
    });

    let syncedCount = 0;
    let skippedCount = 0;

    // Process each payment from payment server
    for (const log of data.logs) {
      if (log.type === 'ORDER_CREATED' || log.type === 'PAYMENT_SUCCESS') {
        const orderId = log.orderId;
        
        if (existingMap.has(orderId)) {
          console.log(`⏭️  Skipping existing payment: ${orderId}`);
          skippedCount++;
          continue;
        }

        // Create new payment record
        const paymentData = {
          orderId: orderId,
          paymentId: log.paymentId || `pending_${orderId}`,
          customerEmail: log.customerInfo?.email || 'customer@example.com',
          customerName: log.customerInfo?.name || 'Customer',
          amount: log.amount,
          currency: log.currency || 'INR',
          status: log.status || 'pending',
          paymentMethod: 'razorpay',
          description: 'YugaYatra Test Fee',
          metadata: {
            receiptId: log.receiptId,
            logType: log.type,
            timestamp: log.timestamp
          }
        };

        try {
          const newPayment = new Payment(paymentData);
          await newPayment.save();
          console.log(`✅ Synced payment: ${orderId}`);
          syncedCount++;
        } catch (error) {
          console.log(`❌ Failed to sync payment ${orderId}:`, error.message);
        }
      }
    }

    console.log('\n📊 Sync Summary:');
    console.log(`✅ Synced: ${syncedCount} payments`);
    console.log(`⏭️  Skipped: ${skippedCount} payments (already exist)`);
    console.log(`📈 Total in main backend: ${existingPayments.length + syncedCount}`);

  } catch (error) {
    console.log('❌ Sync failed:', error.message);
  }
}

syncPayments(); 