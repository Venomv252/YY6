import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Payment Database URI
const PAYMENT_DB_URI = 'mongodb+srv://aryanraj9931614200:Aryan00123@cluster0.kzsjydb.mongodb.net/payment-db?retryWrites=true&w=majority&appName=Cluster0';

// Payment Database Connection
const paymentConnection = mongoose.createConnection(PAYMENT_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

paymentConnection.on('connected', () => {
  console.log('✅ Payment database connected');
});

paymentConnection.on('error', (error) => {
  console.error('❌ Payment database connection error:', error);
});

// Payment Schema
const PaymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'razorpay'
  },
  description: {
    type: String,
    default: 'Test Payment'
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

const Payment = paymentConnection.model('Payment', PaymentSchema); 