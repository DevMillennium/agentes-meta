import serverless from "serverless-http";
import { createApp } from "../src/app";
import { ensureBootstrap } from "../src/bootstrap";

const app = createApp();
const handler = serverless(app);

export default async function vercelHandler(
  req: Parameters<typeof handler>[0],
  res: Parameters<typeof handler>[1]
) {
  await ensureBootstrap();
  return handler(req, res);
}
