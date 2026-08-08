require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    const dbConnected = await connectDB();

    app.listen(PORT, () => {
      console.log(`Hive backend running on port ${PORT}`);
      if (!dbConnected) {
        console.log('Database connectivity is offline; API is running in fallback mode.');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
