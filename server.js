const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();

app.use(cors());

app.use(express.json());

async function get_bank_credentials(auth_token) {

  try {
    data = await axios.get(
      'http://127.0.0.1:8000/payment_method/bank_account/details',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth_token}`
        }
      }
    );
    console.log('Bank credentials:', data.data);
    return {
      data: data.data,
      success: true,
      message: 'Credentials retrieved successfully'
    }
  } catch (pythonError) {
    console.error('Error retrieving bank credentials:', pythonError.response?.data || pythonError.message);
    // Continue with the response even if Python server call fails
  }
}

app.post('/create-session', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    const JWT_SECRET = 'a-string-secret-at-least-256-bits-long';
    let decoded;
    try {
      console.log('Verifying token:', token);
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('Decoded token:', decoded);
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const amount = decoded.amount;
    if (!amount) {
      return res.status(400).json({ error: 'Amount missing in token' });
    }
    
    account_credentials = await get_bank_credentials(decoded.auth_token);
    console.log('Account credentials:', account_credentials.data);
    const merchant_account = account_credentials.data.merchant_account;
    const merchant_api_key = account_credentials.data.merchant_api_key;
    const merchant_url = account_credentials.data.merchant_url;
    if (!merchant_account || !merchant_api_key || !merchant_url) {
      return res.status(400).json({ error: 'Merchant credentials missing' });
    }

    // Correct: encode 'merchant.MERCHANT_ID:API_KEY'
    const authString = `merchant.${merchant_account}:${merchant_api_key}`;
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
    const orderId = "ORDER-" + Math.floor(Math.random() * 100000);
    const payload = {
      apiOperation: "INITIATE_CHECKOUT",
      checkoutMode: "WEBSITE",
      interaction: {
        operation: "PURCHASE",
        merchant: {
          name: "TESTATMOSPHERGYM",
          url: "https://deeplink-drab.vercel.app"
          // url: "http://localhost:3000/success" // for testing purposes
        },
        returnUrl: `https://deeplink-drab.vercel.app/success?orderId=${orderId}&auth_token=${decoded.auth_token}` // must be a real URL
        // returnUrl: `http://localhost:3000/success?orderId=${orderId}&auth_token=${decoded.auth_token}` // must be a real URL
      },
      order: {
        currency: "PKR",
        amount: amount.toFixed(2),
        id: orderId,
        description: "Goods and Services"
      }
    };
    console.log('Payload:', payload);
    const response = await axios.post(
      `${merchant_url}/api/rest/version/100/merchant/${merchant_account}/session`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
      }
    );
    
    res.json(response.data);
  } catch (err) {
    console.error('Error creating session:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});


async function post_bank_data(data, auth_token) {

  try {
    await axios.post(
      'http://127.0.0.1:8000/payment_method/bank/save_transaction',
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth_token}`
        }
      }
    );
    return {
      success: true,
      message: 'Information saved successfully'
    };
  }
  catch (pythonError) {
    console.error('Error saving to Python server:', pythonError.response?.data || pythonError.message);
    // Continue with the response even if Python server call fails
  }
}


app.get('/success', async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const auth_token = req.query.auth_token;
    if (!auth_token) {
      return res.status(400).send('Auth token is required');
    }
    const bank_credentials = await get_bank_credentials(auth_token);
    if (!orderId) {
      return res.status(400).send('Order ID is required');
    }

    // Use .data for credentials
    const merchant_url = bank_credentials.data.merchant_url;
    const merchant_account = bank_credentials.data.merchant_account;
    const merchant_api_key = bank_credentials.data.merchant_api_key;

    const transactionResponse = await axios.get(
      `${merchant_url}/api/rest/version/100/merchant/${merchant_account}/order/${orderId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`merchant.${merchant_account}:${merchant_api_key}`).toString('base64')}`,
        },
      }
    );

    const result = transactionResponse.data;

    if (result.result != "SUCCESS") {
      console.log("Something Went Wrong")
      return {
        "status": result.status,
        "message": result.description,
        "status_code": 500
      }
    }
    // Find payment transaction
    console.log("Transaction Result:", result);

    const paymentTxn = result.transaction?.find(t => t.transaction?.type === 'PAYMENT');

    const pythonApiPayload = {
      transaction_id: paymentTxn?.transaction?.id || 0,
      order_id: result.id,
      acquirer_name: "Bank Alfalah",
      transaction_type: paymentTxn?.transaction?.type || "PAYMENT",
      status: result.status,
      result: result.result,
      source: result.sourceOfFunds?.provided?.card?.brand || "UNKNOWN",
      amount: result.amount
    };

    post_data = await post_bank_data(pythonApiPayload, auth_token);
    console.log('Post data result:', post_data);

    res.json({
      success: true,
      orderId: result.id,
      status: result.status,
      result: result.result,
      amount: result.amount,
      currency: result.currency,
      card: {
        brand: result.sourceOfFunds?.provided?.card?.brand,
        number: result.sourceOfFunds?.provided?.card?.number,
        nameOnCard: result.sourceOfFunds?.provided?.card?.nameOnCard
      },
      payment: {
        transaction_id: paymentTxn?.transaction?.id,
        authorizationCode: paymentTxn?.transaction?.authorizationCode,
        receipt: paymentTxn?.transaction?.receipt,
        acquirerMessage: paymentTxn?.response?.acquirerMessage,
        gatewayCode: paymentTxn?.response?.gatewayCode
      },
      time: {
        created: result.creationTime,
        updated: result.lastUpdatedTime
      }
    });
  } catch (err) {
    console.error('Error response:', err.response?.data);
    res.status(500).json({
      error: err.response?.data || err.message,
      details: err.response?.data
    });
  }
});


app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
