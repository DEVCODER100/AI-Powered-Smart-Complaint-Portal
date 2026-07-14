// Vercel serverless entry point.
// Runs the whole Express API as a single function so every /api/* request is
// handled on the same domain as the deployed frontend (no separate backend
// service, no CORS). Vercel routes all /api/* paths here; the Express app's
// routes are already defined with the full "/api/..." prefix, so req.url
// matches directly.
import app from "../server/app.js";

export default app;
