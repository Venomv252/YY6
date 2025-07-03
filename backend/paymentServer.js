import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import Razorpay from 'razorpay';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import fetchPkg from 'node-fetch';
import mongoose from 'mongoose';
import Payment from './models/Payment.js';
const fetch = fetchPkg.default || fetchPkg;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB Atlas
const MONGODB_URI = 'mongodb+srv://aryanraj9931614200:Aryan00123@cluster0.kzsjydb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas for payment server');
  })
  .catch((error) => {
    console.error('❌ Error connecting to MongoDB Atlas:', error);
  });

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create logs directory if it doesn't exist
const logsDir = path.join(path.resolve(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Payment logs file
const paymentLogsFile = path.join(logsDir, 'payments.json');

// Test records file
const testRecordsFile = path.join(logsDir, 'test-records.json');

// Initialize payment logs file if it doesn't exist
if (!fs.existsSync(paymentLogsFile)) {
  fs.writeFileSync(paymentLogsFile, JSON.stringify([], null, 2));
}

// Initialize test records file if it doesn't exist
if (!fs.existsSync(testRecordsFile)) {
  fs.writeFileSync(testRecordsFile, JSON.stringify([], null, 2));
}

// Helper function to log payments
const logPayment = (paymentData) => {
  try {
    const existingLogs = JSON.parse(fs.readFileSync(paymentLogsFile, 'utf8'));
    const newLog = {
      ...paymentData,
      timestamp: new Date().toISOString(),
      logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    existingLogs.push(newLog);
    fs.writeFileSync(paymentLogsFile, JSON.stringify(existingLogs, null, 2));
    console.log(`Payment logged: ${newLog.logId}`);
    return newLog;
  } catch (error) {
    console.error('Error logging payment:', error);
    return null;
  }
};

// Helper function to save test records
const saveTestRecord = (testData) => {
  try {
    const existingRecords = JSON.parse(fs.readFileSync(testRecordsFile, 'utf8'));
    const newRecord = {
      ...testData,
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      testDate: new Date().toISOString()
    };
    existingRecords.push(newRecord);
    fs.writeFileSync(testRecordsFile, JSON.stringify(existingRecords, null, 2));
    console.log(`Test record saved: ${newRecord.id}`);
    return newRecord;
  } catch (error) {
    console.error('Error saving test record:', error);
    return null;
  }
};

// Helper function to generate receipt ID
const generateReceiptId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `YY_${timestamp}_${random}`.toUpperCase();
};

// Helper function to validate request data
const validateOrderRequest = (req) => {
  const { amount, currency, customerInfo } = req.body;
  
  if (!amount || amount <= 0) {
    return { valid: false, error: 'Invalid amount provided' };
  }
  
  if (amount > 100000) { // Max ₹1000 for test
    return { valid: false, error: 'Amount exceeds maximum limit' };
  }
  
  return { valid: true, data: { amount, currency: currency || 'INR', customerInfo } };
};

// Phase 1: Create Razorpay Order
app.post('/create-order', async (req, res) => {
  console.log('Creating order with data:', req.body);
  
  try {
    // Validate request
    const validation = validateOrderRequest(req);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }

    const { amount, currency, customerInfo } = validation.data;
    
    // Create order options
    const orderOptions = {
      amount: amount * 100, // Convert to paise
      currency: currency,
      receipt: generateReceiptId(),
      notes: {
        purpose: 'YugaYatra Test Fee',
        customer_email: customerInfo?.email || 'N/A',
        customer_name: customerInfo?.name || 'N/A'
      },
      partial_payment: false,
      first_payment_min_amount: amount * 100
    };

    console.log('Creating Razorpay order with options:', orderOptions);

    // Create order with Razorpay
    const order = await razorpay.orders.create(orderOptions);
    
    console.log('Order created successfully:', order.id);

    // Log the order creation
    const orderLog = {
      type: 'ORDER_CREATED',
      orderId: order.id,
      receiptId: order.receipt,
      amount: amount,
      currency: currency,
      customerInfo: customerInfo || {},
      razorpayOrder: order,
      status: 'created'
    };
    
    logPayment(orderLog);

    // Store order creation in database
    try {
      // Handle empty customer info
      let customerEmail = customerInfo?.email;
      let customerName = customerInfo?.name;
      
      if (!customerEmail || customerEmail.trim() === '') {
        customerEmail = 'customer@example.com';
      }
      if (!customerName || customerName.trim() === '') {
        customerName = 'Customer';
      }
      
      console.log('Order creation - customerEmail:', customerEmail);
      console.log('Order creation - customerName:', customerName);
      console.log('Order creation - customerInfo from request:', customerInfo);

      const paymentData = {
        orderId: order.id,
        paymentId: `pending_${order.id}`, // Temporary payment ID for pending orders
        amount: amount,
        currency: currency,
        status: 'pending',
        customerEmail: customerEmail,
        customerName: customerName,
        paymentMethod: 'razorpay',
        receiptId: order.receipt,
        description: 'YugaYatra Test Fee',
        razorpayOrder: order
      };

      // Save directly to MongoDB Atlas
      const newPayment = new Payment(paymentData);
      await newPayment.save();
      
      console.log('Order creation stored in MongoDB Atlas successfully');
    } catch (dbError) {
      console.error('Error storing order creation in MongoDB Atlas:', dbError);
      // Continue with the flow even if database storage fails
    }

    // Return success response
    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        created_at: order.created_at
      },
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('Error creating order:', error);
    
    // Log the error
    const errorLog = {
      type: 'ORDER_CREATION_ERROR',
      error: error.message,
      requestData: req.body,
      timestamp: new Date().toISOString()
    };
    
    logPayment(errorLog);

    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      details: error.message
    });
  }
});

