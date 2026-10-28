/**
 * In-memory fake of the firebase-admin Firestore surface used by the MCP
 * server. Implements only what the code under test calls:
 * collection().orderBy().get(), collection().add(), collection().get(),
 * doc().get()/set()/update(), collectionGroup().where().limit().get(),
 * runTransaction().
 *
 * Tests cast this as unknown as Firestore — the structural overlap is
 * intentionally minimal and runtime-only.
 */

import type { Firestore } from "firebase-admin/firestore";

type DocData = Record<string, unknown>;

export class FakeDocSnapshot {
  constructor(
    public readonly id: string,
    private readonly _data: DocData | undefined,
    public readonly exists: boolean,
    public readonly ref: FakeDocRef
  ) {}
  data(): DocData | undefined {
    return this._data;
  }
}

export class FakeDocRef {
  constructor(
    private readonly store: Map<string, DocData>,
    public readonly path: string
  ) {}
  get id(): string {
    return this.path.split("/").pop() as string;
  }
  async get(): Promise<FakeDocSnapshot> {
    const data = this.store.get(this.path);
    return new FakeDocSnapshot(this.id, data, data !== undefined, this);
  }
  async set(data: DocData): Promise<void> {
    this.store.set(this.path, { ...data });
  }
  async update(data: DocData): Promise<void> {
    const cur = this.store.get(this.path) ?? {};
    this.store.set(this.path, { ...cur, ...data });
  }
}

type Filter = { field: string; op: string; value: unknown };

export class FakeQuerySnapshot {
  constructor(public readonly docs: FakeDocSnapshot[]) {}
  get empty(): boolean {
    return this.docs.length === 0;
  }
}

export class FakeQuery {
  private filters: Filter[] = [];
  private orderField: string | null = null;
  private orderDir: "asc" | "desc" = "asc";
  private limitN: number | null = null;

  constructor(
    protected readonly store: Map<string, DocData>,
    private readonly prefix: string,
    private readonly groupName: string | null = null
  ) {}

  where(field: string, op: string, value: unknown): FakeQuery {
    this.filters.push({ field, op, value });
    return this;
  }
  orderBy(field: string, dir: "asc" | "desc" = "asc"): FakeQuery {
    this.orderField = field;
    this.orderDir = dir;
    return this;
  }
  limit(n: number): FakeQuery {
    this.limitN = n;
    return this;
  }

  private matches(path: string, data: DocData): boolean {
    if (this.groupName !== null) {
      // collection-group: path must contain /{groupName}/ as a collection segment
      const segs = path.split("/");
      let ok = false;
      for (let i = 0; i < segs.length - 1; i += 2) {
        if (segs[i] === this.groupName) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    } else if (!path.startsWith(this.prefix + "/")) {
      return false;
    } else {
      // direct children only: exactly one more segment after the prefix
      const rest = path.slice(this.prefix.length + 1);
      if (rest.includes("/")) return false;
    }
    for (const f of this.filters) {
      const v = data[f.field];
      if (f.op === "==") {
        if (v !== f.value) return false;
      } else {
        throw new Error(`unsupported fake op ${f.op}`);
      }
    }
    return true;
  }

  async get(): Promise<FakeQuerySnapshot> {
    const docs: FakeDocSnapshot[] = [];
    for (const [path, data] of this.store) {
      if (this.matches(path, data)) {
        const ref = new FakeDocRef(this.store, path);
        docs.push(new FakeDocSnapshot(ref.id, data, true, ref));
      }
    }
    if (this.orderField) {
      const field = this.orderField;
      const dir = this.orderDir === "desc" ? -1 : 1;
      docs.sort((a, b) => {
        const av = a.data()?.[field];
        const bv = b.data()?.[field];
        const an = typeof av === "number" ? av : 0;
        const bn = typeof bv === "number" ? bv : 0;
        return (an - bn) * dir || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      });
    }
    const limited = this.limitN !== null ? docs.slice(0, this.limitN) : docs;
    return new FakeQuerySnapshot(limited);
  }
}

export class FakeCollectionRef extends FakeQuery {
  private static addCounter = 0;
  constructor(store: Map<string, DocData>, private readonly colPath: string) {
    super(store, colPath);
  }
  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.store, `${this.colPath}/${id}`);
  }
  async add(data: DocData): Promise<{ id: string }> {
    const id = `auto-${++FakeCollectionRef.addCounter}`;
    this.store.set(`${this.colPath}/${id}`, { ...data });
    return { id };
  }
}

export class FakeTransaction {
  constructor(private readonly store: Map<string, DocData>) {}
  async get(ref: FakeDocRef): Promise<FakeDocSnapshot> {
    return ref.get();
  }
  update(ref: FakeDocRef, data: DocData): void {
    const cur = this.store.get(ref.path) ?? {};
    this.store.set(ref.path, { ...cur, ...data });
  }
  set(ref: FakeDocRef, data: DocData): void {
    this.store.set(ref.path, { ...data });
  }
}

export class FakeDb {
  readonly store = new Map<string, DocData>();

  collection(path: string): FakeCollectionRef {
    return new FakeCollectionRef(this.store, path);
  }
  doc(path: string): FakeDocRef {
    return new FakeDocRef(this.store, path);
  }
  collectionGroup(name: string): FakeQuery {
    return new FakeQuery(this.store, "", name);
  }
  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    return fn(new FakeTransaction(this.store));
  }

  /** Cast for passing into MCP data functions typed against Firestore. */
  asFirestore(): Firestore {
    return this as unknown as Firestore;
  }

  /** Seed helper: put a raw doc at an exact path. */
  seed(path: string, data: DocData): void {
    this.store.set(path, { ...data });
  }
  /** All docs under a collection path (for assertions). */
  docsUnder(prefix: string): Array<{ path: string; data: DocData }> {
    const out: Array<{ path: string; data: DocData }> = [];
    for (const [path, data] of this.store) {
      if (path.startsWith(prefix + "/") && !path.slice(prefix.length + 1).includes("/")) {
        out.push({ path, data });
      }
    }
    return out;
  }
}
