import { describe, expect, it } from "vitest";

import { parseFeed } from "./rss";

const RSS_2_0 = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <item>
      <title><![CDATA[First Post & More]]></title>
      <link>https://example.com/first</link>
      <description><![CDATA[<p>Summary of the <b>first</b> post.</p>]]></description>
      <pubDate>Wed, 08 Jul 2026 13:30:00 GMT</pubDate>
      <guid isPermaLink="true">https://example.com/first</guid>
      <dc:creator>Jane Doe</dc:creator>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/second</link>
      <description>Plain description.</description>
      <pubDate>Tue, 07 Jul 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Solo Blog</title>
  <author><name>Simon Test</name></author>
  <entry>
    <title>Atom Post</title>
    <link href="https://example.net/atom-post" rel="alternate"/>
    <published>2026-07-08T23:57:21+00:00</published>
    <id>https://example.net/atom-post</id>
    <summary type="html">A short summary.</summary>
  </entry>
  <entry>
    <title>No Summary Post</title>
    <link href="https://example.net/empty" rel="alternate"/>
    <published>2026-07-07T00:00:00+00:00</published>
    <id>https://example.net/empty</id>
    <summary type="html"> </summary>
  </entry>
</feed>`;

describe("parseFeed (RSS 2.0)", () => {
  it("parses items, strips HTML, and reads guid/creator", () => {
    const items = parseFeed(RSS_2_0, "Test Blog");
    expect(items).toHaveLength(2);
    const [first] = items;
    expect(first.source).toBe("rss");
    expect(first.externalId).toBe("https://example.com/first");
    expect(first.title).toBe("First Post & More");
    expect(first.abstract).toBe("Summary of the first post.");
    expect(first.authors).toEqual(["Jane Doe"]);
    expect(first.publishedAt).toEqual(new Date("Wed, 08 Jul 2026 13:30:00 GMT"));
    expect(first.rawMetadata).toMatchObject({ feed: "Test Blog" });
  });
});

describe("parseFeed (Atom)", () => {
  it("parses entries, uses link href + id, falls back to feed author", () => {
    const [first] = parseFeed(ATOM, "Solo Blog");
    expect(first.source).toBe("rss");
    expect(first.externalId).toBe("https://example.net/atom-post");
    expect(first.url).toBe("https://example.net/atom-post");
    expect(first.title).toBe("Atom Post");
    expect(first.abstract).toBe("A short summary.");
    expect(first.authors).toEqual(["Simon Test"]);
  });

  it("maps an empty summary to a null abstract", () => {
    const second = parseFeed(ATOM, "Solo Blog")[1];
    expect(second.abstract).toBeNull();
  });
});

describe("parseFeed (errors)", () => {
  it("throws on an unrecognized format", () => {
    expect(() => parseFeed("<html><body>not a feed</body></html>", "x")).toThrow();
  });
});
