"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Factor {
  id: string;
  status: "verified" | "unverified";
  friendlyName?: string | null;
}

export function MfaManager() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Enrollment in progress
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setFactors(
      (data?.totp ?? []).map((f) => ({
        id: f.id,
        status: f.status,
        friendlyName: f.friendly_name,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    try {
      const supabase = createClient();
      // Clean up any stale unverified factor first — Supabase allows only a
      // limited number of enrolled factors per user.
      for (const stale of factors.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setEnrollFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enrollFactorId || code.trim().length < 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (challenge.error) {
        toast.error(challenge.error.message);
        return;
      }
      const verify = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) {
        toast.error(verify.error.message);
        return;
      }
      toast.success("Two-factor authentication enabled");
      setEnrollFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unenroll(factorId: string) {
    if (
      !confirm(
        "Disable two-factor authentication? If MFA enforcement is on for your role, you may be unable to sign in until you re-enroll."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Two-factor authentication disabled");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const verified = factors.filter((f) => f.status === "verified");

  if (loading) {
    return (
      <Card className="max-w-xl">
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading security settings…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            {verified.length > 0 ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-sm font-semibold">
                Authenticator app (TOTP)
              </h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {verified.length > 0
                  ? "Two-factor authentication is active on your account. You'll be asked for a 6-digit code at sign-in."
                  : "Add a second factor using Google Authenticator, 1Password, Authy, or any TOTP app."}
              </p>
            </div>
            {verified.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => unenroll(verified[0].id)}
              >
                Disable
              </Button>
            ) : (
              !enrollFactorId && (
                <Button size="sm" disabled={busy} onClick={startEnroll}>
                  <Smartphone className="h-4 w-4" /> Set up
                </Button>
              )
            )}
          </div>

          {enrollFactorId && qrCode && (
            <div className="mt-5 space-y-4 rounded-md border border-border bg-surface-alt/40 p-4">
              <div className="flex flex-wrap items-start gap-4">
                {/* Supabase returns the QR as an SVG data URI */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="Scan this QR code with your authenticator app"
                  className="h-40 w-40 rounded bg-white p-2"
                />
                <div className="min-w-0 flex-1 space-y-2 text-[13px]">
                  <p className="font-medium">1. Scan the QR code</p>
                  <p className="text-muted-foreground">
                    Or enter this secret manually:
                  </p>
                  <code className="block break-all rounded bg-surface px-2 py-1 font-mono text-xs">
                    {secret}
                  </code>
                  <p className="pt-2 font-medium">2. Enter the 6-digit code</p>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="mfa-code" className="sr-only">
                      Verification code
                    </Label>
                    <Input
                      id="mfa-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-28 text-center font-mono tracking-[0.3em]"
                    />
                    <Button size="sm" disabled={busy} onClick={confirmEnroll}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEnrollFactorId(null);
                        setQrCode(null);
                        setSecret(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Admins: once every admin, GM, and finance user has enrolled, set{" "}
        <code className="font-mono">ENFORCE_MFA=true</code> in the deployment
        environment to require a second factor for those roles at sign-in.
      </p>
    </div>
  );
}
