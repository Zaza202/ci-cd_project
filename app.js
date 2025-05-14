const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cloud-billing', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
});

// GCP Instance Types and Pricing (example rates - update with actual GCP pricing)
const GCP_INSTANCE_TYPES = {
  'e2-standard-2': {
    name: 'E2 Standard (2 vCPU)',
    cpu: 2,
    memory: 8,
    pricePerHour: 0.067012,
    pricePerMonth: 48.25,
  },
  'e2-standard-4': {
    name: 'E2 Standard (4 vCPU)',
    cpu: 4,
    memory: 16,
    pricePerHour: 0.134024,
    pricePerMonth: 96.50,
  },
  'n2-standard-2': {
    name: 'N2 Standard (2 vCPU)',
    cpu: 2,
    memory: 8,
    pricePerHour: 0.097014,
    pricePerMonth: 69.85,
  },
  'n2-standard-4': {
    name: 'N2 Standard (4 vCPU)',
    cpu: 4,
    memory: 16,
    pricePerHour: 0.194028,
    pricePerMonth: 139.70,
  },
};

// Storage Pricing (per GB per month)
const STORAGE_PRICING = {
  standard: 0.02, // Standard persistent disk
  ssd: 0.17, // SSD persistent disk
  network: 0.12, // Network storage
};

// Billing Schema
const billingSchema = new mongoose.Schema({
  instanceType: String,
  cpu: Number,
  memory: Number,
  storageType: String,
  storageSize: Number,
  hours: Number,
  cost: Number,
  date: { type: Date, default: Date.now },
  userId: String,
});

const Billing = mongoose.model('Billing', billingSchema);

// Calculate cost based on instance type and usage
function calculateCost(instanceType, storageType, storageSize, hours) {
  const instance = GCP_INSTANCE_TYPES[instanceType];
  if (!instance) {
    throw new Error('Invalid instance type');
  }

  const instanceCost = instance.pricePerHour * hours;
  const storageCost = STORAGE_PRICING[storageType] * storageSize * (hours / 730); // Convert to monthly rate

  return {
    instanceCost,
    storageCost,
    totalCost: instanceCost + storageCost,
  };
}

// Routes
app.get('/api/instance-types', (req, res) => {
  res.json(GCP_INSTANCE_TYPES);
});

app.get('/api/storage-types', (req, res) => {
  res.json(STORAGE_PRICING);
});

app.get('/api/billing', async (req, res) => {
  try {
    const bills = await Billing.find();
    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/billing', async (req, res) => {
  try {
    const {
      instanceType,
      storageType,
      storageSize,
      hours,
    } = req.body;
    const costs = calculateCost(instanceType, storageType, storageSize, hours);

    const billing = new Billing({
      instanceType,
      cpu: GCP_INSTANCE_TYPES[instanceType].cpu,
      memory: GCP_INSTANCE_TYPES[instanceType].memory,
      storageType,
      storageSize,
      hours,
      cost: costs.totalCost,
      userId: req.body.userId || 'user123',
    });

    const newBilling = await billing.save();
    res.status(201)
      .json(newBilling);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/billing/summary', async (req, res) => {
  try {
    const summary = await Billing.aggregate([
      {
        $group: {
          _id: '$instanceType',
          totalCost: { $sum: '$cost' },
          totalHours: { $sum: '$hours' },
          totalStorage: { $sum: '$storageSize' },
        },
      },
    ]);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
