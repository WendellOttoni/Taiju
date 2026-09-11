import { describe, expect, test } from "bun:test";
import {
  decodeProjectNoxCatalog,
  SourceCatalogDecodeError,
} from "../src/index";

const varint = (value: number) => {
  const out: number[] = [];
  do {
    let b = value & 0x7f;
    value >>>= 7;
    if (value) b |= 0x80;
    out.push(b);
  } while (value);
  return out;
};
const field = (n: number, bytes: number[]) => [
  ...varint((n << 3) | 2),
  ...varint(bytes.length),
  ...bytes,
];
const str = (n: number, value: string) =>
  field(n, [...new TextEncoder().encode(value)]);
const msg = (...parts: number[][]) => parts.flat();

describe("Project Nox catalog decoder", () => {
  test("decodes nested protobuf catalog", async () => {
    const source = msg(
      [8, 42],
      str(2, "English Source"),
      str(3, "en"),
      str(4, "https://example.test"),
    );
    const resources = msg(
      str(1, "https://example.test/app.apk"),
      str(2, "https://example.test/icon.png"),
    );
    const extension = msg(
      str(1, "Example"),
      str(2, "pkg.example"),
      field(3, resources),
      str(4, "1.6"),
      [40, 40],
      str(6, "1.0.0"),
      [56, 1],
      field(8, source),
    );
    const catalog = msg(
      str(1, "Project Nox"),
      str(2, "NOX"),
      str(3, "key"),
      field(4, msg(str(1, "https://example.test"))),
      field(101, field(1, extension)),
    );
    const result = await decodeProjectNoxCatalog(new Uint8Array(catalog));
    expect(result.extensions[0]?.sources[0]?.language).toBe("en");
    expect(result.extensions[0]?.versionCode).toBe(40n);
  });
  test("rejects malformed catalog", async () => {
    await expect(
      decodeProjectNoxCatalog(new Uint8Array([0x0a, 0x01])),
    ).rejects.toBeInstanceOf(SourceCatalogDecodeError);
  });
});
