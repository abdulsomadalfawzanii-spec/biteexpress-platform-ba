const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`BiteExpress server listening on port ${PORT}`);
    });
  } catch (_error) {
    // Do not serve API requests that would fail because the database is down.
    // Deliberately omit connection details so secrets are never logged.
    console.error('MongoDB connection failed. The API was not started.');
    process.exit(1);
  }
};

startServer();
