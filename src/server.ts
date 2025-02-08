import app from './app';
import { config } from './config/config';
import { logger } from './utils/logger';

const port = config.PORT || 8080;

app.listen(port, () => {
  logger.info(`🚀 Server running on port ${port}`);
  console.log(`🚀 Server running on port ${port}`);
});
