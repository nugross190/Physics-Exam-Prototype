// Synthetic load test simulating ~250 concurrent students.
// Usage: TARGET=https://your-app.koyeb.app npm run loadtest
const autocannon = require('autocannon');

const url = process.env.TARGET || 'http://localhost:8000';
const connections = parseInt(process.env.CONNECTIONS || '250', 10);
const duration = parseInt(process.env.DURATION || '60', 10);

async function run() {
  const instance = autocannon({
    url: url + '/healthz',
    connections,
    duration,
    pipelining: 1,
    requests: [
      { method: 'GET', path: '/healthz' },
      { method: 'GET', path: '/dashboard.html' }
    ]
  }, console.log);
  autocannon.track(instance, { renderProgressBar: true });
}
run();
