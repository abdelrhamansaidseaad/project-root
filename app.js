require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas
// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('Connected to MongoDB Atlas'))
//   .catch(err => console.error('Could not connect to MongoDB Atlas', err));
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/card-system')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const employeeSchema = new mongoose.Schema({
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    permissions: { type: [String], default: [] }
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

const branchSchema = new mongoose.Schema({
    branchId: { type: String, required: true, unique: true },
    branchName: { type: String, required: true },
    location: { type: String, required: true }
});

// Models
const Employee = mongoose.model('Employee', employeeSchema);
const Card = mongoose.model('Card', cardSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Branch = mongoose.model('Branch', branchSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Routes

// Employee Registration
app.post('/api/register', async (req, res) => {
    try {
        const { employeeId, name, email, password } = req.body;
        
        // Check if employee already exists
        const existingEmployee = await Employee.findOne({ $or: [{ employeeId }, { email }] });
        if (existingEmployee) {
            return res.status(400).json({ message: 'Employee already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new employee
        const employee = new Employee({
            employeeId,
            name,
            email,
            password: hashedPassword,
            permissions: ['processWithdrawal'] // Default permission
        });
        
        await employee.save();
        
        res.status(201).json({ message: 'Employee registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering employee', error: error.message });
    }
});

// Employee Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find employee
        const employee = await Employee.findOne({ email });
        if (!employee) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, employee.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { employeeId: employee.employeeId, permissions: employee.permissions },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.json({ token, employeeId: employee.employeeId, name: employee.name });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
});

// Add new card (protected route)
app.post('/api/cards', async (req, res) => {
    try {
        // Verify token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const { cardNumber, holderName, initialBalance } = req.body;
        
        // Check if card already exists
        const existingCard = await Card.findOne({ cardNumber });
        if (existingCard) {
            return res.status(400).json({ message: 'Card already exists' });
        }
        
        // Create new card
        const card = new Card({
            cardNumber,
            holderName,
            balance: initialBalance || 0
        });
        
        await card.save();
        
        res.status(201).json({ message: 'Card added successfully', card });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.status(500).json({ message: 'Error adding card', error: error.message });
    }
});

// Process withdrawal (protected route)
app.post('/api/withdraw', async (req, res) => {
    try {
        // Verify token and check permission
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.permissions.includes('processWithdrawal')) {
            return res.status(403).json({ message: 'Permission denied' });
        }
        
        const { cardNumber, amount, branchId } = req.body;
        
        // Find card
        const card = await Card.findOne({ cardNumber });
        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }
        
        // Check balance
        if (card.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        
        // Update balance
        card.balance -= amount;
        await card.save();
        
        // Create transaction record
        const transaction = new Transaction({
            transactionId: require('crypto').randomUUID(),
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
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.status(500).json({ message: 'Error processing withdrawal', error: error.message });
    }
});

// Get all cards (protected route)
app.get('/api/cards', async (req, res) => {
    try {
        // Verify token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        jwt.verify(token, JWT_SECRET);
        
        const cards = await Card.find({});
        res.json(cards);
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.status(500).json({ message: 'Error fetching cards', error: error.message });
    }
});

// Get employee details (protected route)
app.get('/api/employees/:id', async (req, res) => {
    try {
        // Verify token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        jwt.verify(token, JWT_SECRET);
        
        const employee = await Employee.findOne({ employeeId: req.params.id });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        
        // Don't send password back
        const { password, ...employeeData } = employee.toObject();
        res.json(employeeData);
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.status(500).json({ message: 'Error fetching employee', error: error.message });
    }
});

// Serve HTML files
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

// Handle 404 for undefined routes
// app.use((req, res) => {
//     res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
// });
// معالجة المسارات غير الموجودة (404)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
  });

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, 'views', '500.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});