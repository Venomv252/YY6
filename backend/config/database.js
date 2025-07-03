import mongoose from 'mongoose';

// MongoDB Connections for different databases
const FORM_DB_URI = 'mongodb+srv://myuser:Aryan00123@yugayatra.plckoni.mongodb.net/form-db?retryWrites=true&w=majority';
const RESULT_DB_URI = 'mongodb+srv://ritupal:A8TOpaBg86ts0bAu@yy.ofxry7f.mongodb.net/yugayatra?retryWrites=true&w=majority&appName=yy';
const PAYMENT_DB_URI = 'mongodb+srv://aryanraj9931614200:Aryan00123@cluster0.kzsjydb.mongodb.net/payment-db?retryWrites=true&w=majority&appName=Cluster0';

// Form Database Connection
const formConnection = mongoose.createConnection(FORM_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Result Database Connection  
const resultConnection = mongoose.createConnection(RESULT_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Payment Database Connection
const paymentConnection = mongoose.createConnection(PAYMENT_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Connection event listeners
formConnection.on('connected', () => {
  console.log('✅ Form database connected');
});

resultConnection.on('connected', () => {
  console.log('✅ Result database connected');
});

paymentConnection.on('connected', () => {
  console.log('✅ Payment database connected');
});

formConnection.on('error', (error) => {
  console.error('❌ Form database connection error:', error);
});

resultConnection.on('error', (error) => {
  console.error('❌ Result database connection error:', error);
});

paymentConnection.on('error', (error) => {
  console.error('❌ Payment database connection error:', error);
});

export { formConnection, resultConnection, paymentConnection }; 