const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    try {

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: {
                rejectUnauthorized: false
            }
        });

        console.log("✅ Connected to TiDB");

        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`
        );

        await connection.end();

        console.log("✅ Database guaranteed");

        const initSqlPath = path.join(__dirname, 'init.sql');

        if (fs.existsSync(initSqlPath)) {

            const sql = fs.readFileSync(initSqlPath, 'utf8');

            const statements = sql
                .split(';')
                .filter(stmt => stmt.trim());

            for (let statement of statements) {
                await pool.query(statement);
            }

            console.log("✅ Database tables initialized");
        }

    } catch (error) {

        console.error("❌ TiDB Error:", error.message);

    }
}

module.exports = {
    pool,

    query: async (text, params) => {
        const [rows] = await pool.query(text, params);
        return rows;
    },

    initializeDatabase
};