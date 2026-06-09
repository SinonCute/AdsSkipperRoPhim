(function attachPlaylistFilter(globalScope) {
  const REMOVE_URI_PATTERNS = [
    /\/v\d+\/[a-f0-9]{16,}\/segment_\d+\.ts(?:[?#].*)?$/i
  ];
  const CONVERT_PREFIX_PATTERN = /(^|\/)convertv\d+\//i;

  const URI_LINE_PATTERN = /^[^#\s][^\s]*\.ts(?:[?#].*)?$/i;
  const TAGS_TO_DROP_WITH_AD = new Set([
    "#EXT-X-DISCONTINUITY",
    "#EXT-X-KEY"
  ]);

  function isPlaylist(text) {
    return typeof text === "string" && text.includes("#EXTM3U") && text.includes("#EXTINF");
  }

  function isAdUri(line) {
    const value = line.trim();
    return REMOVE_URI_PATTERNS.some((pattern) => pattern.test(value));
  }

  function normalizeSegmentUri(line) {
    return line.replace(CONVERT_PREFIX_PATTERN, "$1");
  }

  function isSegmentUri(line) {
    return URI_LINE_PATTERN.test(line.trim());
  }

  function isExtinf(line) {
    return line.trim().toUpperCase().startsWith("#EXTINF:");
  }

  function isDropTag(line) {
    const normalized = line.trim().toUpperCase();
    for (const tag of TAGS_TO_DROP_WITH_AD) {
      if (normalized === tag || normalized.startsWith(`${tag}:`)) {
        return true;
      }
    }
    return false;
  }

  function collectSegmentBlocks(lines) {
    const blocks = [];
    let blockStart = 0;

    for (let index = 0; index < lines.length; index += 1) {
      if (isSegmentUri(lines[index])) {
        blocks.push({
          start: blockStart,
          uriIndex: index,
          end: index,
          uri: lines[index].trim()
        });
        blockStart = index + 1;
      }
    }

    return blocks;
  }

  function trimBlockForRemoval(lines, block) {
    let start = block.uriIndex;

    for (let index = block.uriIndex - 1; index >= block.start; index -= 1) {
      const line = lines[index];
      if (isExtinf(line) || isDropTag(line) || line.trim() === "") {
        start = index;
        continue;
      }
      break;
    }

    return {
      start,
      end: block.end
    };
  }

  function mergeRanges(ranges) {
    const sorted = ranges.slice().sort((a, b) => a.start - b.start);
    const merged = [];

    for (const range of sorted) {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end + 1) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push({ start: range.start, end: range.end });
      }
    }

    return merged;
  }

  function compactDiscontinuities(lines) {
    const result = [];
    let previousWasDiscontinuity = false;

    for (const line of lines) {
      const isDiscontinuity = line.trim().toUpperCase() === "#EXT-X-DISCONTINUITY";
      if (isDiscontinuity && previousWasDiscontinuity) {
        continue;
      }
      result.push(line);
      previousWasDiscontinuity = isDiscontinuity;
    }

    return result;
  }

  function filterPlaylist(text) {
    if (!isPlaylist(text)) {
      return {
        text,
        removed: 0
      };
    }

    const hadTrailingNewline = /\r?\n$/.test(text);
    let normalized = false;
    const lines = text.split(/\r?\n/).map((line) => {
      if (isSegmentUri(line) && CONVERT_PREFIX_PATTERN.test(line.trim())) {
        normalized = true;
        return normalizeSegmentUri(line);
      }
      return line;
    });
    const blocks = collectSegmentBlocks(lines);
    const removalRanges = [];

    for (const block of blocks) {
      if (isAdUri(block.uri)) {
        removalRanges.push(trimBlockForRemoval(lines, block));
      }
    }

    if (removalRanges.length === 0) {
      if (normalized) {
        let normalizedText = lines.join("\n");
        if (hadTrailingNewline && !normalizedText.endsWith("\n")) {
          normalizedText += "\n";
        }
        return {
          text: normalizedText,
          removed: 0
        };
      }
      return {
        text,
        removed: 0
      };
    }

    const ranges = mergeRanges(removalRanges);
    const kept = [];
    let rangeIndex = 0;
    let removed = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const range = ranges[rangeIndex];
      if (range && index >= range.start && index <= range.end) {
        if (isSegmentUri(lines[index])) {
          removed += 1;
        }
        if (index === range.end) {
          rangeIndex += 1;
        }
        continue;
      }
      kept.push(lines[index]);
    }

    const compacted = compactDiscontinuities(kept);
    let nextText = compacted.join("\n");
    if (hadTrailingNewline && !nextText.endsWith("\n")) {
      nextText += "\n";
    }

    return {
      text: nextText,
      removed
    };
  }

  globalScope.AdsSkipperPlaylistFilter = {
    filterPlaylist,
    isPlaylist,
    isAdUri
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.AdsSkipperPlaylistFilter;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
