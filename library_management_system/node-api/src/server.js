const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`LIBR-AI-RY Node backend running on port ${PORT}`);
});