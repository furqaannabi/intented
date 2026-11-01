import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAttestationUrls } from "../src/attestations.js";

const BASE = "https://github.com/furqaannabi/intented/blob/main/docs/attestations";
const SIGNER = "0x835ab53d20294ef795906dff21ae4c045336aa26";

function dirWith(files: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "attest-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), typeof body === "string" ? body : JSON.stringify(body));
  return dir;
}

describe("loadAttestationUrls", () => {
  it("links each published report by its lowercase signing address", () => {
    const dir = dirWith({ [`${SIGNER}.json`]: { signing_address: SIGNER } });
    expect(loadAttestationUrls(dir, BASE)).toEqual({ [SIGNER]: `${BASE}/${SIGNER}.json` });
  });

  it("skips a report filed under another address, unreadable JSON, and a missing folder", () => {
    const other = "0x0000000000000000000000000000000000000001";
    const dir = dirWith({ [`${other}.json`]: { signing_address: SIGNER }, "broken.json": "{not json", "notes.txt": "x" });
    expect(loadAttestationUrls(dir, BASE)).toEqual({});
    expect(loadAttestationUrls(join(dir, "missing"), BASE)).toEqual({});
  });
});
