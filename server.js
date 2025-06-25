const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Add this line
const app = express();

app.use(cors()); // Allow all origins — for dev only
// Middleware to parse JSON request bodies
app.use(express.json());

app.post('/create-session', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    // Use the same secret as used to sign the JWT
    const JWT_SECRET = 'a-string-secret-at-least-256-bits-long'; // <-- set this to your actual secret
    let decoded;
    try {
      console.log('Verifying token:', token);
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const amount = decoded.amount;
    if (!amount) {
      return res.status(400).json({ error: 'Amount missing in token' });
    }

    const credentials = 'TESTATMOSPHERGYM:607b0aa9d9f0e558118b9a9827bbc47e';
    const authHeader = 'Basic ' + Buffer.from(credentials).toString('base64');
    const payload = {
      apiOperation: "INITIATE_CHECKOUT",
      checkoutMode: "WEBSITE",
      interaction: {
        operation: "PURCHASE",
        merchant: {
          name: "TESTATMOSPHERGYM",
          url: "http://localhost:3000/success"
        },
        returnUrl: "http://localhost:3000/success"
      },
      order: {
        currency: "PKR",
        amount: amount.toFixed(2), // Use amount from token
        id: "ORDER-" + Math.floor(Math.random() * 100000),
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
          Authorization: `Basic bWVyY2hhbnQuVEVTVEFUTU9TUEhFUkdZTTo2MDdiMGFhOWQ5ZjBlNTU4MTE4YjlhOTgyN2JiYzQ3ZQ==`,
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error('Error creating session:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.get('/success', (req, res) => {
  // Handle success response from the payment gateway
  console.log('Payment successful:', req.query);
  res.send('Payment was successful!');
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
