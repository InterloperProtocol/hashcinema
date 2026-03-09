import { mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

import { loadWritersRoomContent } from "@/lib/analytics/loadWritersRoomContent";

describe("loadWritersRoomContent", () => {
  it("handles missing file gracefully", async () => {
    const missingPath = path.join(os.tmpdir(), `missing-${Date.now()}.md`);
    const result = await loadWritersRoomContent(missingPath);

    expect(result.source).toBe("missing");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns on duplicate ids and malformed flat records", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "writers-room-"));
    const filePath = path.join(dir, "writers_room_content_bank.md");
    const markdown = `
# interpretation-lines
- id: line-1
- tags: universal
- text: first line

- id: line-1
- tags: universal
- text: duplicate line

- tags: universal
- text: malformed without id
`;
    await writeFile(filePath, markdown, "utf8");

    const result = await loadWritersRoomContent(filePath);

    expect(result.source).toBe("file");
    expect(result.interpretationLines).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("Duplicate"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("malformed"))).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });
});

