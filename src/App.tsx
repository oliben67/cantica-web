import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth";
import { useAuth, useRequireAuth } from "@/lib/auth-hooks";
import { Browse } from "@/pages/Browse";
import { CollectionDetail } from "@/pages/CollectionDetail";
import { Collections } from "@/pages/Collections";
import { FederationPage } from "@/pages/FederationPage";
import { InvitePage } from "@/pages/InvitePage";
import { LoginPage } from "@/pages/LoginPage";
import { NamespacePage } from "@/pages/NamespacePage";
import { PromptDetail } from "@/pages/PromptDetail";
import { SecurityAdminPage } from "@/pages/SecurityAdminPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

/** Wraps all authenticated routes — redirects to /login while auth is loading or absent. */
function AuthenticatedLayout() {
  const loading = useRequireAuth();
  if (loading) return null;
  return (
    <div className="min-h-screen">
      <Navbar />
      <Routes>
        <Route path="/" element={<Browse />} />
        <Route path="/prompts/:namespace/:name" element={<PromptDetail />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:namespace/:name" element={<CollectionDetail />} />
        <Route path="/admin" element={<Navigate to="/admin/security" replace />} />
        <Route path="/admin/federation" element={<FederationPage />} />
        <Route path="/admin/security" element={<SecurityAdminPage />} />
        <Route path="/:namespace" element={<NamespacePage />} />
      </Routes>
    </div>
  );
}

/** Redirect already-logged-in users away from /login. */
function LoginRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route path="*" element={<AuthenticatedLayout />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
