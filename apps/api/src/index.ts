import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.API_PORT ?? 3101);

try {
  await app.listen({ host: "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
