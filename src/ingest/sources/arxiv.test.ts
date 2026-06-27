import { describe, expect, it } from "vitest";

import { parseArxivAtom } from "./arxiv";

const TWO_ENTRY_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v2</id>
    <updated>2024-01-20T00:00:00Z</updated>
    <published>2024-01-15T00:00:00Z</published>
    <title>A Great   Paper
      About Things</title>
    <summary>  We study   things.  </summary>
    <author><name>Ada Lovelace</name></author>
    <link href="http://arxiv.org/abs/2401.12345v2" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/2401.12345v2" rel="related" type="application/pdf"/>
    <category term="cs.CL"/>
    <category term="cs.AI"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2402.00001v1</id>
    <published>2024-02-01T00:00:00Z</published>
    <title>Second Paper</title>
    <summary>Abstract two.</summary>
    <author><name>Alan Turing</name></author>
    <author><name>Grace Hopper</name></author>
    <link href="http://arxiv.org/abs/2402.00001v1" rel="alternate" type="text/html"/>
    <category term="cs.LG"/>
  </entry>
</feed>`;

const SINGLE_ENTRY_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2403.55555v1</id>
    <published>2024-03-01T00:00:00Z</published>
    <title>Solo</title>
    <summary>One.</summary>
    <author><name>Solo Author</name></author>
    <link href="http://arxiv.org/abs/2403.55555v1" rel="alternate" type="text/html"/>
    <category term="cs.AI"/>
  </entry>
</feed>`;

const EMPTY_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"></feed>`;

describe("parseArxivAtom", () => {
  it("parses a multi-entry feed into normalized RawItems", () => {
    const items = parseArxivAtom(TWO_ENTRY_FEED);
    expect(items).toHaveLength(2);
  });

  it("strips the id prefix, keeps version, and normalizes whitespace", () => {
    const [first] = parseArxivAtom(TWO_ENTRY_FEED);
    expect(first.source).toBe("arxiv");
    expect(first.externalId).toBe("2401.12345v2");
    expect(first.title).toBe("A Great Paper About Things");
    expect(first.abstract).toBe("We study things.");
    expect(first.url).toBe("http://arxiv.org/abs/2401.12345v2");
    expect(first.publishedAt).toEqual(new Date("2024-01-15T00:00:00Z"));
  });

  it("extracts version, pdf url, and categories into rawMetadata", () => {
    const [first] = parseArxivAtom(TWO_ENTRY_FEED);
    expect(first.rawMetadata).toMatchObject({
      version: 2,
      pdfUrl: "http://arxiv.org/pdf/2401.12345v2",
      categories: ["cs.CL", "cs.AI"],
    });
  });

  it("handles a single author (object) and multiple authors (array)", () => {
    const [first, second] = parseArxivAtom(TWO_ENTRY_FEED);
    expect(first.authors).toEqual(["Ada Lovelace"]);
    expect(second.authors).toEqual(["Alan Turing", "Grace Hopper"]);
  });

  it("handles a feed with a single entry (object, not array)", () => {
    const items = parseArxivAtom(SINGLE_ENTRY_FEED);
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe("2403.55555v1");
  });

  it("returns an empty array for a feed with no entries", () => {
    expect(parseArxivAtom(EMPTY_FEED)).toEqual([]);
  });

  it("throws on a malformed entry (missing required fields)", () => {
    const bad = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><summary>no id or title</summary></entry></feed>`;
    expect(() => parseArxivAtom(bad)).toThrow();
  });
});
