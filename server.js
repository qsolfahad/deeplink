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
        // returnUrl: `https://deeplink-drab.vercel.app/success?orderId=${orderId}` // must be a real URL
        returnUrl: `http://localhost:3000/success?orderId=${orderId}` // must be a real URL
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


async function post_bank_data(data) {
  
  try {
      await axios.post(
        'http://127.0.0.1:8000/payment_method/bank/save_transaction',
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZV9pZCI6MSwib3JnX2lkIjoxLCJ0YXhfdHlwZSI6bnVsbCwic2Vzc2lvbl9pZCI6IjEzODk0ODc1LTMzMGYtNGY4ZS05MzY4LTcwNDNiMmE4MDAwMCIsInRva2VuX3RpbWUiOjE3NDgzMjk1NjQuNjc5MDMwMiwidXNlcl90eXBlIjoic3RhZmYifQ.QKr_NF7OUiN6Q57EcI4WQnY282RXtAxc_8vmN43cQVw'
          }
        }
      );
    } catch (pythonError) {
      console.error('Error saving to Python server:', pythonError.response?.data || pythonError.message);
      // Continue with the response even if Python server call fails
    }
    
    return {
      success: true,
      message: 'Refund initiated successfully'
    }
  }

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
    
    if (result.result != "SUCCESS"){
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

    post_data = await post_bank_data(pythonApiPayload)
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
    console.error('Full error:', err);
    console.error('Error response:', err.response?.data);
    res.status(500).json({ 
      error: err.response?.data || err.message,
      details: err.response?.data
    });
  }
});

app.post('/refund', async (req, res) => {
  const { orderId, amount, currency = "PKR" } = req.body;
  const transactionId = Math.floor(Math.random() * 100000);

  console.log("Order Id:", orderId)
  console.log("Transaction Id:", transactionId)
  
  if (!transactionId || !orderId) {
    return res.status(400).json({ error: "Missing original transaction ID or order ID" });
  }

  try {
    const response = await axios.put(
      `https://test-bankalfalah.gateway.mastercard.com/api/rest/version/100/merchant/TESTATMOSPHERGYM/order/${orderId}/transaction/${transactionId}`,
      {
        apiOperation: "REFUND",
        transaction: {
          amount: parseFloat(amount).toFixed(2),
          currency: currency
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic bWVyY2hhbnQuVEVTVEFUTU9TUEhFUkdZTTo2MDdiMGFhOWQ5ZjBlNTU4MTE4YjlhOTgyN2JiYzQ3ZQ==`
        }
      }
    );

    console.log('Refund response:', response.data);
    const pythonApiPayload = {
      transaction_id: response.data.transaction?.id || transactionId,
      order_id: response.data.order.id,
      acquirer_name: response.data.transaction?.acquirer.id || "Bank Alfalah",
      transaction_type: response.data.transaction?.type || "REFUND",
      status: response.data.order?.status || "PENDING",
      result: response.data?.result,
      source: response.data?.sourceOfFunds?.type || "UNKNOWN",
      amount: response.data?.transaction?.amount
    };
    post_result = await post_bank_data(pythonApiPayload);
    console.log('Post result:', post_result);

    if (!post_result.success) {
      console.log("Failed to save transaction data to Python server");
      return res.status(500).json({ error: "Failed to save transaction data" });
    }

    if (response.data.result != "SUCCESS"){
      console.log("Something Went Wrong")
      return {
        "status": response.status,
        "status_code": 500
      }
    }

    res.json(response.data);
    console.log(response.data)
  } catch (err) {
    console.error('Refund error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
});


app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
