import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./common/logger";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Phoenix API rodando na porta ${env.PORT}`);
});
