const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();


const url = process.env.POSTGRES_URL;
const logging = false;
const dialectOptions = {
  ssl: {
    require: true
  }
};


const sequelize = new Sequelize(url, {
  logging,
  dialectOptions,
});




module.exports = sequelize;
