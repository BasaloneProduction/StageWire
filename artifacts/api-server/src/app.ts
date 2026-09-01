import express, { type Express, type NextFunction, type Request, type Response } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.disable("x-powered-by");
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
});
app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "StageWire API route not found." });
});
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const status = error && typeof error === "object" && "status" in error && typeof error.status === "number"
    ? error.status
    : 500;
  if (status === 400) return res.status(400).json({ error: "Request body is not valid." });
  if (status === 413) return res.status(413).json({ error: "Request is too large." });
  logger.error({ err: error }, "Unhandled API request error");
  return res.status(500).json({ error: "StageWire could not process that request." });
});

export default app;
