const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();


const sequelize = new Sequelize(process.env.POSTGRES_URL, {
  logging: false,
  dialect: 'postgres',
  dialectOptions: {
    ssl: false
  }
});



module.exports = sequelize;
