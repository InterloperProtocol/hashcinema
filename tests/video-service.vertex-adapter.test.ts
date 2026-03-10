import { extractVideoUrisFromOperation } from "../video-service/src/providers/vertex-veo";

describe("vertex veo adapter output parsing", () => {
  it("extracts gcs and https URIs from nested operation response payloads", () => {
    const uris = extractVideoUrisFromOperation({
      done: true,
      response: {
        predictions: [
          {
            video: {
              uri: "gcs://bucket/path/clip-1.mp4",
            },
          },
        ],
        outputVideos: [{ url: "https://example.com/video-2.mp4" }],
      },
    });

    expect(uris).toContain("gcs://bucket/path/clip-1.mp4");
    expect(uris).toContain("https://example.com/video-2.mp4");
  });
});
