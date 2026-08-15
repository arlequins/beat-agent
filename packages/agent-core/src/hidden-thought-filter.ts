const OPEN_TAG = /<(?:thinking|think|analysis)(?:\s[^>]*)?>/i;
const CLOSE_TAG = /<\/(?:thinking|think|analysis)\s*>/i;
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
    if (TAG_PREFIXES.some((prefix) => prefix.startsWith(suffix))) return index;
  }
  return value.length;
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
          const closing = CLOSE_TAG.exec(buffer);
          if (!closing) {
            buffer = buffer.slice(pendingTagStart(buffer));
            break;
          }
          buffer = buffer.slice(closing.index + closing[0].length);
          hidden = false;
          continue;
        }

        const opening = OPEN_TAG.exec(buffer);
        if (opening) {
          output += buffer.slice(0, opening.index);
          buffer = buffer.slice(opening.index + opening[0].length);
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