// Phase 1: Verify Payment & Log
app.post('/verify-payment', async (req, res) => {
  console.log('Verifying payment with data:', req.body);
  
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification parameters'
      });
    }

    // Verify signature
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    const generated_signature = crypto
      .createHmac('sha256', key_secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.error('Payment signature verification failed');
      
      const errorLog = {
        type: 'PAYMENT_VERIFICATION_FAILED',
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        reason: 'Signature mismatch',
        timestamp: new Date().toISOString()
      };
      
      logPayment(errorLog);

      // Store failed payment in database
      try {
        const paymentData = {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: 0,
          currency: 'INR',
          status: 'failed',
          customerEmail: req.body.email || 'customer@example.com',
          customerName: 'Customer',
          paymentMethod: 'razorpay',
          receiptId: `receipt_${Date.now()}`,
          description: 'YugaYatra Test Fee',
          errorDetails: { reason: 'Signature mismatch' }
        };

        // Save directly to MongoDB Atlas
        const newPayment = new Payment(paymentData);
        await newPayment.save();
        
        console.log('Failed payment stored in MongoDB Atlas successfully');
      } catch (dbError) {
        console.error('Error storing failed payment in MongoDB Atlas:', dbError);
      }

      return res.status(400).json({
        success: false,
        error: 'Payment verification failed - Invalid signature'
      });
    }

    // Fetch payment details from Razorpay
    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      console.log('Payment details fetched:', paymentDetails.id);
    } catch (fetchError) {
      console.error('Error fetching payment details:', fetchError);
      paymentDetails = null;
    }

    // Log successful payment
    const paymentLog = {
      type: 'PAYMENT_SUCCESS',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      paymentDetails: paymentDetails,
      verificationStatus: 'success',
      timestamp: new Date().toISOString()
    };
    
    const loggedPayment = logPayment(paymentLog);

    // Store payment record in database
    try {
      // Extract email from multiple sources with better priority
      // Prioritize Razorpay email since it captures the actual email used for payment
      let customerEmail = null;
      
      // First try to get from Razorpay payment details (most reliable)
      if (paymentDetails && paymentDetails.email) {
        customerEmail = paymentDetails.email;
      }
      
      // If no Razorpay email, try from request body
      if (!customerEmail && req.body.email) {
        customerEmail = req.body.email;
      }
      
      // If still no email, try from order notes
      if (!customerEmail && paymentDetails && paymentDetails.notes) {
        customerEmail = paymentDetails.notes.customer_email;
      }
      
      // Final fallback
      if (!customerEmail) {
        customerEmail = 'customer@example.com';
      }

      // Extract customer name from multiple sources
      let customerName = 'Customer';
      if (paymentDetails?.notes?.customer_name) {
        customerName = paymentDetails.notes.customer_name;
      } else if (req.body.customerInfo?.name) {
        customerName = req.body.customerInfo.name;
      }

      console.log('Payment server - Extracted email:', customerEmail);
      console.log('Payment server - Extracted name:', customerName);
      console.log('Payment server - Razorpay email:', paymentDetails?.email);
      console.log('Payment server - Request body email:', req.body.email);

      const paymentData = {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: paymentDetails ? paymentDetails.amount / 100 : 0, // Convert from paise to rupees
        currency: paymentDetails ? paymentDetails.currency : 'INR',
        status: 'success',
        customerEmail: customerEmail,
        customerName: customerName,
        paymentMethod: 'razorpay',
        receiptId: paymentDetails?.receipt || `receipt_${Date.now()}`,
        description: 'YugaYatra Test Fee',
        razorpayOrder: paymentDetails,
        razorpayPayment: paymentDetails
      };

      // Save directly to MongoDB Atlas
      const newPayment = new Payment(paymentData);
      await newPayment.save();
      
      console.log('Payment record stored in MongoDB Atlas successfully');
    } catch (dbError) {
      console.error('Error storing payment in MongoDB Atlas:', dbError);
      // Continue with the flow even if database storage fails
    }

    console.log('Payment verified successfully:', razorpay_payment_id);

    // Extract email from paymentDetails or order notes if not present in req.body
    let userEmail = req.body.email;
    if (!userEmail && paymentDetails) {
      userEmail = paymentDetails.email || (paymentDetails.notes && paymentDetails.notes.customer_email);
    }
    if (userEmail) {
      // Notify main backend to mark user as paid
      try {
        await fetch('http://localhost:5000/api/mark-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail })
        });
      } catch (err) {
        console.error('Error notifying backend to mark user as paid:', err);
      }
    }

    // Return success response
    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      logId: loggedPayment?.logId
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    
    const errorLog = {
      type: 'PAYMENT_VERIFICATION_ERROR',
      error: error.message,
      requestData: req.body,
      timestamp: new Date().toISOString()
    };
    
    logPayment(errorLog);

    res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      details: error.message
    });
  }
});

