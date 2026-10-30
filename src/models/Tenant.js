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

    // 🌟 Advanced Multi-Tenant Feature Configuration
    businessModel: { type: String, enum: ['B2B', 'B2C', 'Both'], default: 'Both' },
    
    appAccess: {
        adminPortal: { type: Boolean, default: true },
        driverPortal: { type: Boolean, default: true },
        clientPortal: { type: Boolean, default: false }
    },

    driverAppSettings: {
        photoUploadCount: { type: Number, default: 3 }, // 0 = No photo, 1 = Only Meter, 2 = Selfie + Meter, 3 = Selfie + Meter + Car Front
        requireMeterReading: { type: Boolean, default: true },
        allowSelfPunch: { type: Boolean, default: true },
        dutyForm: {
            showMeterReading: { type: Boolean, default: true },
            showOutsideCityQuestion: { type: Boolean, default: true },
            showDutyDetails: { type: Boolean, default: true }
        },
        tabs: {
            showUpcomingRides: { type: Boolean, default: true },
            showSalaryLedger: { type: Boolean, default: true }
        },
        parking: {
            driverCanEnterAmount: { type: Boolean, default: true } // If false, driver only uploads slip, admin fills amount on approval
        },
        fuel: {
            showLiters: { type: Boolean, default: true },
            showFuelType: { type: Boolean, default: true },
            showAmount: { type: Boolean, default: true },
            showKm: { type: Boolean, default: true }
        }
    },

    operationalSettings: {
        parking: {
            enabled: { type: Boolean, default: true },
            trackPayment: { type: Boolean, default: true },
            driverCanEnterAmount: { type: Boolean, default: true }
        },
        fuel: {
            enabled: { type: Boolean, default: true },
            requireKmReading: { type: Boolean, default: true },
            showLiters: { type: Boolean, default: true },
            showFuelType: { type: Boolean, default: true },
            showAmount: { type: Boolean, default: true },
            showKm: { type: Boolean, default: true }
        },
        outsideCars: {
            enabled: { type: Boolean, default: true }
        },
        borderTax: {
            enabled: { type: Boolean, default: true }
        },
        fastag: {
            enabled: { type: Boolean, default: true }
        },
        maintenance: {
            enabled: { type: Boolean, default: true }
        },
        leads: {
            enabled: { type: Boolean, default: true }
        },
        drs: {
            enabled: { type: Boolean, default: true }
        },
        invoices: {
            enabled: { type: Boolean, default: true }
        }
    },

    salarySettings: {
        salaryType: { type: String, enum: ['monthly', 'daily_wage', 'per_duty', 'freelance'], default: 'monthly' },
        monthlyLeaveAllowance: { type: Number, default: 2 },
        carryForwardLeaves: { type: Boolean, default: false },
        dayAllowance: {
            enabled: { type: Boolean, default: true },
            defaultAmount: { type: Number, default: 200 }
        },
        nightAllowance: {
            enabled: { type: Boolean, default: true },
            defaultAmount: { type: Number, default: 250 }
        }
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
