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

// The shim's /v1/auth/me returns a principal; login is /v1/auth/login → token.
// The AuthProvider probes /v1/auth/me on mount, so route by URL, not by order.
function routeFetch(cfg: {
  me?: { user_id: string; email: string; roles: string[]; anonymous?: boolean } | null;
  login?: { ok: boolean; body: unknown };
}) {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/v1/auth/me") {
      return Promise.resolve(cfg.me == null
        ? { ok: false, status: 401, json: () => Promise.resolve({}) }
        : { ok: true, status: 200, json: () => Promise.resolve({ anonymous: false, ...cfg.me }) });
    }
    if (url === "/v1/auth/login") {
      const l = cfg.login ?? { ok: false, body: "no handler" };
      return Promise.resolve(l.ok
        ? { ok: true, status: 200, json: () => Promise.resolve(l.body) }
        : { ok: false, status: 401, text: () => Promise.resolve(String(l.body)) });
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
  }));
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthProvider — no session", () => {
  it("has no user when /auth/me is unauthorized", async () => {
    routeFetch({ me: null });
    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user ? user.email : "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
  });

  it("treats an anonymous principal as no session", async () => {
    routeFetch({ me: { user_id: "anonymous", email: "", roles: ["readonly"], anonymous: true } });
    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user ? user.email : "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
  });
});

describe("AuthProvider — with session", () => {
  it("adopts the local/admin principal from /auth/me on mount", async () => {
    routeFetch({ me: { user_id: "1", email: "a@a.com", roles: ["user"] } });
    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user?.email ?? "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("a@a.com")).toBeInTheDocument());
  });

  it("isAdmin reflects the admin role", async () => {
    routeFetch({ me: { user_id: "1", email: "admin@x.com", roles: ["admin"] } });
    function Inspector() {
      const { isAdmin, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{isAdmin ? "admin" : "not-admin"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
  });

  it("isAdmin is false for a regular user", async () => {
    routeFetch({ me: { user_id: "2", email: "bob@x.com", roles: ["user"] } });
    function Inspector() {
      const { isAdmin, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{isAdmin ? "admin" : "not-admin"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("not-admin")).toBeInTheDocument());
  });
});

describe("AuthProvider — login / logout", () => {
  it("login stores token then loads the principal via /auth/me", async () => {
    routeFetch({
      me: { user_id: "1", email: "a@a.com", roles: ["user"] },
      login: { ok: true, body: { access_token: "new-jwt" } },
    });
    // No token at mount → me returns the (mocked) principal anyway; that's fine.
    function Inspector() {
      const { user, isLoading, login } = useAuth();
      if (isLoading) return <div>loading</div>;
      return (
        <>
          <div>{user?.email ?? "no-user"}</div>
          <button onClick={() => void login("a@a.com", "pass")}>Login</button>
        </>
      );
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    await userEvent.click(screen.getByText("Login"));
    await waitFor(() => expect(localStorage.getItem("cantica_token")).toBe("new-jwt"));
  });

  it("login throws when the server rejects the credentials", async () => {
    routeFetch({ me: null, login: { ok: false, body: "Bad credentials" } });
    let caught = "";
    function Inspector() {
      const { login } = useAuth();
      return (
        <button onClick={async () => {
          try { await login("bad", "creds"); }
          catch (e) { caught = e instanceof Error ? e.message : String(e); }
        }}>Login</button>
      );
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await userEvent.click(screen.getByText("Login"));
    await waitFor(() => expect(caught).toContain("Bad credentials"));
  });

  it("logout clears token and user", async () => {
    localStorage.setItem("cantica_token", "jwt");
    routeFetch({ me: { user_id: "1", email: "a@a.com", roles: ["user"] } });
    function Inspector() {
      const { user, isLoading, logout } = useAuth();
      if (isLoading) return <div>loading</div>;
      return (
        <>
          <div>{user?.email ?? "no-user"}</div>
          <button onClick={logout}>Logout</button>
        </>
      );
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("a@a.com")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Logout"));
    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
    expect(localStorage.getItem("cantica_token")).toBeNull();
  });
});

describe("AuthProvider — unauthorized event", () => {
  it("clears the user when cantica:unauthorized fires", async () => {
    localStorage.setItem("cantica_token", "jwt");
    routeFetch({ me: { user_id: "1", email: "a@a.com", roles: ["user"] } });
    function Inspector() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <div>loading</div>;
      return <div>{user?.email ?? "no-user"}</div>;
    }
    render(<Wrapper><Inspector /></Wrapper>);
    await waitFor(() => expect(screen.getByText("a@a.com")).toBeInTheDocument());
    act(() => { window.dispatchEvent(new CustomEvent("cantica:unauthorized")); });
    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
  });
});