// Get payment logs (for admin purposes)
app.get('/payment-logs', async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      logs: payments,
      total: payments.length
    });
  } catch (error) {
    console.error('Error reading payment logs from MongoDB Atlas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read payment logs'
    });
  }
});

// Get payment statistics
app.get('/payment-stats', async (req, res) => {
  try {
    const payments = await Payment.find();
    
    const stats = {
      totalOrders: payments.filter(p => p.status === 'pending').length,
      totalPayments: payments.filter(p => p.status === 'success').length,
      totalErrors: payments.filter(p => p.status === 'failed').length,
      totalAmount: payments
        .filter(p => p.status === 'success')
        .reduce((sum, p) => sum + (p.amount || 0), 0),
      recentActivity: payments.slice(-10) // Last 10 activities
    };
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error calculating payment stats from MongoDB Atlas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate payment statistics'
    });
  }
});

// Get test records (from database)
app.get('/test-records', async (req, res) => {
  try {
    // Fetch test records from backend database
    const response = await fetch('http://localhost:5000/api/test-results');
    const data = await response.json();
    
    if (data.success) {
      res.json({
        success: true,
        records: data.records,
        total: data.total
      });
    } else {
      throw new Error(data.message || 'Failed to fetch test records from database');
    }
  } catch (error) {
    console.error('Error fetching test records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test records'
    });
  }
});

// Save test result
app.post('/save-test-result', async (req, res) => {
  try {
    const { 
      studentName, 
      email, 
      score, 
      totalQuestions, 
      attemptsUsed, 
      totalAttempts, 
      paymentId, 
      orderId,
      timeTaken,
      startedOn,
      completedOn,
      questions
    } = req.body;
    
    if (!studentName || !email || score === undefined || !totalQuestions) {
      return res.status(400).json({
        success: false,
        error: 'Missing required test data'
      });
    }

    // Forward the request to the backend database
    const response = await fetch('http://localhost:5000/api/test-results', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentName,
        email,
        score,
        totalQuestions,
        attemptsUsed,
        totalAttempts,
        paymentId,
        orderId,
        timeTaken,
        startedOn,
        completedOn,
        questions
      })
    });

    const data = await response.json();
    
    if (data.success) {
      res.json({
        success: true,
        message: 'Test result saved successfully',
        record: data.record
      });
    } else {
      throw new Error(data.message || 'Failed to save test result to database');
    }
  } catch (error) {
    console.error('Error saving test result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save test result'
    });
  }
});

