// Entry point: import the app (which never listens on its own) and listen.
// Tests import server/app.js directly instead.
import app from "./app.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[api] AI Powered Complaint Portal backend listening on http://localhost:${PORT}`);
});
