const assert = require("assert");
const { filterPlaylist } = require("../src/playlist-filter");

const convertPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:4.8,
9YW07ON1.ts
#EXT-X-DISCONTINUITY
#EXTINF:3.32,
convertv8/1ylpvOxL.ts
#EXT-X-DISCONTINUITY
#EXT-X-DISCONTINUITY
#EXTINF:5.16,
convertv8/kB5jmmEb.ts
#EXT-X-DISCONTINUITY
#EXTINF:5.52,
DiRGsDfZ.ts
#EXTINF:6.2,
5NLIfwPS.ts
`;

const v8Playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:6.0,
ZAanUtzW.ts
#EXT-X-DISCONTINUITY
#EXT-X-KEY:METHOD=NONE
#EXTINF:3.6,
/v8/18d007379882ef14b73445b93bf6168d/segment_0001.ts
#EXTINF:2.56,
/v8/18d007379882ef14b73445b93bf6168d/segment_0002.ts
#EXTINF:1.8,
/v8/18d007379882ef14b73445b93bf6168d/segment_0011.ts
#EXT-X-DISCONTINUITY
#EXTINF:4.96,
QPukoD1A.ts
#EXTINF:3.6,
Z9YTRX5O.ts
`;

const futureVersionPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:4.0,
convertv9/futureContent.ts
#EXT-X-DISCONTINUITY
#EXTINF:3.6,
/v12/18d007379882ef14b73445b93bf6168d/segment_0001.ts
#EXT-X-DISCONTINUITY
#EXTINF:4.0,
nextContent.ts
`;

function run() {
  const convertResult = filterPlaylist(convertPlaylist);
  assert.strictEqual(convertResult.removed, 0);
  assert(!convertResult.text.includes("convertv8/"));
  assert(convertResult.text.includes("1ylpvOxL.ts"));
  assert(convertResult.text.includes("kB5jmmEb.ts"));
  assert(convertResult.text.includes("9YW07ON1.ts"));
  assert(convertResult.text.includes("DiRGsDfZ.ts"));

  const v8Result = filterPlaylist(v8Playlist);
  assert.strictEqual(v8Result.removed, 3);
  assert(!v8Result.text.includes("/segment_0001.ts"));
  assert(!v8Result.text.includes("#EXT-X-KEY:METHOD=NONE"));
  assert(v8Result.text.includes("ZAanUtzW.ts"));
  assert(v8Result.text.includes("QPukoD1A.ts"));

  const futureVersionResult = filterPlaylist(futureVersionPlaylist);
  assert.strictEqual(futureVersionResult.removed, 1);
  assert(!futureVersionResult.text.includes("convertv9/"));
  assert(futureVersionResult.text.includes("futureContent.ts"));
  assert(!futureVersionResult.text.includes("/v12/"));
  assert(futureVersionResult.text.includes("nextContent.ts"));

  const normal = `#EXTM3U
#EXTINF:4.0,
segment_0001.ts
#EXTINF:4.0,
segment_0002.ts
`;
  const normalResult = filterPlaylist(normal);
  assert.strictEqual(normalResult.removed, 0);
  assert.strictEqual(normalResult.text, normal);

  console.log("All playlist filter tests passed.");
}

run();
