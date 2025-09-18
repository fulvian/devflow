const http = require('http');

// Test limit parsing and scheduling
const postData = JSON.stringify({
  limitMessage: "5-hour limit reached ∙ resets 1am"
});

const options = {
  hostname: 'localhost',
  port: 8889,
  path: '/notify-limit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(postData);
req.end();