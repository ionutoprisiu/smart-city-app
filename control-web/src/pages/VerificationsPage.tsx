import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminVerificationItem,
  allowResubmit,
  approveVerification,
  fetchVerifications,
  rejectVerification,
} from "../api/client";
import { VerificationCard } from "../components/VerificationCard";

type SectionKey = "MANUAL_REVIEW" | "REJECTED" | "APPROVED";

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  {
    key: "MANUAL_REVIEW",
    title: "Needs review",
    description: "Face match OK but image quality needs a manual decision",
  },
  {
    key: "REJECTED",
    title: "Rejected",
    description: "Low match score; admin may approve manually or allow resubmit",
  },
  {
    key: "APPROVED",
    title: "Auto-approved",
    description: "InsightFace match passed — user is organizer; demote from Users if needed",
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
      setError(err instanceof Error ? err.message : "Failed to load");
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
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(userId: number) {
    const reason = window.prompt("Rejection reason (optional):") ?? undefined;
    if (reason === undefined) {
      return;
    }
    setBusyId(userId);
    try {
      await rejectVerification(userId, reason.trim() || undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onAllowResubmit(userId: number) {
    const confirmed = window.confirm(
      "Allow this user to upload their documents again?",
    );
    if (!confirmed) {
      return;
    }
    setBusyId(userId);
    try {
      await allowResubmit(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Allow resubmit failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Identity verifications</h2>
          <p className="muted">Only an admin can give final account approval.</p>
        </div>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>
          Reload
        </button>
      </div>

      {error ? <p className="error banner">{error}</p> : null}
      {loading ? <p className="muted">Loading...</p> : null}

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
                <div className="card empty-state">No users in this section.</div>
              ) : (
                <div className="stack">
                  {grouped[section.key].map((item) => (
                    <VerificationCard
                      key={item.userId}
                      item={item}
                      busy={busyId === item.userId}
                      onApprove={onApprove}
                      onReject={onReject}
                      onAllowResubmit={onAllowResubmit}
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
