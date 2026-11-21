const app = require('./app');
const { ensureSchema } = require('./config/schema');

const PORT = process.env.PORT || 4000;

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LIBR-AI-RY Node backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Could not prepare the database (is MySQL running and migrated?):', err.message);
    process.exit(1);
  });
