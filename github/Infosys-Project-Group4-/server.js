const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory database (replace with MongoDB/PostgreSQL in production)
const db = {
  users: [],
  medicines: [],
  inventory: [],
  prescriptions: [],
  soldMedicines: [],
  reminders: [],
  doseConfirmations: [],
  notifications: [],
  auditLogs: []
};

// Initialize with default admin
const defaultAdmin = {
  id: 1,
  fullName: 'System Admin',
  email: 'admin@healthcare.com',
  mobile: '1234567890',
  password: bcrypt.hashSync('admin123', 10),
  role: 'admin',
  status: 'approved',
  createdAt: new Date()
};
db.users.push(defaultAdmin);

// Middleware for authentication
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

// ==================== AUTH ROUTES ====================

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, mobile, password, role, medicalLicenseNumber, secretCode } = req.body;

    // Validation
    if (!fullName || !email || !mobile || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Admin secret code validation
    if (role === 'admin' && secretCode !== '0000') {
      return res.status(400).json({ error: 'Invalid admin secret code' });
    }

    // Doctor validation
    if (role === 'doctor' && !medicalLicenseNumber) {
      return res.status(400).json({ error: 'Medical license number is required for doctors' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine status
    let status = 'approved';
    if (role === 'doctor' || role === 'pharmacist') {
      status = 'pending';
    }

    const newUser = {
      id: db.users.length + 1,
      fullName,
      email,
      mobile,
      password: hashedPassword,
      role,
      medicalLicenseNumber: role === 'doctor' ? medicalLicenseNumber : null,
      status,
      createdAt: new Date(),
      enabled: true
    };

    db.users.push(newUser);

    // Create notification for admin
    if (status === 'pending') {
      db.notifications.push({
        id: db.notifications.length + 1,
        userId: 1, // Admin
        message: `New ${role} registration pending approval: ${fullName}`,
        type: 'approval',
        read: false,
        createdAt: new Date()
      });
    }

    res.status(201).json({ 
      message: status === 'pending' 
        ? 'Registration successful. Waiting for admin approval.' 
        : 'Registration successful',
      status
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = db.users.find(u => u.email === email && u.role === role);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is approved
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Account pending approval' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Account has been rejected' });
    }

    if (!user.enabled) {
      return res.status(403).json({ error: 'Account has been disabled' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    medicalLicenseNumber: user.medicalLicenseNumber
  });
});

// ==================== DOCTOR ROUTES ====================

// Get all medicines for dropdown
app.get('/api/medicines', authenticate, (req, res) => {
  const medicines = db.medicines.map(m => ({ id: m.id, name: m.name }));
  res.json(medicines);
});

// Create prescription
app.post('/api/prescriptions', authenticate, authorize('doctor'), (req, res) => {
  try {
    const { patientId, medicines } = req.body;

    if (!patientId || !medicines || medicines.length === 0) {
      return res.status(400).json({ error: 'Patient and medicines are required' });
    }

    const prescriptionId = db.prescriptions.length + 1;
    const createdPrescriptions = [];

    medicines.forEach(med => {
      const { medicineId, medicineName, startDate, duration, frequency } = med;

      // Calculate doses per day
      const dosesPerDay = {
        'once-per-day': 1,
        'twice-per-day': 2,
        'three-times-per-day': 3,
        'four-times-per-day': 4,
        'every-6-hours': 4,
        'every-8-hours': 3
      }[frequency] || 1;

      // Calculate end date
      const start = new Date(startDate);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + parseInt(duration));

      // Check if medicine exists in inventory
      let finalMedicineId = medicineId;
      if (!medicineId && medicineName) {
        // Add new medicine to master list
        const newMedicine = {
          id: db.medicines.length + 1,
          name: medicineName,
          createdAt: new Date()
        };
        db.medicines.push(newMedicine);
        finalMedicineId = newMedicine.id;

        // Alert pharmacist
        db.notifications.push({
          id: db.notifications.length + 1,
          userId: db.users.find(u => u.role === 'pharmacist')?.id,
          message: `New medicine "${medicineName}" prescribed but not in inventory`,
          type: 'alert',
          read: false,
          createdAt: new Date()
        });
      }

      const prescription = {
        id: db.prescriptions.length + 1,
        prescriptionGroupId: prescriptionId,
        doctorId: req.userId,
        patientId,
        medicineId: finalMedicineId,
        medicineName: medicineName || db.medicines.find(m => m.id === medicineId)?.name,
        startDate: start,
        endDate,
        duration: parseInt(duration),
        frequency,
        dosesPerDay,
        totalQuantity: parseInt(duration) * dosesPerDay,
        status: 'active',
        bought: false,
        createdAt: new Date()
      };

      db.prescriptions.push(prescription);
      createdPrescriptions.push(prescription);
    });

    res.status(201).json({ 
      message: 'Prescription created successfully',
      prescriptions: createdPrescriptions
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get doctor's prescriptions
app.get('/api/doctor/prescriptions', authenticate, authorize('doctor'), (req, res) => {
  const { status } = req.query;
  
  let prescriptions = db.prescriptions.filter(p => p.doctorId === req.userId);

  // Auto-complete expired prescriptions
  const now = new Date();
  prescriptions.forEach(p => {
    if (p.status === 'active' && new Date(p.endDate) < now) {
      p.status = 'completed';
    }
  });

  if (status) {
    prescriptions = prescriptions.filter(p => p.status === status);
  }

  // Enrich with patient info
  prescriptions = prescriptions.map(p => ({
    ...p,
    patient: db.users.find(u => u.id === p.patientId)
  }));

  res.json(prescriptions);
});

// Doctor analytics
app.get('/api/doctor/analytics', authenticate, authorize('doctor'), (req, res) => {
  const prescriptions = db.prescriptions.filter(p => p.doctorId === req.userId);
  const active = prescriptions.filter(p => p.status === 'active').length;
  const completed = prescriptions.filter(p => p.status === 'completed').length;

  // Calculate average adherence
  const patientIds = [...new Set(prescriptions.map(p => p.patientId))];
  let totalAdherence = 0;
  patientIds.forEach(patientId => {
    const patientPrescriptions = prescriptions.filter(p => p.patientId === patientId);
    const confirmedDoses = db.doseConfirmations.filter(d => 
      patientPrescriptions.some(p => p.id === d.prescriptionId) && d.status === 'taken'
    ).length;
    const totalDoses = db.reminders.filter(r => 
      patientPrescriptions.some(p => p.id === r.prescriptionId)
    ).length;
    if (totalDoses > 0) {
      totalAdherence += (confirmedDoses / totalDoses) * 100;
    }
  });
  const avgAdherence = patientIds.length > 0 ? totalAdherence / patientIds.length : 0;

  res.json({
    totalPrescriptions: prescriptions.length,
    activePrescriptions: active,
    completedPrescriptions: completed,
    avgPatientAdherence: avgAdherence.toFixed(1)
  });
});

// Get patients list
app.get('/api/patients', authenticate, authorize('doctor'), (req, res) => {
  const patients = db.users.filter(u => u.role === 'patient').map(u => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    mobile: u.mobile
  }));
  res.json(patients);
});

// ==================== PHARMACIST ROUTES ====================

// Inventory CRUD
app.post('/api/inventory', authenticate, authorize('pharmacist'), (req, res) => {
  const { medicineId, medicineName, batchNumber, expiryDate, stockQuantity } = req.body;

  let finalMedicineId = medicineId;
  let finalMedicineName = medicineName;

  // If medicine doesn't exist, create it
  if (!medicineId && medicineName) {
    const newMedicine = {
      id: db.medicines.length + 1,
      name: medicineName,
      createdAt: new Date()
    };
    db.medicines.push(newMedicine);
    finalMedicineId = newMedicine.id;
  } else if (medicineId) {
    finalMedicineName = db.medicines.find(m => m.id === medicineId)?.name;
  }

  const inventoryItem = {
    id: db.inventory.length + 1,
    medicineId: finalMedicineId,
    medicineName: finalMedicineName,
    batchNumber,
    expiryDate: new Date(expiryDate),
    stockQuantity: parseInt(stockQuantity),
    createdAt: new Date()
  };

  db.inventory.push(inventoryItem);
  res.status(201).json(inventoryItem);
});

app.get('/api/inventory', authenticate, authorize('pharmacist', 'admin'), (req, res) => {
  const now = new Date();
  const inventory = db.inventory.map(item => ({
    ...item,
    isExpired: new Date(item.expiryDate) < now,
    isLowStock: item.stockQuantity <= 100
  }));
  res.json(inventory);
});

app.put('/api/inventory/:id', authenticate, authorize('pharmacist'), (req, res) => {
  const { id } = req.params;
  const { batchNumber, expiryDate, stockQuantity } = req.body;

  const item = db.inventory.find(i => i.id === parseInt(id));
  if (!item) return res.status(404).json({ error: 'Item not found' });

  if (batchNumber) item.batchNumber = batchNumber;
  if (expiryDate) item.expiryDate = new Date(expiryDate);
  if (stockQuantity !== undefined) item.stockQuantity = parseInt(stockQuantity);

  res.json(item);
});

app.delete('/api/inventory/:id', authenticate, authorize('pharmacist'), (req, res) => {
  const { id } = req.params;
  const index = db.inventory.findIndex(i => i.id === parseInt(id));
  if (index === -1) return res.status(404).json({ error: 'Item not found' });

  db.inventory.splice(index, 1);
  res.json({ message: 'Item deleted' });
});

// Get prescriptions for selling
app.get('/api/pharmacist/prescriptions', authenticate, authorize('pharmacist'), (req, res) => {
  const { status } = req.query;
  
  let prescriptions = db.prescriptions.filter(p => p.status === 'active');

  if (status === 'history') {
    prescriptions = db.soldMedicines.map(s => ({
      ...db.prescriptions.find(p => p.id === s.prescriptionId),
      soldAt: s.soldAt,
      soldQuantity: s.quantity
    }));
  } else {
    // Enrich with doctor and patient info
    prescriptions = prescriptions.map(p => ({
      ...p,
      doctor: db.users.find(u => u.id === p.doctorId),
      patient: db.users.find(u => u.id === p.patientId)
    }));
  }

  res.json(prescriptions);
});

// Sell medicine
app.post('/api/pharmacist/sell/:id', authenticate, authorize('pharmacist'), (req, res) => {
  const { id } = req.params;
  const prescription = db.prescriptions.find(p => p.id === parseInt(id));

  if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
  if (prescription.bought) return res.status(400).json({ error: 'Already sold' });

  // Find inventory
  const inventory = db.inventory.find(i => i.medicineId === prescription.medicineId);
  if (!inventory || inventory.stockQuantity < prescription.totalQuantity) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }

  // Update inventory
  inventory.stockQuantity -= prescription.totalQuantity;

  // Mark as bought
  prescription.bought = true;

  // Record sale
  db.soldMedicines.push({
    id: db.soldMedicines.length + 1,
    prescriptionId: prescription.id,
    medicineId: prescription.medicineId,
    quantity: prescription.totalQuantity,
    soldAt: new Date()
  });

  // Generate reminders for patient
  generateReminders(prescription);

  res.json({ message: 'Medicine sold successfully', prescription });
});

// Generate reminders based on prescription
function generateReminders(prescription) {
  const { id, patientId, startDate, endDate, frequency, dosesPerDay } = prescription;
  
  const reminderTimes = {
    'once-per-day': ['09:00'],
    'twice-per-day': ['09:00', '21:00'],
    'three-times-per-day': ['08:00', '14:00', '20:00'],
    'four-times-per-day': ['08:00', '12:00', '16:00', '20:00'],
    'every-6-hours': ['06:00', '12:00', '18:00', '00:00'],
    'every-8-hours': ['08:00', '16:00', '00:00']
  }[frequency] || ['09:00'];

  const start = new Date(startDate);
  const end = new Date(endDate);
  const currentDate = new Date(start);

  while (currentDate <= end) {
    reminderTimes.forEach(time => {
      const [hours, minutes] = time.split(':');
      const reminderDateTime = new Date(currentDate);
      reminderDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      db.reminders.push({
        id: db.reminders.length + 1,
        prescriptionId: id,
        patientId,
        reminderTime: reminderDateTime,
        status: 'pending',
        createdAt: new Date()
      });
    });
    currentDate.setDate(currentDate.setDate() + 1);
  }
}

// Pharmacist analytics
app.get('/api/pharmacist/analytics', authenticate, authorize('pharmacist'), (req, res) => {
  const totalMedicines = db.inventory.length;
  const lowStock = db.inventory.filter(i => i.stockQuantity <= 100).length;
  
  // Monthly sales
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthlySales = db.soldMedicines.filter(s => 
    new Date(s.soldAt) >= thirtyDaysAgo
  ).length;

  res.json({
    totalMedicines,
    lowStockCount: lowStock,
    monthlySales
  });
});

// ==================== PATIENT ROUTES ====================

// Get patient prescriptions
app.get('/api/patient/prescriptions', authenticate, authorize('patient'), (req, res) => {
  const { status } = req.query;
  
  let prescriptions = db.prescriptions.filter(p => p.patientId === req.userId);

  // Auto-complete expired prescriptions
  const now = new Date();
  prescriptions.forEach(p => {
    if (p.status === 'active' && new Date(p.endDate) < now) {
      p.status = 'completed';
    }
  });

  if (status) {
    prescriptions = prescriptions.filter(p => p.status === status);
  }

  // Enrich with doctor info
  prescriptions = prescriptions.map(p => ({
    ...p,
    doctor: db.users.find(u => u.id === p.doctorId)
  }));

  res.json(prescriptions);
});

// Get reminders
app.get('/api/patient/reminders', authenticate, authorize('patient'), (req, res) => {
  const prescriptions = db.prescriptions.filter(p => 
    p.patientId === req.userId && 
    p.status === 'active' && 
    p.bought
  );

  const prescriptionIds = prescriptions.map(p => p.id);
  const reminders = db.reminders.filter(r => prescriptionIds.includes(r.prescriptionId));

  // Enrich with prescription info
  const enrichedReminders = reminders.map(r => ({
    ...r,
    prescription: prescriptions.find(p => p.id === r.prescriptionId)
  }));

  res.json(enrichedReminders);
});

// Update reminder time
app.put('/api/patient/reminders/:id', authenticate, authorize('patient'), (req, res) => {
  const { id } = req.params;
  const { reminderTime } = req.body;

  const reminder = db.reminders.find(r => r.id === parseInt(id));
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

  reminder.reminderTime = new Date(reminderTime);
  res.json(reminder);
});

// Confirm/Skip dose
app.post('/api/patient/reminders/:id/confirm', authenticate, authorize('patient'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'taken' or 'missed'

  const reminder = db.reminders.find(r => r.id === parseInt(id));
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

  reminder.status = status;

  db.doseConfirmations.push({
    id: db.doseConfirmations.length + 1,
    reminderId: reminder.id,
    prescriptionId: reminder.prescriptionId,
    patientId: req.userId,
    status,
    confirmedAt: new Date()
  });

  res.json({ message: 'Status updated', reminder });
});

// Patient analytics
app.get('/api/patient/analytics', authenticate, authorize('patient'), (req, res) => {
  const prescriptions = db.prescriptions.filter(p => p.patientId === req.userId);
  const prescriptionIds = prescriptions.map(p => p.id);
  
  const totalReminders = db.reminders.filter(r => prescriptionIds.includes(r.prescriptionId)).length;
  const takenDoses = db.doseConfirmations.filter(d => 
    prescriptionIds.includes(d.prescriptionId) && d.status === 'taken'
  ).length;

  const adherence = totalReminders > 0 ? (takenDoses / totalReminders) * 100 : 0;

  // Weekly adherence
  const now = new Date();
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayReminders = db.reminders.filter(r => {
      const rt = new Date(r.reminderTime);
      return prescriptionIds.includes(r.prescriptionId) && rt >= date && rt < nextDate;
    }).length;

    const dayTaken = db.doseConfirmations.filter(d => {
      const ct = new Date(d.confirmedAt);
      return prescriptionIds.includes(d.prescriptionId) && 
             d.status === 'taken' && 
             ct >= date && ct < nextDate;
    }).length;

    const dayAdherence = dayReminders > 0 ? (dayTaken / dayReminders) * 100 : 0;

    weeklyData.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      adherence: dayAdherence.toFixed(1)
    });
  }

  res.json({
    adherencePercentage: adherence.toFixed(1),
    weeklyAdherence: weeklyData
  });
});

