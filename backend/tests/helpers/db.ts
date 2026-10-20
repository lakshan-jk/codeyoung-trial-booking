import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * In-memory MongoDB REPLICA SET for tests. A replica set (not a standalone) is
 * required because the booking service uses multi-document transactions.
 */
let replSet: MongoMemoryReplSet | undefined;

export async function startTestDb(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).createIndexes()));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await replSet?.stop();
}

export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  // Recreate indexes dropped implicitly on fresh collections.
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).createIndexes()));
}
