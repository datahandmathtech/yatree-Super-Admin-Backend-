// Super Admin Backend - Updated September 2026 for Live Fleet & DRS Operations
const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const SuperAdmin = require('./models/SuperAdmin');
const Tenant = require('./models/Tenant');
const { protect } = require('./middleware/superAdminAuth');

const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// DB Connection
const seedSuperAdmin = async () => {
    try {
        const email = 'admin@texi.com';
        const password = '@2526Bigday';
        
        let admin = await SuperAdmin.findOne({ email });
        if (!admin) {
            await SuperAdmin.create({
                name: 'System Controller',
                email,
                password
            });
            console.log(`--- SEED --- Created default Super Admin: ${email} / ${password}`);
        } else {
            // Force reset password for this admin to ensure user can login
            admin.password = password;
            await admin.save();
            console.log(`--- SEED --- Ensured Super Admin credentials: ${email} / ${password}`);
        }
    } catch (err) {
        console.error('Seed Error:', err);
    }
};

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('Super Admin MongoDB Connected');
    seedSuperAdmin();
})
.catch(err => console.error('MongoDB Error:', err));

// Define Dashboard Stats API here directly for simplicity
app.get('/api/dashboard/stats', protect, async (req, res) => {
    try {
        const totalTenants = await Tenant.countDocuments({});
        const activeTenants = await Tenant.countDocuments({ status: 'active' });
        const suspendedTenants = await Tenant.countDocuments({ status: 'suspended' });
        const trialTenants = await Tenant.countDocuments({ status: 'trial' });
        
        // Sum theoretical monthly revenue
        const revenue = await Tenant.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: null, total: { $sum: '$monthlyFee' } } }
        ]);

        res.json({
            totalTenants,
            activeTenants,
            suspendedTenants,
            trialTenants,
            monthlyRevenue: revenue.length > 0 ? revenue[0].total : 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));

// Serve static client assets in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (req, res) =>
        res.sendFile(path.resolve(__dirname, '..', 'dist', 'index.html'))
    );
} else {
    app.get('/', (req, res) => {
        res.send('Super Admin API is running on Port 4000');
    });
}

// Error Handling
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
});

app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Super Admin Server running on port ${PORT}`));
