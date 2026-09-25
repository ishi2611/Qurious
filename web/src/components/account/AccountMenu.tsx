"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ACCOUNTS_ENABLED, supabase, syncProgress } from "@/lib/progress";
import { Button } from "@/components/ui/Button";

/**
 * "Save progress" in the header. Hidden entirely unless Supabase is configured. Signing in is
 * optional: everything works without an account, with progress kept on this device.
 */
export default function AccountMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [synced, setSynced] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  // Sync when signed in, and again whenever a journey is saved on this device.
  useEffect(() => {
    const sb = supabase();
    if (!sb || !user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () =>
      syncProgress(sb, user.id)
        .then(() => setSynced(new Date().toLocaleTimeString()))
        .catch(() => setSynced(null));
    run();
    const onSaved = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 2000); // debounce bursts of saves
    };
    window.addEventListener("qurious:journey-saved", onSaved);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("qurious:journey-saved", onSaved);
    };
  }, [user]);

  if (!ACCOUNTS_ENABLED) return null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const sb = supabase()!;
    setStatus("sending");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setStatus(error ? "error" : "sent");
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-9 px-2 text-sm"
      >
        {user ? "Progress saved" : "Save progress"}
      </Button>
      {open && (
        <div
          ref={panel}
          className="border-border bg-surface shadow-card absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border p-4 text-sm"
        >
          {user ? (
            <>
              <p>
                Signed in as <strong>{user.email}</strong>. Your progress syncs
                across devices
                {synced ? ` (last synced ${synced})` : ""}.
              </p>
              <Button
                variant="secondary"
                onClick={() => supabase()!.auth.signOut()}
              >
                Sign out
              </Button>
            </>
          ) : status === "sent" ? (
            <p aria-live="polite">
              Check your inbox for a sign-in link. Your progress will sync after
              you click it.
            </p>
          ) : (
            <form onSubmit={send} className="space-y-2">
              <p>
                Your progress is saved on this device. Add an email to pick up
                where you left off on another device. We only use it to sign you
                in.
              </p>
              <label className="block">
                <span className="sr-only">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="border-border bg-bg min-h-11 w-full rounded-lg border px-3"
                />
              </label>
              <Button type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Email me a sign-in link"}
              </Button>
              {status === "error" && (
                <p className="text-danger">
                  That didn&apos;t work. Please try again.
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
