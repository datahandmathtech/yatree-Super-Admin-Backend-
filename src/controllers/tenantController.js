const asyncHandler = require('express-async-handler');
const Tenant = require('../models/Tenant');
const Company = require('../models/Company');
const User = require('../models/User');
const { getModelsForCrm } = require('../config/dbConnections');
const Vehicle = require('../models/Vehicle');
const jwt = require('jsonwebtoken');

const generateBridgeToken = (user, companyId) => {
    return jwt.sign(
        { 
            id: user._id, 
            company: companyId,
            isSuperAdminProxy: true,
            role: 'Admin'
        }, 
        process.env.SUPER_ADMIN_BRIDGE_SECRET || 'fallback_bridge_secret', 
        { expiresIn: '1h' }
    );
};

// @desc    Get all tenants
// @route   GET /api/tenants
// @access  Private (Super Admin)
const getTenants = asyncHandler(async (req, res) => {
    const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean();
    
    // 🛡️ ENHANCEMENT: Populate LIVE counts from main database for each tenant
    const enhancedTenants = await Promise.all(tenants.map(async (tenant) => {
        if (tenant.companyId) {
            try {
                const { Vehicle: DynamicVehicle, User: DynamicUser } = await getModelsForCrm(tenant.crmType || 'LogKaro Fleet');
                const vCount = await DynamicVehicle.countDocuments({ company: tenant.companyId, isOutsideCar: false });
                const dCount = await DynamicUser.countDocuments({ company: tenant.companyId, role: 'Driver' });
                return { ...tenant, vehicleCount: vCount, driverCount: dCount };
            } catch (err) {
                return { ...tenant, vehicleCount: 0, driverCount: 0 };
            }
        }
        return tenant;
    }));

    res.json(enhancedTenants);
});

// @desc    Get single tenant detail
// @route   GET /api/tenants/:id
// @access  Private (Super Admin)
const getTenantById = asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }
    res.json(tenant);
});

