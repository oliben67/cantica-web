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

// No token in localStorage → AuthProvider does NOT call fetch on mount.

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  mockNavigate.mockClear();
});

describe("LoginPage", () => {
  it("renders username, password fields and sign-in button", () => {
    render(<Wrapper><LoginPage /></Wrapper>);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("navigates to / on successful login", async () => {
    const loginResp = {
      access_token: "jwt",
      user: { id: "1", username: "alice", email: "", roles: ["user"], is_active: true },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true, status: 200, json: () => Promise.resolve(loginResp),
    }));

    render(<Wrapper><LoginPage /></Wrapper>);
    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true }));
  });

  it("shows error message on failed login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false, status: 401, text: () => Promise.resolve("Invalid credentials"),
    }));

    render(<Wrapper><LoginPage /></Wrapper>);
    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalledWith("/", expect.anything());
  });

  it("disables submit button while loading", async () => {
    let resolveLogin!: (v: unknown) => void;
    const pending = new Promise((res) => { resolveLogin = res; });
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(pending));

    render(<Wrapper><LoginPage /></Wrapper>);
    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();

    // resolve to avoid dangling promise warning
    await act(async () => {
      resolveLogin({
        ok: true, status: 200,
        json: () => Promise.resolve({ access_token: "jwt", user: { id: "1", username: "alice", email: "", roles: [], is_active: true } }),
      });
    });
  });
});
