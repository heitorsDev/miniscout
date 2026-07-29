import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  process.stdout.write(`backend listening on ${port}\n`);
});
