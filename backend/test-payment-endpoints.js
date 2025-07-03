import fetch from 'node-fetch';

async function testPaymentEndpoints() {
  console.log('🔍 Testing Payment Endpoints...\n');

  // Test 1: Payment Server Logs (no auth required)
  console.log('1️⃣ Testing Payment Server Logs (http://localhost:3000/payment-logs)...');
  try {
    const response1 = await fetch('http://localhost:3000/payment-logs');
    const data1 = await response1.json();
    console.log('✅ Status:', response1.status);
    console.log('📊 Total logs:', data1.total || 0);
    console.log('📝 Sample log:', data1.logs ? data1.logs[0] : 'No logs');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Main Backend Payments (requires admin auth)
  console.log('2️⃣ Testing Main Backend Payments (http://localhost:5000/api/payments)...');
  try {
    const response2 = await fetch('http://localhost:5000/api/payments');
    const data2 = await response2.json();
    console.log('✅ Status:', response2.status);
    if (response2.status === 401) {
      console.log('🔒 Requires admin authentication');
      console.log('💡 You need to login as admin first');
    } else {
      console.log('📊 Total payments:', data2.total || 0);
      console.log('📝 Sample payment:', data2.payments ? data2.payments[0] : 'No payments');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Try admin login to get token
  console.log('3️⃣ Testing Admin Login...');
  try {
    const loginResponse = await fetch('http://localhost:5000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'yourStrongPassword'
      })
    });
    const loginData = await loginResponse.json();
    console.log('✅ Login Status:', loginResponse.status);
    
    if (loginData.success && loginData.token) {
      console.log('🎫 Got admin token, testing authenticated payments endpoint...');
      
      const authResponse = await fetch('http://localhost:5000/api/payments', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });
      const authData = await authResponse.json();
      console.log('✅ Auth Status:', authResponse.status);
      console.log('📊 Total payments:', authData.total || 0);
      console.log('📝 Sample payment:', authData.payments ? authData.payments[0] : 'No payments');
    } else {
      console.log('❌ Login failed:', loginData.message);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testPaymentEndpoints(); 