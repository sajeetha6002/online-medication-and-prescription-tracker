# 🚀 Quick Start Guide

## Instant Setup (3 Steps)

### Step 1: Install Dependencies
```bash
npm install
```

This installs:
- express (web server)
- bcryptjs (password encryption)
- jsonwebtoken (authentication)
- cors (cross-origin support)

### Step 2: Start Server
```bash
npm start
```

Server will start at: **http://localhost:3000**

### Step 3: Open Browser
Navigate to: **http://localhost:3000**

## 🎯 First Login Options

### Option 1: Use Default Admin
- Email: `admin@healthcare.com`
- Password: `admin123`
- Role: Admin

### Option 2: Create New Account
Click "Sign Up" and choose your role

## 🔑 Account Types

### 👨‍⚕️ Doctor
- **Signup**: Requires Medical License Number
- **Status**: Needs admin approval
- **Access**: Create prescriptions, view analytics

### 👩‍⚕️ Pharmacist  
- **Signup**: Standard registration
- **Status**: Needs admin approval
- **Access**: Manage inventory, sell medicines

### 🧑‍🦱 Patient
- **Signup**: Standard registration  
- **Status**: Auto-approved
- **Access**: View prescriptions, track adherence

### 🛡️ Admin
- **Signup**: Requires secret code `0000`
- **Status**: Auto-approved
- **Access**: Full system control

## 📋 Quick Testing Workflow

### 1. Create Admin Account
```
Sign Up → Admin → Secret: 0000 → Submit
```

### 2. Create Doctor Account
```
Sign Up → Doctor → Add License: MD123456 → Submit
Login as Admin → Approve Doctor
```

### 3. Create Patient Account
```
Sign Up → Patient → Submit → Auto Login
```

### 4. Create Pharmacist Account
```
Sign Up → Pharmacist → Submit
Login as Admin → Approve Pharmacist
```

### 5. Doctor Creates Prescription
```
Login as Doctor → New Prescription → Select Patient → Add Medicine → Submit
```

### 6. Pharmacist Adds Inventory
```
Login as Pharmacist → Add Stock → Fill Details → Submit
```

### 7. Pharmacist Sells Medicine
```
View Prescriptions → Click Sell → Confirm
```

### 8. Patient Tracks Medication
```
Login as Patient → View Reminders → Confirm Doses
```

## 🎨 UI Features Showcase

### Dark Theme
- All pages use consistent dark theme
- Smooth animations and transitions
- Color-coded status badges
- Interactive hover effects

### Analytics Charts
- Patient adherence graphs
- Weekly compliance tracking
- Real-time statistics

### Responsive Tables
- Sortable columns
- Hover highlights
- Mobile-friendly

## 🔧 Troubleshooting

### Port Already in Use
Change port in `server.js`:
```javascript
const PORT = 3001; // or any available port
```

### Cannot Connect to Server
Check if server is running:
```bash
npm start
```

### Login Not Working
1. Check credentials
2. Verify role selection matches account
3. Check if account is approved (for doctor/pharmacist)

### Prescriptions Not Showing
1. Ensure prescription is created
2. Check correct tab (Active/History)
3. Verify user role permissions

## 📊 Sample Data

Want to test with sample data? Use these test accounts:

```javascript
// Add to server.js after default admin creation

// Sample Doctor
db.users.push({
  id: 2,
  fullName: 'Dr. Sarah Johnson',
  email: 'doctor@test.com',
  mobile: '1234567891',
  password: bcrypt.hashSync('doctor123', 10),
  role: 'doctor',
  medicalLicenseNumber: 'MD789456',
  status: 'approved',
  enabled: true,
  createdAt: new Date()
});

// Sample Patient
db.users.push({
  id: 3,
  fullName: 'John Patient',
  email: 'patient@test.com',
  mobile: '1234567892',
  password: bcrypt.hashSync('patient123', 10),
  role: 'patient',
  status: 'approved',
  enabled: true,
  createdAt: new Date()
});

// Sample Pharmacist
db.users.push({
  id: 4,
  fullName: 'Mike Pharmacist',
  email: 'pharmacist@test.com',
  mobile: '1234567893',
  password: bcrypt.hashSync('pharmacist123', 10),
  role: 'pharmacist',
  status: 'approved',
  enabled: true,
  createdAt: new Date()
});
```

## 🎓 Learning Path

### Beginners
1. Start as Patient - simplest interface
2. Explore prescriptions and reminders
3. Check analytics dashboard

### Intermediate
1. Try Doctor role - create prescriptions
2. Use Pharmacist role - manage inventory
3. Understand the workflow

### Advanced
1. Admin role - full system control
2. Test approval workflows
3. Monitor analytics

## 💡 Tips & Tricks

### Keyboard Shortcuts
- Press `Esc` to close modals
- Tab through form fields
- Enter to submit forms

### Best Practices
- Use meaningful medicine names
- Set realistic durations
- Check stock before selling
- Regularly review analytics

### Performance
- System handles 1000+ records smoothly
- In-memory DB resets on server restart
- For production: integrate real database

## 🌟 Feature Highlights

### Smart Auto-Calculation
- End dates calculated automatically
- Doses per day based on frequency
- Total quantity computed instantly

### Intelligent Alerts
- Low stock warnings
- Expired medicine flags
- Pending approval notifications

### Real-time Updates
- Instant UI refresh after actions
- Live status updates
- Dynamic chart rendering

## 📱 Mobile Testing

Open on mobile:
1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Access: `http://YOUR_IP:3000`
3. Test responsive design

## 🔐 Security Notes

### Development
- Default passwords are simple
- JWT secret is basic
- No HTTPS required

### Production
- Change all secrets
- Use environment variables
- Enable HTTPS
- Implement rate limiting
- Add input sanitization

## 🆘 Common Issues

**Issue**: "Invalid token" error
**Solution**: Logout and login again

**Issue**: Prescriptions not updating
**Solution**: Refresh the page

**Issue**: Modal not closing
**Solution**: Click X button or click outside

**Issue**: Chart not displaying
**Solution**: Check browser console for errors

## 📞 Getting Help

1. Check README.md for detailed docs
2. Review API endpoints section
3. Inspect browser console for errors
4. Check server logs in terminal

## 🎉 Success Checklist

- [ ] Server running on port 3000
- [ ] Can access login page
- [ ] Created admin account
- [ ] Approved doctor/pharmacist
- [ ] Created prescription
- [ ] Added inventory
- [ ] Sold medicine
- [ ] Viewed analytics

**All checked? Congratulations! You're ready to explore the full system!** 🚀

---

**Next Steps**: Customize the system, integrate a real database, or add new features!
