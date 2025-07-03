import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Internship from './models/Internship.js';
import TestResult from './models/TestResult.js';
import Payment from './models/Payment.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Question from './models/Question.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import fs from 'fs';
import { formConnection, resultConnection, paymentConnection } from './config/database.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build')));

const PORT = process.env.PORT || 5000;

const razorpay = new Razorpay({
  key_id: 'rzp_test_51O8XqXQO8XqXQ',
  key_secret: 'O8XqXQO8XqXQO8XqXQO8XqXQO8XqXQO8XqXQ'
});

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'yourStrongPassword';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'supersecretkey';

// Brevo (Sendinblue) setup
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const brevoTransac = new SibApiV3Sdk.TransactionalEmailsApi();
const BREVO_SENDER = { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Student Portal' };

const paymentLogsFile = path.join(__dirname, '../logs/payments.json');

// Multer setup for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
  }
});
const upload = multer({ storage });

// Serve avatars statically
app.use('/uploads/avatars', express.static('uploads/avatars'));

// Basic route
app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Internship endpoints
app.post('/api/internships', async (req, res) => {
  try {
    const data = req.body;
    const newInternship = new Internship(data);
    await newInternship.save();
    res.status(201).json({ success: true, message: 'Application saved!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error saving application', error: err.message });
  }
});

app.get('/api/internships', async (req, res) => {
  try {
    const internships = await Internship.find().sort({ createdAt: -1 });
    res.json(internships);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching applications', error: err.message });
  }
});

// Helper function to get balanced questions
const getBalancedQuestions = async (category, count) => {
  const easyCount = Math.floor(count * 0.3);
  const mediumCount = Math.ceil(count * 0.4);
  const hardCount = Math.floor(count * 0.3);

  const easy = await Question.aggregate([
    { $match: { category: { $regex: `^${category}$`, $options: 'i' }, difficulty: 'easy' } },
    { $sample: { size: easyCount } }
  ]);
  const medium = await Question.aggregate([
    { $match: { category: { $regex: `^${category}$`, $options: 'i' }, difficulty: 'medium' } },
    { $sample: { size: mediumCount } }
  ]);
  const hard = await Question.aggregate([
    { $match: { category: { $regex: `^${category}$`, $options: 'i' }, difficulty: 'hard' } },
    { $sample: { size: hardCount } }
  ]);
  
  return [...easy, ...medium, ...hard];
};

// Get Test Questions
app.get('/api/test/questions', async (req, res) => {
  try {
    const { domain } = req.query;
    console.log('Requested domain:', domain);
    if (!domain) {
      return res.status(400).json({ success: false, error: 'Domain is required' });
    }

    const aptitudeQuestions = await getBalancedQuestions('aptitude', 10);
    const domainQuestions = await getBalancedQuestions(domain, 20);
    console.log('Aptitude questions found:', aptitudeQuestions.length);
    console.log('Domain questions found:', domainQuestions.length);

    let finalQuestions = [...aptitudeQuestions, ...domainQuestions];

    // Shuffle the array
    finalQuestions.sort(() => Math.random() - 0.5);
    
    // Omit correct answers before sending
    const questionsForStudent = finalQuestions.map(q => {
      const { correctAnswer, ...question } = q;
      return question;
    });

    res.json({ success: true, questions: questionsForStudent });

  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch questions' });
  }
});