// ==================== ADMIN ROUTES ====================

// Get all users
app.get('/api/admin/users', authenticate, authorize('admin'), (req, res) => {
  const { status, role } = req.query;
  
  let users = db.users.filter(u => u.id !== req.userId);

  if (status) users = users.filter(u => u.status === status);
  if (role) users = users.filter(u => u.role === role);

  res.json(users);
});

// Approve/Reject user
app.put('/api/admin/users/:id/status', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  const user = db.users.find(u => u.id === parseInt(id));
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.status = status;

  // Audit log
  db.auditLogs.push({
    id: db.auditLogs.length + 1,
    adminId: req.userId,
    action: `${status} user`,
    targetUserId: user.id,
    timestamp: new Date()
  });

  // Notification
  db.notifications.push({
    id: db.notifications.length + 1,
    userId: user.id,
    message: `Your account has been ${status}`,
    type: 'status',
    read: false,
    createdAt: new Date()
  });

  res.json({ message: 'Status updated', user });
});

// Enable/Disable user
app.put('/api/admin/users/:id/toggle', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const user = db.users.find(u => u.id === parseInt(id));
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.enabled = !user.enabled;

  db.auditLogs.push({
    id: db.auditLogs.length + 1,
    adminId: req.userId,
    action: user.enabled ? 'enabled user' : 'disabled user',
    targetUserId: user.id,
    timestamp: new Date()
  });

  res.json({ message: 'User toggled', user });
});

