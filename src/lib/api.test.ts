import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listPrompts,
  getPrompt,
  starPrompt,
  unstarPrompt,
  listFederations,
  createFederation,
  listPeers,
  addPeer,
  removePeer,
  getIdentity,
} from "./api";

function mockFetch(body: unknown, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

function mockFetchStatus(status: number) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("error"),
  } as unknown as Response);
}

describe("API — auth header", () => {
  beforeEach(() => {
    localStorage.setItem("cantica_token", "test-jwt");
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("includes Authorization header when token present", async () => {
    mockFetch([]);
    await listPrompts();
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers["Authorization"]).toBe("Bearer test-jwt");
  });

  it("dispatches cantica:unauthorized event on 401", async () => {
    const handler = vi.fn();
    window.addEventListener("cantica:unauthorized", handler);
    mockFetchStatus(401);
    await listPrompts();
    expect(handler).toHaveBeenCalled();
    window.removeEventListener("cantica:unauthorized", handler);
  });
});

describe("API — prompts", () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it("listPrompts calls GET /v1/prompts", async () => {
    mockFetch([{ id: "1", name: "test" }]);
    const result = await listPrompts();
    expect(result).toHaveLength(1);
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/prompts");
  });

  it("listPrompts passes query params", async () => {
    mockFetch([]);
    await listPrompts({ q: "hello", namespace: "ns" });
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("q=hello");
    expect(url).toContain("namespace=ns");
  });

  it("getPrompt calls GET /v1/prompts/:ns/:name", async () => {
    mockFetch({ id: "1" });
    await getPrompt("myns", "myname");
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/prompts/myns/myname");
  });

  it("starPrompt calls POST /v1/prompts/:ns/:name/star", async () => {
    mockFetch({ id: "1" });
    await starPrompt("ns", "name");
    const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/star");
    expect(opts.method).toBe("POST");
  });

  it("unstarPrompt calls DELETE /v1/prompts/:ns/:name/star", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") } as unknown as Response);
    await unstarPrompt("ns", "name");
    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("DELETE");
  });
});

describe("API — federation", () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it("listFederations calls GET /v1/federations", async () => {
    mockFetch([]);
    await listFederations();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/federations");
  });

  it("createFederation sends POST with name", async () => {
    const fed = { id: "f1", name: "Net", founding_key: "", is_founder: true, created_at: "", member_count: 1 };
    mockFetch(fed);
    const result = await createFederation("Net");
    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "Net" });
    expect(result.is_founder).toBe(true);
  });

  it("listPeers calls GET /v1/federation/peers", async () => {
    mockFetch([]);
    await listPeers();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/federation/peers");
  });

  it("addPeer sends POST with name, url, api_key", async () => {
    const peer = { id: "p1", name: "Peer A", url: "https://peer.example.com", api_key: null, added_at: "" };
    mockFetch(peer);
    const result = await addPeer({ name: "Peer A", url: "https://peer.example.com" });
    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(result.name).toBe("Peer A");
  });

  it("removePeer sends DELETE to /v1/federation/peers/:id", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") } as unknown as Response);
    await removePeer("peer-id");
    const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/federation/peers/peer-id");
    expect(opts.method).toBe("DELETE");
  });

  it("getIdentity calls GET /v1/identity", async () => {
    mockFetch({ public_key_pem: "-----BEGIN PUBLIC KEY-----\n...", created_at: "2024-01-01T00:00:00Z" });
    const result = await getIdentity();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/identity");
    expect(result.public_key_pem).toContain("BEGIN PUBLIC KEY");
  });
});
