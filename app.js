require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  permissions: { type: [String], default: ['processWithdrawal'] }
});

const cardSchema = new mongoose.Schema({
  cardNumber: { type: String, required: true, unique: true },
  holderName: { type: String, required: true },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  cardNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  branchId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['withdrawal', 'deposit'], required: true }
});

// Models
const Employee = mongoose.model('Employee', employeeSchema);
const Card = mongoose.model('Card', cardSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// JWT Config
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Routes

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/add-card', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'add-card.html'));
});

app.get('/withdraw', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'withdraw.html'));
});

app.get('/employees', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'employees.html'));
});

// API Routes
app.post('/api/register', async (req, res) => {
  try {
    const { employeeId, name, email, password } = req.body;
    
    const existingEmployee = await Employee.findOne({ $or: [{ employeeId }, { email }] });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const employee = new Employee({
      employeeId,
      name,
      email,
      password: hashedPassword
    });
    
    await employee.save();
    
    res.status(201).json({ message: 'Employee registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering employee', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { employeeId: employee.employeeId, permissions: employee.permissions },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ 
      token, 
      employeeId: employee.employeeId, 
      name: employee.name 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Protected routes middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Protected routes
app.get('/api/cards', authenticate, async (req, res) => {
  try {
    const cards = await Card.find({});
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cards', error: error.message });
  }
});

app.post('/api/cards', authenticate, async (req, res) => {
  try {
    const { cardNumber, holderName, initialBalance } = req.body;
    
    const existingCard = await Card.findOne({ cardNumber });
    if (existingCard) {
      return res.status(400).json({ message: 'Card already exists' });
    }
    
    const card = new Card({
      cardNumber,
      holderName,
      balance: initialBalance || 0
    });
    
    await card.save();
    
    res.status(201).json({ message: 'Card added successfully', card });
  } catch (error) {
    res.status(500).json({ message: 'Error adding card', error: error.message });
  }
});

app.post('/api/withdraw', authenticate, async (req, res) => {
  try {
    if (!req.user.permissions.includes('processWithdrawal')) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const { cardNumber, amount, branchId } = req.body;
    
    const card = await Card.findOne({ cardNumber });
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }
    
    if (card.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    card.balance -= amount;
    await card.save();
    
    const transaction = new Transaction({
      transactionId: crypto.randomUUID(),
      cardNumber,
      amount,
      branchId,
      type: 'withdrawal'
    });
    
    await transaction.save();
    
    res.json({ 
      message: 'Withdrawal processed successfully',
      newBalance: card.balance,
      transactionId: transaction.transactionId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing withdrawal', error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});