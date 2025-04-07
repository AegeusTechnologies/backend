const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({})

// Optional: Add query logging event listener
prisma.$on('query', (e) => {
    console.log('Query: ' + e.query)
    console.log('Duration: ' + e.duration + 'ms')
})

module.exports = prisma;