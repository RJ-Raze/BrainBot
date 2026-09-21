// Prisma 单例
require('./database-url').configureDatabaseUrl();
const { PrismaClient } = require('@prisma/client');
module.exports = new PrismaClient();
