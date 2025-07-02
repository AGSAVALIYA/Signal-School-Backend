// Import Sequelize ORM for PostgreSQL database operations
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables for database configuration
dotenv.config();

/**
 * Database Configuration
 * Creates a new Sequelize instance for connecting to PostgreSQL database
 * Configured with SSL for secure connections to cloud databases
 */
module.exports = new Sequelize(
    process.env.POSTGRES_URL, // Database connection URL from environment variables
    {
        logging: false, // Disable SQL query logging for cleaner console output
        dialectOptions: {
            ssl: {
                rejectUnauthorized: false // Allow self-signed SSL certificates for development
            }
        }
    }
);
