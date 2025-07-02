const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();

app.use(cors());

app.use(express.json());

async function get_bank_credentials(org_id, auth_token) {

  try {
    const data = await axios.get(
      'http://192.168.11.23:8890/payment_method/bank/details',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth_token}`
        },
        params: {
          org_id: org_id
        }
      }
    );
    console.log('Bank credentials:', data.data);
    return {
      data: data.data,
      success: true,
      message: 'Credentials retrieved successfully'
    }
  } catch (error) {
    console.error('Error retrieving bank credentials:', error.response?.data || error.message);
    // Continue with the response even if Python server call fails
    return {
      success: false,
      message: error.response?.data?.detail || "Failed to retrieve bank credentials"
    };
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
    const org_id = decoded.org_id;
    console.log('Amount:', amount, 'Org ID:', org_id);
    if (!amount || !org_id) {
      return res.status(400).json({ error: 'Amount or Org ID missing in token' });
    }

    account_credentials = await get_bank_credentials(org_id, decoded.auth_token);
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
        returnUrl: `https://deeplink-drab.vercel.app/success?orderId=${orderId}&org_id=${org_id}&auth_token=${decoded.auth_token}`
        // returnUrl: `http://localhost:3000/success?orderId=${orderId}&org_id=${org_id}&auth_token=${decoded.auth_token}` // must be a real URL
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


async function post_bank_data(data, org_id, auth_token) {

  try {
    console.log('Posting data to Python server:', auth_token);
    await axios.post(
      'http://192.168.11.23:8890/payment_method/bank/save_transaction',
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth_token}`
        },
        params: {
          org_id: org_id
        }
      }
    );
    return {
      success: true,
      message: 'Information saved successfully'
    };
  } 
  catch (error) {
    return {
    success: false,
    message:
      error.response?.data?.detail ||
      "Failed to save transaction data" 
    };
  }
}


app.get('/success', async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const org_id = req.query.org_id;
    const auth_token = req.query.auth_token;
    console.log('Order ID:', orderId, 'Org ID:', org_id, 'Auth Token:', auth_token);
    // Validate required fields
    if (!auth_token || !org_id || !orderId) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Missing Required Fields</title>
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <style>
              body {
                background: #f7f7f7;
                color: #222;
                font-family: 'Segoe UI', Arial, sans-serif;
                margin: 0;
                padding: 0;
                min-height: 100vh;
                min-height: 100dvh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                padding: 2.5rem 2rem;
                max-width: 400px;
                width: 100%;
                text-align: center;
                box-sizing: border-box;
                word-break: break-word;
              }
              .fail {
                color: #d32f2f;
                font-size: 2rem;
                margin-bottom: 1rem;
              }
              .gap {
                margin: 1.5rem 0;
                background: #f7f7f7;
                height: 2px;
                border: none;
              }
              .redirect-msg {
                color: #888;
                margin-top: 1.5rem;
              }
              @media (max-width: 600px) {
                .container {
                  padding: 1.2rem 0.5rem;
                  max-width: 90vw;
                  margin: 2vh auto;
                  border-radius: 10px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                .fail {
                  font-size: 1.4rem;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="fail">Missing Required Fields</div>
              <hr class="gap" />
              <div>Please provide all required fields (orderId, org_id, auth_token).</div>
              <div class="redirect-msg">You will be redirected to the homepage shortly.</div>
            </div>
            <script>
              alert("Missing required fields: orderId, org_id, or auth_token");
            </script>
          </body>
        </html>
      `);
    }
    const bank_credentials = await get_bank_credentials(org_id, auth_token);

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
      // Show failure message as styled HTML
      return res.send(`
        <html>
          <head>
            <title>Transaction Failed</title>
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <style>
              body {
                background: #f7f7f7;
                color: #222;
                font-family: 'Segoe UI', Arial, sans-serif;
                margin: 0;
                padding: 0;
                min-height: 100vh;
                min-height: 100dvh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                padding: 2.5rem 2rem;
                max-width: 400px;
                width: 100%;
                text-align: center;
                box-sizing: border-box;
                word-break: break-word;
              }
              .fail {
                color: #d32f2f;
                font-size: 2rem;
                margin-bottom: 1rem;
              }
              .gap {
                margin: 1.5rem 0;
                background: #f7f7f7;
                height: 2px;
                border: none;
              }
              .redirect-msg {
                color: #888;
                margin-top: 1.5rem;
              }
              .btn {
                margin-top: 2rem;
                background: #78de78;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 2rem;
                font-size: 1rem;
                cursor: pointer;
                transition: background 0.2s;
              }
              .btn:hover {
                background: #5fc95f;
              }
              @media (max-width: 600px) {
                .container {
                  padding: 1.2rem 0.5rem;
                  max-width: 90vw;
                  margin: 2vh auto;
                  border-radius: 10px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                .fail, .success {
                  font-size: 1.4rem;
                }
                .btn {
                  width: 100%;
                  font-size: 1rem;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="fail">Transaction Failed</div>
              <hr class="gap" />
              <div>${result.description || "Something went wrong."}</div>
              <div class="redirect-msg">You will be redirected to the homepage shortly.</div>
            </div>
            <script>
              alert("Transaction failed: ${result.description || "Unknown error"}");
            </script>
          </body>
        </html>
      `);
    }
    // Find payment transaction
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

    post_data = await post_bank_data(pythonApiPayload, org_id, auth_token);
    console.log('Post data result:', post_data);

    if (!post_data?.success) {
      // Show error message as styled HTML if saving transaction failed
      return res.send(`
        <html>
          <head>
            <title>Transaction Saved Error</title>
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <style>
              body {
                background: #f7f7f7;
                color: #222;
                font-family: 'Segoe UI', Arial, sans-serif;
                margin: 0;
                padding: 0;
                min-height: 100vh;
                min-height: 100dvh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                padding: 2.5rem 2rem;
                max-width: 400px;
                width: 100%;
                text-align: center;
                box-sizing: border-box;
                word-break: break-word;
              }
              .fail {
                color: #d32f2f;
                font-size: 2rem;
                margin-bottom: 1rem;
              }
              .gap {
                margin: 1.5rem 0;
                background: #f7f7f7;
                height: 2px;
                border: none;
              }
              .redirect-msg {
                color: #888;
                margin-top: 1.5rem;
              }
              .btn {
                margin-top: 2rem;
                background: #78de78;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 2rem;
                font-size: 1rem;
                cursor: pointer;
                transition: background 0.2s;
              }
              .btn:hover {
                background: #5fc95f;
              }
              @media (max-width: 600px) {
                .container {
                  padding: 1.2rem 0.5rem;
                  max-width: 90vw;
                  margin: 2vh auto;
                  border-radius: 10px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                .fail, .success {
                  font-size: 1.4rem;
                }
                .btn {
                  width: 100%;
                  font-size: 1rem;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="fail">Transaction Saved Error</div>
              <hr class="gap" />
              <div>${post_data.message || "Failed to save transaction."}</div>
              <div class="redirect-msg">You will be redirected to the homepage shortly.</div>
            </div>
            <script>
              alert("Transaction save error: ${post_data.message || "Unknown error"}");
            </script>
          </body>
        </html>
      `);
    }
    // Show success message as styled HTML
    res.send(`
      <html>
        <head>
          <title>Transaction Successful</title>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>
            body {
              background: #f7f7f7;
              color: #222;
              font-family: 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 0;
              min-height: 100vh;
              min-height: 100dvh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: #fff;
              border-radius: 16px;
              box-shadow: 0 4px 24px rgba(0,0,0,0.07);
              padding: 2.5rem 2rem;
              max-width: 400px;
              width: 100%;
              text-align: center;
              box-sizing: border-box;
              word-break: break-word;
            }
            .success {
              color: #2e7d32;
              font-size: 2rem;
              margin-bottom: 1rem;
            }
            .gap {
              margin: 1.5rem 0;
              background: #f7f7f7;
              height: 2px;
              border: none;
            }
            .order-info {
              margin: 1rem 0 0.5rem 0;
              font-size: 1.1rem;
              color: #444;
            }
            .redirect-msg {
              color: #888;
              margin-top: 1.5rem;
            }
            .btn {
              margin-top: 2rem;
              background: #78de78;
              color: #fff;
              border: none;
              border-radius: 8px;
              padding: 0.7rem 2rem;
              font-size: 1rem;
              cursor: pointer;
              transition: background 0.2s;
            }
            .btn:hover {
              background: #5fc95f;
            }
            @media (max-width: 600px) {
              .container {
                padding: 1.2rem 0.5rem;
                max-width: 90vw;
                margin: 2vh auto;
                border-radius: 10px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
              }
              .success {
                font-size: 1.4rem;
              }
              .btn {
                width: 100%;
                font-size: 1rem;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">Transaction Successful!</div>
            <hr class="gap" />
            <div class="order-info">
              <div><b>Order ID:</b> ${result.id}</div>
              <div><b>Amount:</b> ${result.amount} ${result.currency}</div>
              <div><b>Status:</b> ${result.status}</div>
            </div>
            <div class="redirect-msg">Thank you for your payment.<br>You will be redirected to the homepage shortly.</div>
          </div>
          <script>
            alert("Payment Success!\\nOrder ID: ${result.id}");
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error response:', err.response?.data);
    res.status(500).send(`
      <html>
        <head>
          <title>Payment Error</title>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>
            body {
              background: #f7f7f7;
              color: #222;
              font-family: 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 0;
              min-height: 100vh;
              min-height: 100dvh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: #fff;
              border-radius: 16px;
              box-shadow: 0 4px 24px rgba(0,0,0,0.07);
              padding: 2.5rem 2rem;
              max-width: 400px;
              width: 100%;
              text-align: center;
              box-sizing: border-box;
              word-break: break-word;
            }
            .fail {
              color: #d32f2f;
              font-size: 2rem;
              margin-bottom: 1rem;
            }
            .gap {
              margin: 1.5rem 0;
              background: #f7f7f7;
              height: 2px;
              border: none;
            }
            .redirect-msg {
              color: #888;
              margin-top: 1.5rem;
            }
            .btn {
              margin-top: 2rem;
              background: #78de78;
              color: #fff;
              border: none;
              border-radius: 8px;
              padding: 0.7rem 2rem;
              font-size: 1rem;
              cursor: pointer;
              transition: background 0.2s;
            }
            .btn:hover {
              background: #5fc95f;
            }
            @media (max-width: 600px) {
              .container {
                padding: 1.2rem 0.5rem;
                max-width: 90vw;
                margin: 2vh auto;
                border-radius: 10px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
              }
              .fail, .success {
                font-size: 1.4rem;
              }
              .btn {
                width: 100%;
                font-size: 1rem;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="fail">Payment Error</div>
            <hr class="gap" />
            <div>${err.response?.data?.error || err.message || "Unknown error"}</div>
            <div class="redirect-msg">You will be redirected to the homepage shortly.</div>
          </div>
          <script>
            alert("Payment error: ${err.response?.data?.error || err.message || "Unknown error"}");
          </script>
        </body>
      </html>
    `);
  }
});


app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