// Delete user
app.delete('/api/admin/users/:id', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const index = db.users.findIndex(u => u.id === parseInt(id));
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  const user = db.users[index];
  db.users.splice(index, 1);

  db.auditLogs.push({
    id: db.auditLogs.length + 1,
    adminId: req.userId,
    action: 'deleted user',
    targetUserId: parseInt(id),
    timestamp: new Date()
  });

  res.json({ message: 'User deleted' });
});

// Get all prescriptions (read-only)
app.get('/api/admin/prescriptions', authenticate, authorize('admin'), (req, res) => {
  const prescriptions = db.prescriptions.map(p => ({
    ...p,
    doctor: db.users.find(u => u.id === p.doctorId),
    patient: db.users.find(u => u.id === p.patientId)
  }));
  res.json(prescriptions);
});

// Admin analytics
app.get('/api/admin/analytics', authenticate, authorize('admin'), (req, res) => {
  const totalUsers = db.users.length;
  const totalDoctors = db.users.filter(u => u.role === 'doctor').length;
  const totalPatients = db.users.filter(u => u.role === 'patient').length;
  const totalPharmacists = db.users.filter(u => u.role === 'pharmacist').length;
  const totalPrescriptions = db.prescriptions.length;
  const lowStockCount = db.inventory.filter(i => i.stockQuantity <= 100).length;

  res.json({
    totalUsers,
    totalDoctors,
    totalPatients,
    totalPharmacists,
    totalPrescriptions,
    lowStockCount
  });
});

// Get notifications
app.get('/api/notifications', authenticate, (req, res) => {
  const notifications = db.notifications.filter(n => n.userId === req.userId);
  res.json(notifications);
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticate, (req, res) => {
  const notification = db.notifications.find(n => n.id === parseInt(req.params.id));
  if (notification) {
    notification.read = true;
    res.json(notification);
  } else {
    res.status(404).json({ error: 'Notification not found' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
