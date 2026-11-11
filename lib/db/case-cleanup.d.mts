import type { PrismaClient } from '@prisma/client';

export function deleteCaseRecord(client: PrismaClient, id: string): Promise<boolean>;
export function clearCaseRecords(client: PrismaClient): Promise<number>;
