export interface ParsedVerdict {
  verdict: "ALLOW" | "DENY";
  reason: string;
}

/**
 * The model's verdict for one action. Fails closed: only an exact
 * `{verdict, reason, action}` object naming this action can be an ALLOW.
 */
export function parseVerdict(content: string, canonicalAction: string): ParsedVerdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return deny("verdict is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return deny("verdict is not a JSON object");
  }
  // Exactly these three keys, each once. JSON.parse keeps the last duplicate,
  // other parsers may not, so a duplicate is a DENY rather than a guess.
  const keys = topLevelKeys(content).sort();
  if (keys.join(",") !== "action,reason,verdict") {
    return deny("verdict must have exactly the keys verdict, reason, action");
  }
  const v = parsed as Record<string, unknown>;
  if (v.verdict !== "ALLOW" && v.verdict !== "DENY") return deny("verdict is neither ALLOW nor DENY");
  if (typeof v.reason !== "string" || [...v.reason].length > 280) {
    return deny("reason must be a string of at most 280 characters");
  }
  if (v.action !== canonicalAction) return deny("verdict names a different action");
  return { verdict: v.verdict, reason: v.reason };
}

/** Keys of the outermost object in already-valid JSON, decoded, duplicates kept. */
function topLevelKeys(json: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (c === '"') {
      let j = i + 1;
      while (json[j] !== '"') j += json[j] === "\\" ? 2 : 1;
      let k = j + 1;
      while (/\s/.test(json[k] ?? "")) k++;
      if (depth === 1 && json[k] === ":") keys.push(JSON.parse(json.slice(i, j + 1)));
      i = j;
    } else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
  }
  return keys;
}

function deny(why: string): ParsedVerdict {
  return { verdict: "DENY", reason: `firewall: ${why}` };
}
