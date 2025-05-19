// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// In JavaScript, you don't need to declare global variables with 'declare global'.

export const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
