const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();


// const sequelize = new Sequelize(process.env.POSTGRES_URL, {
//   logging: false,
//   dialect: 'postgres',
//   dialectOptions: {
//     ssl: true
//   }
// });

module.exports = new Sequelize(
    process.env.POSTGRES_URL,
    {
        logging: false,
        dialectOptions:{
            ssl:{
                required:true,
                rejectUnauthorized: false
            }
        }
    }
);


// postgres://postgres:ssdbaws2024@database-1.cpwce2yok4yf.ap-south-1.rds.amazonaws.com/signal-school

// module.exports = new Sequelize(
//     process.env.POSTGRES_URL,
//     {
//         logging: false,
//         dialectOptions:{
            
//         }
//     }
// );

