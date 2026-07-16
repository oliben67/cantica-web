import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { InvitePage } from "./InvitePage";

// AuthProvider probes /v1/auth/me on mount — stub it to a 401 (no session).
function stubMe() {
  vi.stubGlobal("fetch", vi.fn((url: string) =>
    url === "/v1/auth/me"
      ? Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })
      : Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") }),
  ));
}

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

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("InvitePage (key enrolment)", () => {
  it("renders the enrolment form", () => {
    stubMe();
    render(<Wrapper />);
    expect(screen.getByText(/accept invitation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/invitation token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enrol this device/i })).toBeInTheDocument();
  });

  it("prefills the token from the URL query parameter", () => {
    stubMe();
    render(<Wrapper initialPath="/invite?token=INV.JWT.TOKEN" />);
    expect(screen.getByLabelText(/invitation token/i)).toHaveValue("INV.JWT.TOKEN");
  });

  it("keeps the enrol button disabled without a token", () => {
    stubMe();
    render(<Wrapper />);
    expect(screen.getByRole("button", { name: /enrol this device/i })).toBeDisabled();
  });
});
