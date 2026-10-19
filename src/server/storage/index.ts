import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { storageDir } from "@/server/env";

/**
 * Private document storage. Files are never placed under /public and are only
 * served through /api/documents/[id]/download after an authorization check.
 *
 * LocalDiskStorage needs a persistent volume in production. To use S3/R2 later,
 * implement StorageAdapter and return it from getStorage().
 */
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png|jpg|webp|heic)$/;

export class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!KEY.test(key)) throw new Error("Invalid storage key");
    const root = path.resolve(this.root);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage path");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
    await writeFile(full, data, { mode: 0o600, flag: "wx" });
  }

  async get(key: string) {
    return readFile(this.resolve(key));
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

let storage: StorageAdapter | null = null;
export function getStorage(): StorageAdapter {
  storage ??= new LocalDiskStorage(storageDir());
  return storage;
}
