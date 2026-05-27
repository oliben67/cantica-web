import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { InvitePage } from "./InvitePage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

function Wrapper({ initialPath = "/invite" }: { initialPath?: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route path="/invite" element={<InvitePage />} />
          </Routes>
        </AuthProvider>
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

describe("InvitePage — step: validate", () => {
  it("shows token input on initial render", () => {
    render(<Wrapper />);
    expect(screen.getByLabelText(/invite token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("advances to register step on valid token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({ valid: true, email: "invited@example.com", message: "" }),
    }));

    render(<Wrapper />);
    await userEvent.type(screen.getByLabelText(/invite token/i), "valid-token");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/create your account/i)).toBeInTheDocument());
    expect(screen.getByText(/invited@example\.com/)).toBeInTheDocument();
  });

  it("shows error message for invalid token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({ valid: false, email: "", message: "Token expired" }),
    }));

    render(<Wrapper />);
    await userEvent.type(screen.getByLabelText(/invite token/i), "bad-token");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(screen.getByText("Token expired")).toBeInTheDocument());
    expect(screen.queryByText(/create your account/i)).not.toBeInTheDocument();
  });

  it("auto-validates token from URL query parameter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({ valid: true, email: "auto@test.com", message: "" }),
    }));

    render(<Wrapper initialPath="/invite?token=auto-token" />);
    await waitFor(() => expect(screen.getByText(/create your account/i)).toBeInTheDocument());
    expect(screen.getByText(/auto@test\.com/)).toBeInTheDocument();
  });

  it("shows generic error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network error")));

    render(<Wrapper />);
    await userEvent.type(screen.getByLabelText(/invite token/i), "some-token");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/could not validate/i)).toBeInTheDocument());
  });
});

describe("InvitePage — step: register", () => {
  async function advanceToRegister() {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({ valid: true, email: "user@test.com", message: "" }),
    }));

    render(<Wrapper />);
    await userEvent.type(screen.getByLabelText(/invite token/i), "valid-tok");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByText(/create your account/i)).toBeInTheDocument());
  }

  it("shows username, email and password fields", async () => {
    await advanceToRegister();
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    await advanceToRegister();
    await userEvent.type(screen.getByLabelText(/^username$/i), "newuser");
    await userEvent.type(screen.getByLabelText(/^password$/i), "pass1");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "pass2");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(localStorage.getItem("cantica_token")).toBeNull();
  });

  it("accepts invite, stores JWT, and shows success screen", async () => {
    await advanceToRegister();
    const session = {
      access_token: "new-jwt", token_type: "bearer", expires_in: 3600,
      user: { id: "u1", username: "newuser", email: "", roles: ["user"], is_active: true },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true, status: 200, json: () => Promise.resolve(session),
    }));

    await userEvent.type(screen.getByLabelText(/^username$/i), "newuser");
    await userEvent.type(screen.getByLabelText(/^password$/i), "MyPass1!");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "MyPass1!");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText(/welcome, newuser/i)).toBeInTheDocument());
    expect(localStorage.getItem("cantica_token")).toBe("new-jwt");
  });

  it("shows server error when accept fails", async () => {
    await advanceToRegister();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false, status: 400, text: () => Promise.resolve("Username taken"),
    }));

    await userEvent.type(screen.getByLabelText(/^username$/i), "takenuser");
    await userEvent.type(screen.getByLabelText(/^password$/i), "pass");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText("Username taken")).toBeInTheDocument());
  });
});