// @desc    Create new tenant (Software Instance)
// @route   POST /api/tenants
// @access  Private (Super Admin)
const createTenant = asyncHandler(async (req, res) => {
    console.log('--- CREATE TENANT DEBUG ---');
    console.log('REQ BODY:', req.body);
    console.log('REQ FILES:', req.files);

        let {
        crmType, companyName, ownerName, phone, whatsappNumber,
        adminEmail, adminPassword, plan, monthlyFee,
        trialDays, permissions, vehicleLimit, website
    } = req.body;
    crmType = crmType || 'LogKaro Fleet';

    // Handle permissions if it's a string from FormData
    if (typeof permissions === 'string') {
        try {
            permissions = JSON.parse(permissions);
        } catch (e) {
            console.error('Failed to parse permissions:', e);
        }
    }

    // Ensure numbers are numbers
    monthlyFee = Number(monthlyFee) || 0;
    vehicleLimit = Number(vehicleLimit) || 10;
    trialDays = Number(trialDays) || 0;

    // Use uploaded files if present, otherwise fallback to req.body.logo/signature (standard URLs)
    let logoUrl = req.body.logo || '';
    let signatureUrl = req.body.signature || '';

    if (req.files) {
        if (req.files.logo && req.files.logo[0]) {
            logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files.logo[0].filename}`;
        }
        if (req.files.signature && req.files.signature[0]) {
            signatureUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files.signature[0].filename}`;
        }
    }
    
    // Default email to adminEmail if not provided
    const email = req.body.email || adminEmail;

    if (!companyName || !adminEmail || !adminPassword) {
        res.status(400);
        throw new Error('Company Name, Admin Email and Password are required for setup');
    }

    // 1. Find or Create Company record in main DB
    const { Company: DynamicCompany, User: DynamicUser } = await getModelsForCrm(crmType);
      let company = await DynamicCompany.findOne({ name: { $regex: new RegExp(`^${companyName.trim()}$`, 'i') } });
    if (company) {
        company.status = 'active';
        company.vehicleLimit = Number(vehicleLimit) || company.vehicleLimit || 10;
        company.website = website || company.website || '';
        company.logoUrl = logoUrl || company.logoUrl || '';
        company.ownerSignatureUrl = signatureUrl || company.ownerSignatureUrl || '';
        company.ownerName = ownerName || company.ownerName || '';
        company.whatsappNumber = whatsappNumber || phone || company.whatsappNumber || '916367466426';
        await company.save();
    } else {
        company = await DynamicCompany.create({
            name: companyName,
            status: 'active',
            vehicleLimit: Number(vehicleLimit) || 10,
            website: website || '',
            logoUrl: logoUrl,
            ownerSignatureUrl: signatureUrl,
            ownerName: ownerName || '',
            whatsappNumber: whatsappNumber || phone || '916367466426'
        });
    }

    // 2. Find or Create Admin User record in main DB
    let user = await DynamicUser.findOne({ username: adminEmail });
    if (user) {
        user.name = ownerName || user.name;
        user.mobile = phone || user.mobile;
        user.password = adminPassword; // Hashing will trigger on save
        user.company = company._id;
        user.status = 'active';
        user.role = 'Admin';
        user.vehicleLimit = Number(vehicleLimit) || user.vehicleLimit || 10;
        if (permissions) user.permissions = permissions;
        await user.save();
    } else {
        user = await DynamicUser.create({
            name: ownerName || 'Admin',
            mobile: phone || '0000000000',
            username: adminEmail,
            password: adminPassword,
            role: 'Admin',
            company: company._id,
            status: 'active',
            vehicleLimit: Number(vehicleLimit) || 10,
            permissions: permissions || {
                dashboard: true,
                liveFeed: true,
                logBook: true,
                driversService: true,
                buySell: true,
                vehiclesManagement: true,
                fleetOperations: true,
                reports: true,
                staffManagement: true,
                manageAdmins: true
            }
        });
    }

    // 3. Find or Create Tenant tracking record
    let tenant = await Tenant.findOne({ $or: [{ email }, { companyId: company._id }] });
    
    // Initialize expiration dates
    let trialEndsAt = null;
    let expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    if (trialDays && trialDays > 0) {
        trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + Number(trialDays));
    }

    if (tenant) {
        // Update existing tenant
        tenant.companyName = companyName;
        tenant.ownerName = ownerName || tenant.ownerName;
        tenant.email = email;
        tenant.phone = phone || tenant.phone;
        tenant.whatsappNumber = whatsappNumber || tenant.whatsappNumber;
        tenant.adminEmail = adminEmail;
        tenant.adminPassword = adminPassword;
        tenant.plan = plan || tenant.plan;
        tenant.monthlyFee = Number(monthlyFee) || tenant.monthlyFee;
        tenant.status = 'active';
        tenant.companyId = company._id;
        tenant.adminUserId = user._id;
        tenant.vehicleLimit = Number(vehicleLimit) || tenant.vehicleLimit || 10;
        tenant.website = website || tenant.website || '';
        tenant.logo = logoUrl || tenant.logo || '';
        tenant.signature = signatureUrl || tenant.signature || '';
        if (permissions) tenant.permissions = permissions;
        await tenant.save();
    } else {
        tenant = await Tenant.create({
            crmType: crmType,
            companyName,
            ownerName: ownerName || 'Admin',
            email,
            phone: phone || '0000000000',
            whatsappNumber: whatsappNumber || '',
            adminEmail,
            adminPassword,
            plan: plan || 'trial',
            status: plan === 'trial' ? 'trial' : 'active',
            trialEndsAt,
            expiresAt,
            monthlyFee: Number(monthlyFee) || 0,
            vehicleLimit: Number(vehicleLimit) || 10,
            website: website || '',
            logo: logoUrl,
            signature: signatureUrl,
            companyId: company._id,
            adminUserId: user._id,
            permissions: permissions || {
                dashboard: true,
                liveFeed: true,
                logBook: true,
                driversService: true,
                buySell: true,
                vehiclesManagement: true,
                fleetOperations: true,
                reports: true,
                staffManagement: true,
                manageAdmins: true
            }
        });
    }

    res.status(201).json(tenant);
});

