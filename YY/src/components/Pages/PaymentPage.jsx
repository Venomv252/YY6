import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircleIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed
  const [orderDetails, setOrderDetails] = useState(null);
  const [error, setError] = useState(null);

  const userName = localStorage.getItem('studentName') || '';
  const userEmail = localStorage.getItem('studentEmail') || '';

  // Debug: Log the email being used
  console.log('PaymentPage - userName:', userName);
  console.log('PaymentPage - userEmail:', userEmail);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const createOrder = async () => {
    try {
      setPaymentStatus('processing');
      const response = await fetch('http://localhost:3000/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 500,
          currency: 'INR',
          customerInfo: {
            name: userName,
            email: userEmail,
            purpose: 'YugaYatra Internship Test Fee'
          }
        })
      });

      const result = await response.json();
      
      if (result.success && result.order) {
        setOrderDetails(result.order);
        initializePayment(result.order);
      } else {
        throw new Error(result.error || 'Failed to create order');
      }
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err.message);
      setPaymentStatus('failed');
    }
  };

  const initializePayment = (order) => {
    const options = {
      key: 'rzp_test_S568pOBqgQbORV', // Your test key
      amount: order.amount,
      currency: order.currency,
      name: 'YugaYatra Test Fee',
      description: 'Test Registration Fee',
      order_id: order.id,
      handler: async function (response) {
        await verifyPayment(response);
      },
      prefill: {
        name: userName,
        email: userEmail,
        contact: ''
      },
      theme: {
        color: '#D4AF37'
      },
      modal: {
        ondismiss: function() {
          setPaymentStatus('pending');
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const verifyPayment = async (response) => {
    try {
      const verifyResponse = await fetch('http://localhost:3000/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          email: userEmail
        })
      });

      const verifyData = await verifyResponse.json();
      
      if (verifyData.success) {
        setPaymentStatus('success');
        // Store payment success in localStorage or session
        localStorage.setItem('paymentSuccess', 'true');
        localStorage.setItem('paymentOrderId', response.razorpay_order_id);
        localStorage.setItem('paymentId', response.razorpay_payment_id);
        localStorage.setItem('paymentLogId', verifyData.logId || '');
      } else {
        setPaymentStatus('failed');
        setError(verifyData.error || 'Payment verification failed');
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      setPaymentStatus('failed');
      setError('Payment verification failed');
    }
  };

  const handleProceedToTest = () => {
    navigate('/test');
  };

  const handleRetryPayment = () => {
    setPaymentStatus('pending');
    setError(null);
    createOrder();
  };

  const handleGoBack = () => {
    navigate('/test-terms');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Payment Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {paymentStatus === 'pending' && (
            <>
              <div className="w-16 h-16 bg-lavish-gold/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-8 h-8 border-4 border-lavish-gold border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h2 className="text-2xl font-bold text-rich-black mb-4">Ready to Pay</h2>
              <p className="text-gray-600 mb-6">
                Click the button below to proceed with the payment of ₹500 for the YugaYatra test.
              </p>
              <div className="space-y-4">
                {userEmail && userEmail.trim() !== '' ? (
                  <button
                    onClick={createOrder}
                    className="w-full px-6 py-3 bg-lavish-gold text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors duration-300"
                  >
                    Pay ₹500 & Proceed
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-red-600 text-sm">Please log in to proceed with payment</p>
                    <button
                      onClick={() => navigate('/signin')}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-300"
                    >
                      Login to Continue
                    </button>
                  </div>
                )}
                <button
                  onClick={handleGoBack}
                  className="w-full px-6 py-3 bg-gray-200 text-rich-black rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-300"
                >
                  Go Back
                </button>
              </div>
            </>
          )}

          {paymentStatus === 'processing' && (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h2 className="text-2xl font-bold text-rich-black mb-4">Processing Payment</h2>
              <p className="text-gray-600 mb-6">
                Please complete the payment in the popup window. Do not close this page.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  If the payment window doesn't appear, please check your popup blocker settings.
                </p>
              </div>
            </>
          )}

          {paymentStatus === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-rich-black mb-4">Payment Successful!</h2>
              <p className="text-gray-600 mb-6">
                Your payment of ₹500 has been processed successfully. You can now proceed to take the test.
              </p>
              {orderDetails && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-800">
                    <strong>Order ID:</strong> {orderDetails.id}
                  </p>
                </div>
              )}
              <button
                onClick={handleProceedToTest}
                className="w-full px-6 py-3 bg-lavish-gold text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors duration-300"
              >
                Proceed to Test
              </button>
            </>
          )}

          {paymentStatus === 'failed' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XMarkIcon className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-rich-black mb-4">Payment Failed</h2>
              <p className="text-gray-600 mb-6">
                {error || 'There was an issue processing your payment. Please try again.'}
              </p>
              <div className="space-y-4">
                <button
                  onClick={handleRetryPayment}
                  className="w-full px-6 py-3 bg-lavish-gold text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors duration-300"
                >
                  Try Again
                </button>
                <button
                  onClick={handleGoBack}
                  className="w-full px-6 py-3 bg-gray-200 text-rich-black rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-300"
                >
                  Go Back
                </button>
              </div>
            </>
          )}
        </div>

        {/* Payment Information */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-rich-black mb-4">Payment Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Test Fee:</span>
              <span className="font-semibold">₹500</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Currency:</span>
              <span className="font-semibold">INR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-semibold">Razorpay</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                This is a test payment gateway. For production, please replace with your live Razorpay keys.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage; 