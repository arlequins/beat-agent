const HIDDEN_TAG_NAMES = ["thinking", "think", "analysis"];
const TAG_PREFIXES = [
  "<thinking",
  "<think",
  "<analysis",
  "</thinking",
  "</think",
  "</analysis",
];

function pendingTagStart(value: string): number {
  const lower = value.toLowerCase();
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] !== "<") continue;
    const suffix = lower.slice(index);
    const tagPrefix = suffix.trimEnd();
    if (TAG_PREFIXES.some((prefix) => prefix.startsWith(tagPrefix)))
      return index;
  }
  return value.length;
}

function isWhitespace(value: string | undefined): boolean {
  return value === " " || value === "\t" || value === "\r" || value === "\n";
}

function findHiddenTag(
  value: string,
  closing: boolean,
): { index: number; length: number } | undefined {
  const lower = value.toLowerCase();
  const marker = closing ? "</" : "<";
  let searchFrom = 0;
  while (true) {
    const index = lower.indexOf(marker, searchFrom);
    if (index < 0) return undefined;
    for (const name of HIDDEN_TAG_NAMES) {
      const nameStart = index + marker.length;
      if (!lower.startsWith(name, nameStart)) continue;
      const boundary = value[nameStart + name.length];
      if (boundary !== ">" && !isWhitespace(boundary)) continue;
      const end = lower.indexOf(">", nameStart + name.length);
      if (end < 0) return undefined;
      return { index, length: end + 1 - index };
    }
    searchFrom = index + marker.length;
  }
}

/** Removes model-internal reasoning tags without breaking streamed output. */
export function createHiddenThoughtFilter() {
  let buffer = "";
  let hidden = false;

  return {
    push(chunk: string): string {
      buffer += chunk;
      let output = "";
      while (buffer) {
        if (hidden) {
          const closing = findHiddenTag(buffer, true);
          if (!closing) {
            buffer = buffer.slice(pendingTagStart(buffer));
            break;
          }
          buffer = buffer.slice(closing.index + closing.length);
          hidden = false;
          continue;
        }

        const opening = findHiddenTag(buffer, false);
        if (opening) {
          output += buffer.slice(0, opening.index);
          buffer = buffer.slice(opening.index + opening.length);
          hidden = true;
          continue;
        }

        const pending = pendingTagStart(buffer);
        output += buffer.slice(0, pending);
        buffer = buffer.slice(pending);
        break;
      }
      return output;
    },

    flush(): string {
      if (hidden) {
        buffer = "";
        return "";
      }
      const output = buffer;
      buffer = "";
      return output;
    },
  };
}
