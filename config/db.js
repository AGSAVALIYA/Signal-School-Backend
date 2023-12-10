const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();




const url = process.env.POSTGRES_URL;

if (!url) {
  console.error('POSTGRES_URL is not defined in the environment variables.');
  process.exit(1);
}


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
