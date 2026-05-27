import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listPrompts,
  getPrompt,
  starPrompt,
  unstarPrompt,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  createInvite,
  listInvites,
  validateInviteToken,
  acceptInvite,
  listFederations,
  createFederation,
  listPeers,
  addPeer,
  removePeer,
  getIdentity,
} from "./api";

function mockFetch(body: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

function mockFetchStatus(status: number) {
  global.fetch = vi.fn().mockResolvedValueOnce({
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
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
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
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/prompts");
  });

  it("listPrompts passes query params", async () => {
    mockFetch([]);
    await listPrompts({ q: "hello", namespace: "ns" });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("q=hello");
    expect(url).toContain("namespace=ns");
  });

  it("getPrompt calls GET /v1/prompts/:ns/:name", async () => {
    mockFetch({ id: "1" });
    await getPrompt("myns", "myname");
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/prompts/myns/myname");
  });

  it("starPrompt calls POST /v1/prompts/:ns/:name/star", async () => {
    mockFetch({ id: "1" });
    await starPrompt("ns", "name");
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/star");
    expect(opts.method).toBe("POST");
  });

  it("unstarPrompt calls DELETE /v1/prompts/:ns/:name/star", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") } as unknown as Response);
    await unstarPrompt("ns", "name");
    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("DELETE");
  });
});

describe("API — admin users", () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it("listAdminUsers calls GET /v1/admin/users", async () => {
    mockFetch([]);
    await listAdminUsers();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/admin/users");
  });

  it("createAdminUser sends correct body", async () => {
    const user = { id: "1", username: "u", email: "e@e.com", roles: ["user"], is_active: true, created_at: "" };
    mockFetch(user);
    const result = await createAdminUser({ username: "u", email: "e@e.com", password: "p", roles: ["user"] });
    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toMatchObject({ username: "u", email: "e@e.com" });
    expect(result.username).toBe("u");
  });

  it("updateAdminUser sends PATCH with partial fields", async () => {
    mockFetch({ id: "1", username: "u", email: "e@e.com", roles: ["admin"], is_active: false, created_at: "" });
    await updateAdminUser("1", { is_active: false });
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/admin/users/1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({ is_active: false });
  });

  it("deleteAdminUser sends DELETE", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") } as unknown as Response);
    await deleteAdminUser("user-id");
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/admin/users/user-id");
    expect(opts.method).toBe("DELETE");
  });

  it("throws on non-ok response", async () => {
    mockFetchStatus(422);
    await expect(listAdminUsers()).rejects.toThrow("422");
  });
});

describe("API — invites", () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it("createInvite sends POST with email", async () => {
    const inv = { id: "i1", email: "x@x.com", token: "tok", invite_url: "/invite?token=tok", expires_at: "", used: false, created_at: "" };
    mockFetch(inv);
    const result = await createInvite("x@x.com", 48);
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/admin/invites");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ email: "x@x.com", expires_in_hours: 48 });
    expect(result.token).toBe("tok");
  });

  it("listInvites calls GET /v1/admin/invites", async () => {
    mockFetch([]);
    await listInvites();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/admin/invites");
  });

  it("validateInviteToken calls /v1/invites/:token without auth header", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ valid: true, email: "x@x.com", message: "" }) } as unknown as Response);
    const result = await validateInviteToken("my-token");
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/invites/my-token");
    expect(result.valid).toBe(true);
    expect(result.email).toBe("x@x.com");
  });

  it("acceptInvite sends POST and returns session", async () => {
    const session = { access_token: "jwt", token_type: "bearer", expires_in: 3600, user: { id: "u1", username: "bob", email: "", roles: ["user"], is_active: true } };
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(session) } as unknown as Response);
    const result = await acceptInvite("my-token", { username: "bob", password: "pass" });
    expect(result.access_token).toBe("jwt");
    expect(result.user.username).toBe("bob");
  });

  it("acceptInvite throws on failure", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve("Token expired") } as unknown as Response);
    await expect(acceptInvite("bad-token", { username: "x", password: "y" })).rejects.toThrow("Token expired");
  });
});

describe("API — federation", () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it("listFederations calls GET /v1/federations", async () => {
    mockFetch([]);
    await listFederations();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/federations");
  });

  it("createFederation sends POST with name", async () => {
    const fed = { id: "f1", name: "Net", founding_key: "", is_founder: true, created_at: "", member_count: 1 };
    mockFetch(fed);
    const result = await createFederation("Net");
    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "Net" });
    expect(result.is_founder).toBe(true);
  });

  it("listPeers calls GET /v1/federation/peers", async () => {
    mockFetch([]);
    await listPeers();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/federation/peers");
  });

  it("addPeer sends POST with name, url, api_key", async () => {
    const peer = { id: "p1", name: "Peer A", url: "https://peer.example.com", api_key: null, added_at: "" };
    mockFetch(peer);
    const result = await addPeer({ name: "Peer A", url: "https://peer.example.com" });
    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(result.name).toBe("Peer A");
  });

  it("removePeer sends DELETE to /v1/federation/peers/:id", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") } as unknown as Response);
    await removePeer("peer-id");
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/federation/peers/peer-id");
    expect(opts.method).toBe("DELETE");
  });

  it("getIdentity calls GET /v1/identity", async () => {
    mockFetch({ public_key_pem: "-----BEGIN PUBLIC KEY-----\n...", created_at: "2024-01-01T00:00:00Z" });
    const result = await getIdentity();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/v1/identity");
    expect(result.public_key_pem).toContain("BEGIN PUBLIC KEY");
  });
});
