import { app } from './app.js';

const PORT = process.env.PORT ?? 4000;
console.log(`PORT is set to: ${PORT}`);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
