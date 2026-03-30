const app = require('./app');
const env = require('./config/env');
const { closeExpiredTrainings } = require('./data/repository');

const TRAINING_AUTO_CLOSE_INTERVAL_MS = 60 * 1000;

async function runTrainingAutoClose() {
  try {
    await closeExpiredTrainings();
  } catch (error) {
    console.error('Auto-close trainings failed:', error);
  }
}

runTrainingAutoClose();
setInterval(runTrainingAutoClose, TRAINING_AUTO_CLOSE_INTERVAL_MS);

app.listen(env.port, () => {
  console.log(`Backend API beží na porte ${env.port}`);
});