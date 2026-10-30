const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    status: { type: String, default: 'active' },
    vehicleLimit: { type: Number, default: 10 },
    website: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    ownerSignatureUrl: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    businessModel: { type: String, enum: ['B2B', 'B2C', 'Both'], default: 'Both' },
    appAccess: { type: Object, default: () => ({ adminPortal: true, driverPortal: true, clientPortal: false }) },
    driverAppSettings: { type: Object, default: () => ({
        photoUploadCount: 3,
        requireMeterReading: true,
        allowSelfPunch: true,
        dutyForm: { showMeterReading: true, showOutsideCityQuestion: true, showDutyDetails: true },
        parking: { driverCanEnterAmount: true },
        fuel: { showLiters: true, showFuelType: true, showAmount: true, showKm: true }
    }) },
    operationalSettings: { type: Object, default: () => ({
        parking: { enabled: true, trackPayment: true, driverCanEnterAmount: true },
        fuel: { enabled: true, requireKmReading: true, showLiters: true, showFuelType: true, showAmount: true, showKm: true },
        outsideCars: { enabled: true },
        borderTax: { enabled: true },
        fastag: { enabled: true },
        maintenance: { enabled: true },
        leads: { enabled: true },
        drs: { enabled: true },
        invoices: { enabled: true }
    }) },
    salarySettings: { type: Object, default: () => ({
        salaryType: 'monthly',
        monthlyLeaveAllowance: 2,
        carryForwardLeaves: false,
        dayAllowance: { enabled: true, defaultAmount: 200 },
        nightAllowance: { enabled: true, defaultAmount: 250 }
    }) }
}, { timestamps: true, strict: false });

// We specify the collection name explicitly to match the main CRM
module.exports = mongoose.model('Company', companySchema, 'companies');
