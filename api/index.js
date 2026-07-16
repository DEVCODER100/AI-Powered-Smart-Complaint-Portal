// Vercel serverless entry point — the entire Express API as one function.
// vercel.json rewrites every "/api/*" request to this function; the Express
// routes are defined with the full "/api/..." prefix and Vercel preserves the
// original request URL, so they match directly (all methods, all depths).
import app from "../server/app.js";

export default app;
