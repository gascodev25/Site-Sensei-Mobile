import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// ── Security headers (zero external deps, compatible with nginx overlay) ──────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://replit.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https:; " +
    "frame-src 'none'; " +
    "object-src 'none';"
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  next();
});

// ── Brute-force protection (zero external deps) ───────────────────────────────
// max 10 failed login attempts per IP per 15-minute window
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    if (now >= rec.resetAt) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000); // prune stale entries every 5 minutes

app.use("/api/login", (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;

  let rec = loginAttempts.get(ip);
  if (!rec || now >= rec.resetAt) {
    rec = { count: 0, resetAt: now + windowMs };
    loginAttempts.set(ip, rec);
  }

  if (rec.count >= maxAttempts) {
    const retryAfter = Math.ceil((rec.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.setHeader("X-RateLimit-Limit", String(maxAttempts));
    res.setHeader("X-RateLimit-Remaining", "0");
    return res.status(429).json({ message: "Too many login attempts. Please try again in 15 minutes." });
  }

  // Count this attempt; decrement on success in the response
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
    if (!isSuccess && rec) rec.count++;
    return originalJson(body);
  };

  next();
});

// ── General API rate limit: 300 requests per minute per IP ───────────────────
const apiCounts = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of apiCounts) {
    if (now >= rec.resetAt) apiCounts.delete(ip);
  }
}, 60 * 1000);

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqs = 300;

  let rec = apiCounts.get(ip);
  if (!rec || now >= rec.resetAt) {
    rec = { count: 0, resetAt: now + windowMs };
    apiCounts.set(ip, rec);
  }

  rec.count++;
  res.setHeader("X-RateLimit-Limit", String(maxReqs));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxReqs - rec.count)));

  if (rec.count > maxReqs) {
    return res.status(429).json({ message: "Too many requests. Please slow down." });
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
