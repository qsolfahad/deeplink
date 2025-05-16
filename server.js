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
    const payload = {
      apiOperation: "INITIATE_CHECKOUT",
      checkoutMode: "WEBSITE",
      interaction: {
        operation: "PURCHASE",
        // merchant: {
        //   name: "TESTATMOSPHERGYM",
        //   url: "https://www.your.site.url.com"
        // },
        // returnUrl: "https://www.your.site.url.com" // must be a real URL
      },
      order: {
        currency: "PKR",
        amount: "250.00",
        id: "ORDER-" + Math.floor(Math.random() * 100000), // generate unique ID
        description: "Goods and Services"
      }
    };
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

    res.json(response.data);
  } catch (err) {
    console.error('Error creating session:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});


app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
