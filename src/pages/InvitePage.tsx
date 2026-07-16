import {
  KeyEnrolment,
  SecureClient,
  SecureProvider,
  canticaWebTheme,
  createAuthAssertion,
  createFetchTransport,
} from "@cantica/secure-ui";
import "@cantica/secure-ui/styles.css";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { saveDeviceKey } from "@/lib/device-key";

/**
 * Invite acceptance (cantica-secure key-based model). The invite token is an
 * invitation JWT; the user enrols an RSA key pair for this device, then a
 * key-signed assertion is exchanged for a session. The private key is kept in
 * this browser (never sent) so the session can be refreshed later.
 */
export function InvitePage() {
  const [params] = useSearchParams();
  const transport = useMemo(() => createFetchTransport({ baseUrl: "/" }), []);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEnrolled({ canticaUserId, keyPair }: {
    canticaUserId: string;
    keyPair: { privateKey: CryptoKey; publicKeyPem: string };
  }) {
    setError(null);
    try {
      const client = new SecureClient(transport);
      const assertion = await createAuthAssertion(keyPair.privateKey, canticaUserId);
      const session = await client.assert(assertion);
      localStorage.setItem("cantica_token", session.access_token);
      await saveDeviceKey(canticaUserId, keyPair.privateKey);
      setDone(true);
      // Full reload so the AuthProvider picks up the new session.
      setTimeout(() => { window.location.assign("/"); }, 1200);
    } catch {
      setError("Enrolled, but sign-in failed — an admin may need to activate your account.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen size={28} className="text-violet-600" />
          <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Cantica</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Device enrolled</p>
                <p className="text-sm text-zinc-500 mt-1">Signing you in…</p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Accept invitation</h1>
              <p className="text-sm text-zinc-500 mb-6">
                Enrol this device with your invite token. Your key stays in this browser.
              </p>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2 mb-4">
                  {error}
                </p>
              )}
              <SecureProvider transport={transport} theme={canticaWebTheme}>
                <KeyEnrolment initialInvitation={params.get("token") ?? ""} onEnrolled={onEnrolled} />
              </SecureProvider>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
