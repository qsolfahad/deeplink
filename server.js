const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors()); // Allow all origins — for dev only
// Middleware to parse JSON request bodies
app.use(express.json());

app.post('/create-session', async (req, res) => {
  try {
    const credentials = 'TESTATMOSPHERGYM:607b0aa9d9f0e558118b9a9827bbc47e';
    const authHeader = 'Basic ' + Buffer.from(credentials).toString('base64');
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
        returnUrl: `https://deeplink-drab.vercel.app/success?orderId=${orderId}` // must be a real URL
      },
      order: {
        currency: "PKR",
        amount: "1000.00",
        id: orderId,
        description: "Goods and Services"
      }
    };
    console.log('Payload:', payload); 
    const response = await axios.post(
      'https://test-bankalfalah.gateway.mastercard.com/api/rest/version/100/merchant/TESTATMOSPHERGYM/session',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': authHeader,
          Authorization: `Basic bWVyY2hhbnQuVEVTVEFUTU9TUEhFUkdZTTo2MDdiMGFhOWQ5ZjBlNTU4MTE4YjlhOTgyN2JiYzQ3ZQ==`,
        },
      }
    );

    res.json({
      ...response.data,
      orderId: orderId // Add orderId to response
    });
  } catch (err) {
    console.error('Error creating session:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.get('/success', async (req, res) => {
  try {
    const orderId = req.query.orderId;
    if (!orderId) {
      return res.status(400).send('Order ID is required');
    }

    const transactionResponse = await axios.get(
      `https://test-bankalfalah.gateway.mastercard.com/api/rest/version/100/merchant/TESTATMOSPHERGYM/order/${orderId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic bWVyY2hhbnQuVEVTVEFUTU9TUEhFUkdZTTo2MDdiMGFhOWQ5ZjBlNTU4MTE4YjlhOTgyN2JiYzQ3ZQ==`,
        },
      }
    );

    const result = transactionResponse.data;
    
    // Find payment transaction
    const paymentTxn = result.transaction?.find(t => t.transaction?.type === 'PAYMENT');
    
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
    console.error('Full error:', err);
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
