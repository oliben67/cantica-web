import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth";
import { useAuth } from "./auth-hooks";

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockFetch(...responses: object[]) {
  let stub = vi.fn();
  for (const r of responses) {
    stub = stub.mockResolvedValueOnce(r as unknown as Response);
  }
  vi.stubGlobal("fetch", stub);
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthProvider — no token", () => {
  it("starts with no user and isLoading=false when no token", async () => {
    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user ? user.username : "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    expect(screen.getByText("no-user")).toBeInTheDocument();
  });
});

describe("AuthProvider — with token", () => {
  it("fetches /auth/me and sets user when token exists", async () => {
    localStorage.setItem("cantica_token", "test-jwt");
    const fakeUser = { id: "1", username: "alice", email: "a@a.com", roles: ["user"], is_active: true };
    mockFetch({ ok: true, json: () => Promise.resolve(fakeUser) });

    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user?.username ?? "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());
  });

  it("clears token when /auth/me returns non-ok", async () => {
    localStorage.setItem("cantica_token", "bad-jwt");
    mockFetch({ ok: false, status: 401 });

    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user ? user.username : "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    expect(screen.getByText("no-user")).toBeInTheDocument();
    expect(localStorage.getItem("cantica_token")).toBeNull();
  });

  it("isAdmin is true when user has admin role", async () => {
    localStorage.setItem("cantica_token", "admin-jwt");
    const fakeAdmin = { id: "1", username: "admin", email: "", roles: ["admin"], is_active: true };
    mockFetch({ ok: true, json: () => Promise.resolve(fakeAdmin) });

    function Inspector() {
      const { isAdmin, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{isAdmin ? "admin" : "not-admin"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("isAdmin is false for regular user", async () => {
    localStorage.setItem("cantica_token", "user-jwt");
    const fakeUser = { id: "2", username: "bob", email: "", roles: ["user"], is_active: true };
    mockFetch({ ok: true, json: () => Promise.resolve(fakeUser) });

    function Inspector() {
      const { isAdmin, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{isAdmin ? "admin" : "not-admin"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    expect(screen.getByText("not-admin")).toBeInTheDocument();
  });
});

describe("AuthProvider — login / logout", () => {
  it("login stores token and sets user", async () => {
    // No token → no auth/me call on mount
    const loginResp = {
      access_token: "new-jwt",
      user: { id: "1", username: "alice", email: "a@a.com", roles: ["user"], is_active: true },
    };
    mockFetch({ ok: true, status: 200, json: () => Promise.resolve(loginResp) });

    function Inspector() {
      const { user, isLoading, login } = useAuth();
      if (isLoading) return <div>loading</div>;
      return (
        <>
          <div>{user?.username ?? "no-user"}</div>
          <button onClick={() => void login("alice", "pass")}>Login</button>
        </>
      );
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());

    await userEvent.click(screen.getByText("Login"));
    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());
    expect(localStorage.getItem("cantica_token")).toBe("new-jwt");
  });

  it("login throws when server returns non-ok", async () => {
    mockFetch({ ok: false, status: 401, text: () => Promise.resolve("Bad credentials") });

    let caughtError = "";
    function Inspector() {
      const { login } = useAuth();
      return (
        <button onClick={async () => {
          try { await login("bad", "creds"); }
          catch (e) { caughtError = e instanceof Error ? e.message : String(e); }
        }}>Login</button>
      );
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await userEvent.click(screen.getByText("Login"));
    await waitFor(() => expect(caughtError).toContain("Bad credentials"));
  });

  it("logout clears token and user", async () => {
    localStorage.setItem("cantica_token", "jwt");
    const fakeUser = { id: "1", username: "alice", email: "", roles: ["user"], is_active: true };
    mockFetch({ ok: true, json: () => Promise.resolve(fakeUser) });

    function Inspector() {
      const { user, isLoading, logout } = useAuth();
      if (isLoading) return <div>loading</div>;
      return (
        <>
          <div>{user?.username ?? "no-user"}</div>
          <button onClick={logout}>Logout</button>
        </>
      );
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Logout"));
    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
    expect(localStorage.getItem("cantica_token")).toBeNull();
  });
});

describe("AuthProvider — unauthorized event", () => {
  it("clears user when cantica:unauthorized fires", async () => {
    localStorage.setItem("cantica_token", "jwt");
    const fakeUser = { id: "1", username: "alice", email: "", roles: ["user"], is_active: true };
    mockFetch({ ok: true, json: () => Promise.resolve(fakeUser) });

    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user?.username ?? "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());

    act(() => {
      window.dispatchEvent(new CustomEvent("cantica:unauthorized"));
    });
    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
  });
});