// @desc    Update tenant
// @route   PUT /api/tenants/:id
// @access  Private (Super Admin)
const updateTenant = asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);

    if (tenant) {
        let logoUrl = req.body.logo ?? tenant.logo;
        let signatureUrl = req.body.signature ?? tenant.signature;

        if (req.files) {
            if (req.files.logo && req.files.logo[0]) {
                logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files.logo[0].filename}`;
            }
            if (req.files.signature && req.files.signature[0]) {
                signatureUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files.signature[0].filename}`;
            }
        }

        let permissions = req.body.permissions;
        if (typeof permissions === 'string') {
            try {
                permissions = JSON.parse(permissions);
            } catch (e) {
                console.error('Failed to parse update permissions:', e);
            }
        }

        tenant.crmType = req.body.crmType || tenant.crmType;
        tenant.companyName = req.body.companyName || tenant.companyName;
        tenant.ownerName = req.body.ownerName || tenant.ownerName;
        tenant.phone = req.body.phone || tenant.phone;
        tenant.whatsappNumber = req.body.whatsappNumber || tenant.whatsappNumber;
        tenant.status = req.body.status || tenant.status;
        tenant.plan = req.body.plan || tenant.plan;
        tenant.monthlyFee = req.body.monthlyFee ?? Number(tenant.monthlyFee);
        tenant.vehicleLimit = Number(req.body.vehicleLimit) || tenant.vehicleLimit;
        tenant.website = req.body.website ?? tenant.website;
        tenant.logo = logoUrl;
        tenant.signature = signatureUrl;
        tenant.expiresAt = req.body.expiresAt || tenant.expiresAt;

        // SYNC: Update the actual Admin User record in target DB
        if (tenant.adminUserId) {
            const { Company: DynamicCompany, User: DynamicUser } = await getModelsForCrm(tenant.crmType || 'LogKaro Fleet');
            const user = await DynamicUser.findById(tenant.adminUserId);
            if (user) {
                if (req.body.adminEmail) {
                    user.username = req.body.adminEmail;
                    tenant.adminEmail = req.body.adminEmail;
                }
                if (req.body.adminPassword) {
                    user.password = req.body.adminPassword; 
                    tenant.adminPassword = req.body.adminPassword; 
                }
                if (permissions) {
                    user.permissions = permissions;
                    tenant.permissions = permissions;
                }
                if (req.body.phone) {
                    user.mobile = req.body.phone;
                }
                if (req.body.vehicleLimit || req.body.website || req.files || req.body.ownerName || req.body.phone) {
                    user.vehicleLimit = Number(req.body.vehicleLimit) || user.vehicleLimit;
                    
                    if (!tenant.companyId) {
                        const foundCompany = await DynamicCompany.findOne({ 
                            name: { $regex: new RegExp(`^${tenant.companyName.split(' ')[0]}`, 'i') } 
                        });
                        if (foundCompany) {
                            tenant.companyId = foundCompany._id;
                        }
                    }

                    if (tenant.companyId) {
                        const updatedComp = await DynamicCompany.findByIdAndUpdate(tenant.companyId, { 
                            status: req.body.status || tenant.status,
                            vehicleLimit: Number(req.body.vehicleLimit) || tenant.vehicleLimit,
                            website: req.body.website ?? tenant.website,
                            logoUrl: logoUrl || (tenant.companyId ? (await DynamicCompany.findById(tenant.companyId))?.logoUrl : ''),
                            ownerSignatureUrl: signatureUrl || (tenant.companyId ? (await DynamicCompany.findById(tenant.companyId))?.ownerSignatureUrl : ''),
                            ownerName: req.body.ownerName ?? tenant.ownerName,
                            whatsappNumber: req.body.whatsappNumber ?? tenant.whatsappNumber ?? tenant.phone
                        }, { new: true });
                    }
                }
                await user.save();
            }
        }

        const updatedTenant = await tenant.save();
        res.json(updatedTenant);
    } else {
        res.status(404);
        throw new Error('Tenant not found');
    }
});

// @desc    Delete tenant (Warning: Data removal)
// @route   DELETE /api/tenants/:id
const deleteTenant = asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await Tenant.findById(tenantId);

    if (tenant) {
        // Suspend the associated company if it exists
        if (tenant.companyId) {
            const { Company: DynamicCompany } = await getModelsForCrm(tenant.crmType || 'LogKaro Fleet');
        await DynamicCompany.findByIdAndUpdate(tenant.companyId, { status: 'suspended' });
        }

        // Use findByIdAndDelete for maximum reliability
        await Tenant.findByIdAndDelete(tenantId);
        
        res.json({ message: 'Tenant record removed and client suspended successfully' });
    } else {
        res.status(404);
        throw new Error('Tenant not found');
    }
});

// @desc    Impersonate a tenant
// @route   POST /api/tenants/:id/login-as
// @access  Private/SuperAdmin
const loginAsTenant = asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    // Dynamically fetch models
    const { Company: DynamicCompany, User: DynamicUser } = await getModelsForCrm(tenant.crmType || 'LogKaro Fleet');

    // Find the matching company in the target DB
    const company = await DynamicCompany.findById(tenant.companyId);
    if (!company) {
        res.status(404);
        throw new Error('Matching CRM Company record not found');
    }

    console.log(`[BRIDGE-ATTEMPT] Impersonating: ${company.name} (Tenant: ${tenant._id})`);

    let adminUser = await DynamicUser.findOne({ company: company._id, role: { $regex: /admin|executive/i } });
    if (!adminUser) {
        adminUser = await DynamicUser.findOne({ company: company._id });
    }

    if (!adminUser) {
        res.status(404);
        throw new Error('No users found for this company in CRM database.');
    }

    const bridgeToken = generateBridgeToken(adminUser, company._id);
    
    // Determine the CRM URL based on type
    let crmUrl = process.env.CRM_FRONTEND_URL || 'http://localhost:5173';
    if (tenant.crmType === 'School Management') crmUrl = process.env.SCHOOL_FRONTEND_URL || 'http://localhost:5175';
    if (tenant.crmType === 'Modified Fleet') crmUrl = process.env.MODIFIED_FLEET_FRONTEND_URL || 'http://localhost:5176';
    
    res.json({
        token: bridgeToken,
        redirectUrl: `${crmUrl}/bridge?token=${bridgeToken}`
    });
});

module.exports = {
    getTenants,
    getTenantById,
    createTenant,
    updateTenant,
    deleteTenant,
    loginAsTenant
};