// Submit Test
app.post('/api/test/submit', async (req, res) => {
  try {
    const { studentName, email, domain, questions, timeTaken, startedOn, completedOn } = req.body;

    // Fetch correct answers from DB to ensure security
    const questionIds = questions.map(q => q._id);
    const correctQuestions = await Question.find({ '_id': { $in: questionIds } });

    const correctAnswersMap = correctQuestions.reduce((acc, q) => {
      acc[q._id.toString()] = q.correctAnswer;
      return acc;
    }, {});

    let score = 0;
    const detailedQuestions = questions.map(q => {
      const correctAnswer = correctAnswersMap[q._id];
      const isCorrect = q.selectedOption === correctAnswer;
      if (isCorrect) {
        score++;
      }
      return {
        question: q.question,
        options: q.options,
        selectedOption: q.selectedOption,
        selectedAnswer: q.selectedOption,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect,
        category: q.category,
        difficulty: q.difficulty
      };
    });

    const newTestResult = new TestResult({
      studentName,
      email,
      domain,
      score,
      totalQuestions: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      timeTaken,
      startedOn,
      completedOn,
      questions: detailedQuestions
    });

    const savedResult = await newTestResult.save();

    // Update user attempts
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name: studentName, email, attemptsUsed: 1, lastTestDate: new Date(), eligibilityStatus: 'Pending' });
    } else {
      user.attemptsUsed = (user.attemptsUsed || 0) + 1;
      user.lastTestDate = new Date();
      // If user has reached 5 attempts, reset hasPaid to false
      if (user.attemptsUsed >= 5) {
        user.hasPaid = false;
      }
    }
    await user.save();

    res.status(201).json({ success: true, resultId: savedResult._id, result: savedResult });

  } catch (error) {
    console.error('Error submitting test:', error);
    res.status(500).json({ success: false, error: 'Failed to submit test' });
  }
});

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Create a JWT token
    const token = jwt.sign({ admin: true }, ADMIN_JWT_SECRET, { expiresIn: '2h' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// Middleware to protect admin routes
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    if (decoded.admin) return next();
    return res.status(403).json({ success: false, message: 'Forbidden' });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// Get test results (admin only)
app.get('/api/test-results', requireAdminAuth, async (req, res) => {
  try {
    const testResults = await TestResult.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      records: testResults,
      total: testResults.length
    });
  } catch (err) {
    console.error('Error fetching test results:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching test results', 
      error: err.message 
    });
  }
});

// Get payment history (admin only)
app.get('/api/payments', requireAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, email } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (email) filter.customerEmail = { $regex: email, $options: 'i' };

    // Get payments with pagination
    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Payment.countDocuments(filter);

    // Calculate statistics
    const stats = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          successfulPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          pendingPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      payments,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      stats: stats[0] || {
        totalPayments: 0,
        totalAmount: 0,
        successfulPayments: 0,
        failedPayments: 0,
        pendingPayments: 0
      }
    });

  } catch (err) {
    console.error('Error fetching payment history:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment history',
      error: err.message
    });
  }
});

// Helper: Generate 6-digit code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Auth: Sign Up (with 2FA email)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, phone, education, experience, skills, domain } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Generate verification code
    const verificationCode = generateVerificationCode();
    // Save user with code and unverified status
    const user = new User({ name, email, password: hashedPassword, phone, education, experience, skills, domain, isVerified: false, verificationCode });
    await user.save();
    // Send code via email
    try {
      await brevoTransac.sendTransacEmail({
        sender: BREVO_SENDER,
        to: [{ email, name }],
        subject: 'Your Student Portal Verification Code',
        htmlContent: `<p>Hello ${name},</p><p>Your verification code is: <b>${verificationCode}</b></p><p>Enter this code to complete your registration.</p>`
      });
    } catch (emailErr) {
      console.error('Error sending verification email:', emailErr);
      return res.status(500).json({ success: false, message: 'Error sending verification email', error: emailErr.message });
    }
    res.json({ success: true, message: 'Verification code sent to your email', email });
  } catch (err) {
    console.error('Error in signup endpoint:', err);
    res.status(500).json({ success: false, message: 'Error signing up', error: err.message });
  }
});

// Verify code endpoint
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email: verifyEmail, code } = req.body;
    if (!verifyEmail || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }
    const user = await User.findOne({ email: verifyEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'User already verified' });
    }
    if (user.verificationCode !== code) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }
    user.isVerified = true;
    user.verificationCode = undefined;
    await user.save();
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Verification failed', error: err.message });
  }
});

// Auth: Sign In
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
    res.json({ success: true, token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error signing in', error: err.message });
  }
});

// Get user by email
app.get('/api/user/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching user', error: err.message });
  }
});

// Mark user as paid (called by payment server)
app.post('/api/mark-paid', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.hasPaid = true;
    await user.save();

    console.log(`✅ User ${email} marked as paid`);
    res.json({ success: true, message: 'User marked as paid' });
  } catch (err) {
    console.error('Error marking user as paid:', err);
    res.status(500).json({ success: false, message: 'Error marking user as paid', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 