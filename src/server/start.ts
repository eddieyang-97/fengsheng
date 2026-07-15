import { resolve } from "node:path";

import { createGameServer } from "./server";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? "0.0.0.0";
const production = process.env.NODE_ENV === "production";

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT 必须是1至65535之间的整数");
}

async function main(): Promise<void> {
  const server = createGameServer({
    staticDirectory: resolve("dist"),
    corsOrigin: production ? undefined : "http://localhost:5173",
  });

  await server.listen(port, hostname);
  console.log(`风声服务器已启动：http://${hostname}:${port}`);

  async function shutdown(): Promise<void> {
    await server.close();
    process.exit(0);
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void main();
