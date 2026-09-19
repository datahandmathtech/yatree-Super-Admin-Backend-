const mongoose = require('mongoose');

// Cache connections
const connections = {};

const getConnection = async (crmType) => {
    let uri;
    if (crmType === 'School Management') {
        uri = process.env.MONGODB_URI_SCHOOL;
    } else if (crmType === 'Modified Fleet') {
        uri = process.env.MONGODB_URI_MODIFIED_FLEET;
    } else {
        // LogKaro Fleet (Default main database used by super admin itself)
        return mongoose.connection;
    }

    if (!uri) {
        throw new Error(`Missing MongoDB URI for CRM Type: ${crmType}`);
    }

    if (connections[crmType]) {
        return connections[crmType];
    }

    
        console.log(`Establishing new dynamic connection for ${crmType}...`);
        const conn = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 });
        conn.on('error', err => console.error(`Dynamic DB Error for ${crmType}:`, err));
        conn.on('connected', () => console.log(`Dynamic DB Connected for ${crmType}!`));
        connections[crmType] = conn;

    return conn;
};

const getModelsForCrm = async (crmType) => {
    const conn = await getConnection(crmType);

    // If it's the default connection, just require the standard models
    if (conn === mongoose.connection) {
        return {
            Company: require('../models/Company'),
            User: require('../models/User'),
            Vehicle: require('../models/Vehicle')
        };
    }

    // Otherwise, compile models dynamically for the specific connection
    const CompanySchema = require('../models/Company').schema;
    const UserSchema = require('../models/User').schema;
    const VehicleSchema = require('../models/Vehicle').schema;

    const CompanyModel = conn.models.Company || conn.model('Company', CompanySchema, 'companies');
    const UserModel = conn.models.User || conn.model('User', UserSchema, 'users');
    const VehicleModel = conn.models.Vehicle || conn.model('Vehicle', VehicleSchema, 'vehicles');

    return {
        Company: CompanyModel,
        User: UserModel,
        Vehicle: VehicleModel
    };
};

module.exports = { getModelsForCrm };
