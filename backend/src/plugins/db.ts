import mongoose from 'mongoose';

/** Connect to MongoDB and ensure indexes defined on models are built. */
export async function connectDb(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  // Build the unique indexes (mentor+slot, mentor+day) before serving traffic —
  // the booking service's concurrency guarantees depend on them existing.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
