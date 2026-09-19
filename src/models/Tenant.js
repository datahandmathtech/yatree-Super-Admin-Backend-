const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    // Company Info
    companyName: { type: String, required: true },
    ownerName: { type: String, required: true },
    email: { type: String, unique: true, lowercase: true, sparse: true },
    phone: { type: String, required: true },
    whatsappNumber: { type: String, default: '' },
    address: { type: String, default: '' },
    logo: { type: String, default: '' },
    website: { type: String, default: '' },
    signature: { type: String, default: '' },
    businessType: { type: String, default: 'Taxi Fleet' },
    crmType: { type: String, enum: ['LogKaro Fleet', 'School Management', 'Modified Fleet'], default: 'LogKaro Fleet' },

    // Admin Login Credentials (for main CRM login)
    adminEmail: { type: String, required: true, unique: true, lowercase: true },
    adminPassword: { type: String, required: true }, // plain for display, hashed in main DB

    // Subscription
    plan: { type: String, enum: ['trial', 'basic', 'pro', 'enterprise'], default: 'trial' },
    status: { type: String, enum: ['active', 'suspended', 'expired', 'trial'], default: 'trial' },
    trialEndsAt: { type: Date },
    expiresAt: { type: Date },
    monthlyFee: { type: Number, default: 0 },
    vehicleLimit: { type: Number, default: 10 }, // New field: Limit of vehicles
    permissions: {
        dashboard: { type: Boolean, default: true },
        liveFeed: { type: Boolean, default: true },
        logBook: { type: Boolean, default: true },
        driversService: { type: Boolean, default: true },
        fleetOperations: { type: Boolean, default: true },
        buySell: { type: Boolean, default: true },
        vehiclesManagement: { type: Boolean, default: true },
        staffManagement: { type: Boolean, default: true },
        manageAdmins: { type: Boolean, default: true },
        reports: { type: Boolean, default: true }
    },

    // Linked to existing Company & User in main DB
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Usage (updated periodically)
    driverCount: { type: Number, default: 0 },
    vehicleCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date },

    // Notes
    notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);