// Get internship applications (from backend database)
app.get('/internship-applications', async (req, res) => {
  try {
    // This would connect to your MongoDB database
    // For now, returning sample data
    const applications = [
      {
        id: 'app_001',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+91 9876543210',
        education: 'B.Tech Computer Science, ABC University, 2024',
        experience: '2 years in web development',
        skills: 'JavaScript, React, Node.js, MongoDB',
        domain: 'Fullstack',
        message: 'Passionate about creating innovative web solutions',
        createdAt: new Date().toISOString(),
        status: 'pending'
      },
      {
        id: 'app_002',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+91 8765432109',
        education: 'B.Tech Information Technology, XYZ University, 2024',
        experience: '1 year internship at TechCorp',
        skills: 'Python, Django, PostgreSQL, UI/UX Design',
        domain: 'Backend',
        message: 'Looking to grow my skills in backend development',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'reviewed'
      }
    ];
    
    res.json({
      success: true,
      applications: applications,
      total: applications.length
    });
  } catch (error) {
    console.error('Error fetching internship applications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch internship applications'
    });
  }
});

// Get combined admin dashboard data
app.get('/admin-dashboard', async (req, res) => {
  try {
    // Get payment logs from MongoDB Atlas
    const payments = await Payment.find().sort({ createdAt: -1 });
    
    // Calculate payment stats
    const paymentStats = {
      totalOrders: payments.filter(p => p.status === 'pending').length,
      totalPayments: payments.filter(p => p.status === 'success').length,
      totalErrors: payments.filter(p => p.status === 'failed').length,
      totalAmount: payments
        .filter(p => p.status === 'success')
        .reduce((sum, p) => sum + (p.amount || 0), 0),
      recentPayments: payments
        .filter(p => p.status === 'success')
        .slice(-5)
        .reverse()
    };
    
    // Get test records from database
    let testRecords = [];
    try {
      const testResponse = await fetch('http://localhost:5000/api/test-results');
      const testData = await testResponse.json();
      if (testData.success) {
        testRecords = testData.records;
      }
    } catch (error) {
      console.error('Error fetching test records from database:', error);
      // Fallback to file-based records if database is unavailable
      try {
        testRecords = JSON.parse(fs.readFileSync(testRecordsFile, 'utf8'));
      } catch (fileError) {
        console.error('Error reading test records file:', fileError);
        testRecords = [];
      }
    }
    
    // Get internship applications (sample data)
    const applications = [
      {
        id: 'app_001',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+91 9876543210',
        education: 'B.Tech Computer Science, ABC University, 2024',
        experience: '2 years in web development',
        skills: 'JavaScript, React, Node.js, MongoDB',
        domain: 'Fullstack',
        message: 'Passionate about creating innovative web solutions',
        createdAt: new Date().toISOString(),
        status: 'pending'
      },
      {
        id: 'app_002',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+91 8765432109',
        education: 'B.Tech Information Technology, XYZ University, 2024',
        experience: '1 year internship at TechCorp',
        skills: 'Python, Django, PostgreSQL, UI/UX Design',
        domain: 'Backend',
        message: 'Looking to grow my skills in backend development',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'reviewed'
      }
    ];
    
    const dashboardData = {
      paymentStats,
      testStats: {
        totalTests: testRecords.length,
        averageScore: testRecords.length > 0 ? testRecords.reduce((sum, record) => sum + record.percentage, 0) / testRecords.length : 0,
        recentTests: testRecords.slice(-5)
      },
      applicationStats: {
        totalApplications: applications.length,
        pendingApplications: applications.filter(app => app.status === 'pending').length,
        recentApplications: applications.slice(-5)
      },
      recentActivity: payments.slice(-10).reverse()
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data from MongoDB Atlas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin dashboard data'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Payment server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  const errorLog = {
    type: 'UNHANDLED_ERROR',
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  };
  
  logPayment(errorLog);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Force payment server to use port 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Payment server running on http://localhost:${PORT}`);
  console.log(`📊 Payment logs: ${paymentLogsFile}`);
  console.log(`🔑 Razorpay Key ID: ${process.env.RAZORPAY_KEY_ID}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 