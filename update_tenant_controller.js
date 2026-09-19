const fs = require('fs');
let code = fs.readFileSync('E:/New folder/Master-Server/TEXI/super-admin/backend/src/controllers/tenantController.js', 'utf8');

// 1. Add requirement
code = code.replace(/const User = require\('\.\.\/models\/User'\);/, "const User = require('../models/User');\nconst { getModelsForCrm } = require('../config/dbConnections');");

// 2. Fix createTenant extraction
code = code.replace(/let \{\n\s*companyName, ownerName, phone, whatsappNumber,\n\s*adminEmail, adminPassword, plan, monthlyFee,\n\s*trialDays, permissions, vehicleLimit, website\n\s*\} = req\.body;/, 
`    let {
        crmType, companyName, ownerName, phone, whatsappNumber,
        adminEmail, adminPassword, plan, monthlyFee,
        trialDays, permissions, vehicleLimit, website
    } = req.body;
    crmType = crmType || 'LogKaro Fleet';`);

// 3. In createTenant, replace Company and User with dynamic models
const createTenantRegex = /\/\/ 1\. Find or Create Company record in main DB[\s\S]*?\/\/ 3\. Create Super Admin Tenant Record/;
const newCreateTenantBlock = `// 0. Get Dynamic Models
    const { Company: DynamicCompany, User: DynamicUser } = await getModelsForCrm(crmType);

    // 1. Find or Create Company record in target DB
    let company = await DynamicCompany.findOne({ name: { $regex: new RegExp(\`^\${companyName.trim()}\$\`, 'i') } });
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

    // 2. Find or Create Admin User record in target DB
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

    // 3. Create Super Admin Tenant Record`;
code = code.replace(createTenantRegex, newCreateTenantBlock);

// 4. Update the Tenant creation to include crmType
code = code.replace(/companyName: companyName,/, "crmType: crmType,\n        companyName: companyName,");

// 5. In updateTenant, use dynamic models
const updateTenantSyncRegex = /\/\/ dY>,\? SYNC: Update the actual Admin User record if email or password changed[\s\S]*?const updatedTenant = await tenant\.save\(\);/;
const newUpdateTenantSync = `// SYNC: Update the actual Admin User record in the target DB
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
                            name: { $regex: new RegExp(\`^\${tenant.companyName.split(' ')[0]}\`, 'i') } 
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

        const updatedTenant = await tenant.save();`;
code = code.replace(updateTenantSyncRegex, newUpdateTenantSync);

// 6. In deleteTenant, use dynamic models
code = code.replace(/await Company\.findByIdAndUpdate\(tenant\.companyId, \{ status: 'suspended' \}\);/, 
    "const { Company: DynamicCompany } = await getModelsForCrm(tenant.crmType || 'LogKaro Fleet');\n        await DynamicCompany.findByIdAndUpdate(tenant.companyId, { status: 'suspended' });");

// 7. In getTenants, dynamic models for counts! (skip this complex part for now to prevent bugs, or rewrite cleanly)
const getTenantsRegex = /if \(tenant\.companyId\) \{\s*try \{\s*const vCount = await Vehicle\.countDocuments\(\{ company: tenant\.companyId, isOutsideCar: false \}\);\s*const dCount = await User\.countDocuments\(\{ company: tenant\.companyId, role: 'Driver' \}\);\s*return \{ \.\.\.tenant, vehicleCount: vCount, driverCount: dCount \};\s*\} catch \(err\) \{\s*return \{ \.\.\.tenant, vehicleCount: 0, driverCount: 0 \};\s*\}\s*\}/;
const newGetTenants = `if (tenant.companyId) {
            try {
                const { Vehicle: DynamicVehicle, User: DynamicUser } = await getModelsForCrm(tenant.crmType || 'LogKaro Fleet');
                const vCount = await DynamicVehicle.countDocuments({ company: tenant.companyId, isOutsideCar: false });
                const dCount = await DynamicUser.countDocuments({ company: tenant.companyId, role: 'Driver' });
                return { ...tenant, vehicleCount: vCount, driverCount: dCount };
            } catch (err) {
                return { ...tenant, vehicleCount: 0, driverCount: 0 };
            }
        }`;
code = code.replace(getTenantsRegex, newGetTenants);

// 8. In loginAsTenant
const loginAsTenantRegex = /\/\/ Find the matching company in the shared DB[\s\S]*?res\.json\(\{/m;
const newLoginAsTenant = `// Dynamically fetch models
    const { Company: DynamicCompany, User: DynamicUser } = await getModelsForCrm(tenant.crmType || 'LogKaro Fleet');

    // Find the matching company in the target DB
    const company = await DynamicCompany.findById(tenant.companyId);
    if (!company) {
        res.status(404);
        throw new Error('Matching CRM Company record not found');
    }

    console.log(\`[BRIDGE-ATTEMPT] Impersonating: \${company.name} (Tenant: \${tenant._id})\`);

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
    
    res.json({`;
code = code.replace(loginAsTenantRegex, newLoginAsTenant);

fs.writeFileSync('E:/New folder/Master-Server/TEXI/super-admin/backend/src/controllers/tenantController.js', code);
console.log('Modified tenantController.js for Dynamic DB Connections!');
