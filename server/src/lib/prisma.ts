import { PrismaClient } from '@prisma/client';

// Shared singleton — prevents connection-pool exhaustion from multiple PrismaClient instances.
// All routes and services must import this instead of calling `new PrismaClient()`.
export const prisma = new PrismaClient();
