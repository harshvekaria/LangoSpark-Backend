import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import app from '../app';

const prisma = new PrismaClient();
const request = supertest(app);

// Display test environment information
console.log('🧪 Test environment setup initialized');
console.log(`🔌 API Base URL: http://localhost:${process.env.PORT || 3000}`);

// Clean up database before and after tests
beforeAll(async () => {
  try {
    await prisma.$connect();
    console.log('📊 Connected to database');
    
    // Print database info
    const userCount = await prisma.user.count();
    const languageCount = await prisma.language.count();
    console.log(`ℹ️ Database contains ${userCount} users and ${languageCount} languages`);
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    console.warn('⚠️ Some tests may fail due to database connection issues');
  }
});

afterAll(async () => {
  try {
    await prisma.$disconnect();
    console.log('📊 Disconnected from database');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
});

export { prisma, request }; 