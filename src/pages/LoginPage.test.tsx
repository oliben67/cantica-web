import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { LoginPage } from "./LoginPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

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

/** URL-routing fetch mock — the AuthProvider probes /v1/auth/me on mount, so
 *  order-based mocks won't do. `me` is the principal (or null = 401). */
function routeFetch(handlers: {
  me?: unknown | null;
  login?: { ok: boolean; body: unknown };
}) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === "/v1/auth/me") {
      const p = handlers.me;
      return Promise.resolve(p == null
        ? { ok: false, status: 401, json: () => Promise.resolve({}) }
        : { ok: true, status: 200, json: () => Promise.resolve(p) });
    }
    if (url === "/v1/auth/login") {
      const l = handlers.login ?? { ok: false, body: "no handler" };
      return Promise.resolve(l.ok
        ? { ok: true, status: 200, json: () => Promise.resolve(l.body) }
        : { ok: false, status: 401, text: () => Promise.resolve(String(l.body)) });
    }
    void init;
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("nope") });
  });
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  mockNavigate.mockClear();
});

describe("LoginPage", () => {
  it("renders email, password fields and sign-in button", () => {
    vi.stubGlobal("fetch", routeFetch({ me: null }));
    render(<Wrapper><LoginPage /></Wrapper>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("navigates to / on successful login", async () => {
    vi.stubGlobal("fetch", routeFetch({
      me: { user_id: "1", email: "a@x.com", roles: ["user"], anonymous: false },
      login: { ok: true, body: { access_token: "jwt" } },
    }));

    render(<Wrapper><LoginPage /></Wrapper>);
    await userEvent.type(screen.getByLabelText(/email/i), "a@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(localStorage.getItem("cantica_token")).toBe("jwt");
  });

  it("shows error message on failed login", async () => {
    vi.stubGlobal("fetch", routeFetch({
      me: null,
      login: { ok: false, body: "Invalid credentials" },
    }));

    render(<Wrapper><LoginPage /></Wrapper>);
    await userEvent.type(screen.getByLabelText(/email/i), "a@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalledWith("/", expect.anything());
  });

  it("disables submit button while loading", async () => {
    let resolveLogin!: (v: unknown) => void;
    const pending = new Promise((res) => { resolveLogin = res; });
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/v1/auth/me") {
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
      }
      return pending; // /v1/auth/login hangs
    }));

    render(<Wrapper><LoginPage /></Wrapper>);
    await userEvent.type(screen.getByLabelText(/email/i), "a@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();

    await act(async () => {
      resolveLogin({ ok: true, status: 200, json: () => Promise.resolve({ access_token: "jwt" }) });
    });
  });
});
