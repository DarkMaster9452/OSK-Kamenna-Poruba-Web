require('dotenv').config({ path: '.env.vercel.example' });
const { fetchSportsnetPlayers } = require('./src/services/sportsnet-players.service');

// Mock console.error
const originalError = console.error;
console.error = (...args) => {};

async function run() {
  try {
    const data = await fetchSportsnetPlayers({ forceRefresh: true });
    console.log(JSON.stringify(data, null, 2).substring(0, 1000));
  } catch (err) {
    console.log('ERROR CAUGHT:');
    console.log('Status:', err.status);
    console.log('Message:', err.message);
    if (err.cause) console.log('Cause:', err.cause.message || err.cause);
  }
}

run();
