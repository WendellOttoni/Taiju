import type { ProjectNoxCatalog } from "./catalog-decoder";

export type CatalogStoreOptions = {
  load: () => Promise<ProjectNoxCatalog>;
  ttlMs?: number;
};

export type CatalogStoreSnapshot = {
  catalog: ProjectNoxCatalog;
  fetchedAt: Date;
  stale: boolean;
};

/** Keeps the last valid catalog and serves it while refreshes are unavailable. */
export class ProjectNoxCatalogStore {
  private snapshot?: CatalogStoreSnapshot;
  private refreshPromise?: Promise<CatalogStoreSnapshot>;
  private readonly ttlMs: number;

  constructor(private readonly options: CatalogStoreOptions) {
    this.ttlMs = options.ttlMs ?? 15 * 60_000;
    if (!Number.isInteger(this.ttlMs) || this.ttlMs < 1)
      throw new Error("Catalog TTL must be a positive integer.");
  }

  async get(): Promise<CatalogStoreSnapshot> {
    if (
      this.snapshot &&
      Date.now() - this.snapshot.fetchedAt.getTime() < this.ttlMs
    )
      return { ...this.snapshot, stale: false };
    try {
      return await this.refresh();
    } catch (error) {
      if (this.snapshot) return { ...this.snapshot, stale: true };
      throw error;
    }
  }

  async refresh(): Promise<CatalogStoreSnapshot> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.options.load().then((catalog) => {
        const snapshot = { catalog, fetchedAt: new Date(), stale: false };
        this.snapshot = snapshot;
        return snapshot;
      });
    }
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }
}
