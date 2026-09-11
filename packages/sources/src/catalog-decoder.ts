export type ProjectNoxSource = {
  id: string;
  name: string;
  language: string;
  homeUrl?: string;
  mirrorUrls: string[];
};
export type ProjectNoxExtension = {
  name: string;
  packageName: string;
  apkUrl: string;
  iconUrl: string;
  extensionLib: string;
  versionCode: bigint;
  versionName: string;
  contentWarning: number;
  sources: ProjectNoxSource[];
};
export type ProjectNoxCatalog = {
  name: string;
  badgeLabel: string;
  signingKey: string;
  contact: { website: string; discord?: string };
  extensions: ProjectNoxExtension[];
  extensionListUrl?: string;
};

export class SourceCatalogDecodeError extends Error {
  override name = "SourceCatalogDecodeError";
}
type Value = { wire: number; value: Uint8Array | bigint };
type FieldMap = Map<number, Value[]>;
class Reader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get done() {
    return this.offset >= this.bytes.length;
  }
  varint() {
    let value = 0n;
    for (let shift = 0n; shift < 70n; shift += 7n) {
      if (this.offset >= this.bytes.length)
        throw new SourceCatalogDecodeError("Truncated protobuf varint.");
      const b = this.bytes[this.offset++] as number;
      value |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) return value;
    }
    throw new SourceCatalogDecodeError("Invalid protobuf varint.");
  }
  bytesValue() {
    const length = this.varint();
    if (length > BigInt(this.bytes.length - this.offset))
      throw new SourceCatalogDecodeError("Truncated protobuf field.");
    const start = this.offset;
    this.offset += Number(length);
    return this.bytes.slice(start, this.offset);
  }
  skip(wire: number) {
    if (wire === 0) {
      this.varint();
      return;
    }
    if (wire === 1) {
      this.offset += 8;
      return;
    }
    if (wire === 2) {
      this.bytesValue();
      return;
    }
    if (wire === 5) {
      this.offset += 4;
      return;
    }
    throw new SourceCatalogDecodeError(
      `Unsupported protobuf wire type ${wire}.`,
    );
  }
}
function fields(bytes: Uint8Array): FieldMap {
  const r = new Reader(bytes);
  const out: FieldMap = new Map();
  while (!r.done) {
    const key = r.varint();
    const n = Number(key >> 3n);
    const wire = Number(key & 7n);
    let value: Uint8Array | bigint;
    if (wire === 0) value = r.varint();
    else if (wire === 2) value = r.bytesValue();
    else {
      r.skip(wire);
      value = new Uint8Array();
    }
    const list = out.get(n) ?? [];
    list.push({ wire, value });
    out.set(n, list);
  }
  return out;
}
const text = (v: Value | undefined) =>
  v?.wire === 2 ? new TextDecoder().decode(v.value as Uint8Array) : undefined;
const oneText = (m: FieldMap, n: number) => text(m.get(n)?.[0]);
const manyText = (m: FieldMap, n: number) =>
  (m.get(n) ?? []).map(text).filter((v): v is string => v !== undefined);
const messages = (m: FieldMap, n: number) =>
  (m.get(n) ?? [])
    .filter((v) => v.wire === 2)
    .map((v) => fields(v.value as Uint8Array));
const required = (value: string | undefined, name: string) => {
  if (!value?.trim())
    throw new SourceCatalogDecodeError(`Catalog field ${name} is missing.`);
  return value;
};
function source(m: FieldMap): ProjectNoxSource {
  const id = m.get(1)?.[0]?.value;
  if (typeof id !== "bigint")
    throw new SourceCatalogDecodeError("Catalog source.id is missing.");
  return {
    id: id.toString(),
    name: required(oneText(m, 2), "source.name"),
    language: required(oneText(m, 3), "source.language").toLowerCase(),
    homeUrl: oneText(m, 4),
    mirrorUrls: manyText(m, 5),
  };
}
function extension(m: FieldMap): ProjectNoxExtension {
  const resources = messages(m, 3)[0];
  const versionCode = m.get(5)?.[0]?.value;
  if (!resources || typeof versionCode !== "bigint")
    throw new SourceCatalogDecodeError(
      "Extension required fields are missing.",
    );
  return {
    name: required(oneText(m, 1), "extension.name"),
    packageName: required(oneText(m, 2), "extension.packageName"),
    apkUrl: required(oneText(resources, 1), "resources.apkUrl"),
    iconUrl: required(oneText(resources, 2), "resources.iconUrl"),
    extensionLib: required(oneText(m, 4), "extension.extensionLib"),
    versionCode,
    versionName: required(oneText(m, 6), "extension.versionName"),
    contentWarning: Number(m.get(7)?.[0]?.value ?? 0n),
    sources: messages(m, 8).map(source),
  };
}
export async function decodeProjectNoxCatalog(
  input: Uint8Array,
): Promise<ProjectNoxCatalog> {
  let bytes = input;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = new Uint8Array(
        await new Response(
          new Blob([bytes.buffer as ArrayBuffer])
            .stream()
            .pipeThrough(new DecompressionStream("gzip")),
        ).arrayBuffer(),
      );
    } catch {
      throw new SourceCatalogDecodeError(
        "The source catalog gzip payload is invalid.",
      );
    }
  }
  const root = fields(bytes);
  const contact = messages(root, 4)[0];
  const list = messages(root, 101)[0];
  if (!contact || !list)
    throw new SourceCatalogDecodeError(
      "Catalog contact or extension list is missing.",
    );
  return {
    name: required(oneText(root, 1), "catalog.name"),
    badgeLabel: required(oneText(root, 2), "catalog.badgeLabel"),
    signingKey: required(oneText(root, 3), "catalog.signingKey"),
    contact: {
      website: required(oneText(contact, 1), "contact.website"),
      discord: oneText(contact, 2),
    },
    extensions: messages(list, 1).map(extension),
    extensionListUrl: oneText(root, 102),
  };
}
