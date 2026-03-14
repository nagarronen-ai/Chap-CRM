// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/users', require('./routes/users'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/finance', require('./routes/finance'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));