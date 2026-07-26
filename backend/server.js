const express = require('express');
const cors = require('cors');
const path = require('path');

const eventsRouter = require('./routes/events');
const statsRouter = require('./routes/stats');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4141;
app.listen(PORT, () => {
  console.log(`AICM backend listening on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/`);
});
