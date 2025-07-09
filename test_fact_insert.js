const http = require('http');

const data = JSON.stringify({
  message: "My favorite motorcycle is a 2009 Harley Street Bob with a T143 crate motor and red powder coat.",
  history: []
});

const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/agent-simple',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(data);
req.end();
