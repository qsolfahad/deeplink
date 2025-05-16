// server.js or api/session.js
const express = require('express');
const axios = require('axios');
const app = express();

app.get('/create-session', async (req, res) => {
  try {
    const response = await axios.post(
      'https://ap-gateway.mastercard.com/api/rest/version/100/merchant/TESTATMOSPHERGYM/session',
      {
        apiOperation: 'CREATE_CHECKOUT_SESSION',
        interaction: {
          merchant: 'Atmosphere Gym' // Your business name
        },
        order: {
          amount: '100.00',
          currency: 'PKR'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            'Basic ' +
            Buffer.from(
              'TESTATMOSPHERGYM:607b0aa9d9f0e558118b9a9827bbc47e'
            ).toString('base64')
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response.data });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
