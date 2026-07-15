import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminVerificationItem,
  approveVerification,
  fetchVerifications,
  rejectVerification,
} from "../api/client";
import { VerificationCard } from "../components/VerificationCard";

type SectionKey = "MANUAL_REVIEW" | "REJECTED" | "APPROVED";

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  {
    key: "MANUAL_REVIEW",
    title: "Necesită revizuire",
    description: "Potrivire facială OK, dar calitatea imaginii cere o decizie manuală",
  },
  {
    key: "REJECTED",
    title: "Respinse",
    description: "Scor de potrivire scăzut; utilizatorul poate retrimite direct documentele. Aprobă acordă manual rolul de ghid, Respinge șterge complet cererea",
  },
  {
    key: "APPROVED",
    title: "Aprobate automat",
    description: "Potrivire InsightFace reușită — utilizatorul e ghid; retrogradează din Utilizatori dacă e nevoie",
  },
];

export function VerificationsPage() {
  const [items, setItems] = useState<AdminVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchVerifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu s-au putut încărca datele");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const buckets: Record<SectionKey, AdminVerificationItem[]> = {
      MANUAL_REVIEW: [],
      REJECTED: [],
      APPROVED: [],
    };
    for (const item of items) {
      const status = item.verificationStatus as SectionKey;
      if (status in buckets) {
        buckets[status].push(item);
      }
    }
    return buckets;
  }, [items]);

  async function onApprove(userId: number) {
    setBusyId(userId);
    try {
      await approveVerification(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aprobarea a eșuat");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(userId: number) {
    const reason = window.prompt("Motivul respingerii (opțional):") ?? undefined;
    if (reason === undefined) {
      return;
    }
    setBusyId(userId);
    try {
      await rejectVerification(userId, reason.trim() || undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Respingerea a eșuat");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Verificări de identitate</h2>
          <p className="muted">Doar administratorul dă aprobarea finală a conturilor.</p>
        </div>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>
          Reîncarcă
        </button>
      </div>

      {error ? <p className="error banner">{error}</p> : null}
      {loading ? <p className="muted">Se încarcă…</p> : null}

      {!loading
        ? SECTIONS.map((section) => (
            <div key={section.key} className="verification-section">
              <div className="verification-section-head">
                <div>
                  <h3>{section.title}</h3>
                  <p className="muted">{section.description}</p>
                </div>
                <span className="pill">{grouped[section.key].length}</span>
              </div>

              {grouped[section.key].length === 0 ? (
                <div className="card empty-state">Niciun utilizator în această secțiune.</div>
              ) : (
                <div className="stack">
                  {grouped[section.key].map((item) => (
                    <VerificationCard
                      key={item.userId}
                      item={item}
                      busy={busyId === item.userId}
                      onApprove={onApprove}
                      onReject={onReject}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        : null}
    </section>
  );
}
