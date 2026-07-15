import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@shared/components/Icon';
import { extractErrorMessage } from '@shared/api/errors';
import { useVisitCityStore } from '@features/visit-city/store/visitCityStore';
import { useAuthStore } from '@features/auth/store/authStore';
import { AttractionCategory, categoryIcon } from '@features/visit-city/types';
import { ToursApi } from '../api/toursApi';
import { TourDetail, TourSummary } from '../types';

// Preset time budgets for the Orienteering flow (minutes); null = no limit (TSP).
const BUDGET_PRESETS: { label: string; minutes: number | null }[] = [
  { label: '1 oră', minutes: 60 },
  { label: '2 ore', minutes: 120 },
  { label: '3 ore', minutes: 180 },
  { label: '4 ore', minutes: 240 },
  { label: 'Fără limită', minutes: null },
];

const coverEmojis = (detail: TourDetail | undefined): string[] => {
  if (!detail) return ['🗺️'];
  const unique = [
    ...new Set(detail.attractions.map((a) => categoryIcon(a.category as AttractionCategory))),
  ];
  return unique.slice(0, 3);
};

export const ToursPage: React.FC = () => {
  const navigate = useNavigate();
  const applyTourRoute = useVisitCityStore((s) => s.applyTourRoute);
  const role = useAuthStore((s) => s.currentUser?.role);
  const myId = useAuthStore((s) => s.currentUser?.id);
  // Two-step delete confirm: first tap arms the button, second tap deletes.
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const isGuide = role === 'guide' || role === 'admin';

  const [tours, setTours] = useState<TourSummary[]>([]);
  const [details, setDetails] = useState<Record<number, TourDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Which card has its budget panel expanded + the chosen budget.
  const [openId, setOpenId] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(120);
  const [customBudget, setCustomBudget] = useState('');
  const [optimizingId, setOptimizingId] = useState<number | null>(null);

  useEffect(() => {
    ToursApi.list()
      .then((list) => {
        setTours(list);
        // Prefetch details (emoji covers + candidate ids) — small lists, cheap.
        list.forEach((t) => {
          ToursApi.getTour(t.id)
            .then((d) => setDetails((prev) => ({ ...prev, [t.id]: d })))
            .catch(() => undefined);
        });
      })
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const togglePanel = (id: number) => {
    setError(null);
    setOpenId((prev) => (prev === id ? null : id));
  };

  // Clamp custom input to the backend's valid range (0, 1440] so we never send
  // a request that would 422; falls back to the selected preset when empty/invalid.
  const MAX_BUDGET = 1440;
  const effectiveBudget = (): number | null => {
    const custom = parseInt(customBudget, 10);
    if (customBudget.trim() !== '' && Number.isFinite(custom) && custom > 0) {
      return Math.min(custom, MAX_BUDGET);
    }
    return budget;
  };

  // Build the route: with a budget the backend solves the Orienteering Problem
  // (picks WHICH candidates fit + their order); without, classic TSP on all.
  const buildRoute = async (tour: TourSummary) => {
    setOptimizingId(tour.id);
    setError(null);
    try {
      const detail = details[tour.id] ?? (await ToursApi.getTour(tour.id));
      const budgetUsed = effectiveBudget();
      const result = await ToursApi.optimize(tour.id, budgetUsed);
      // Edge case: budget too small to reach even one attraction. The backend
      // returns a start-only route; don't strand the user on an empty map.
      const stops = result.steps.filter((s) => s.attractionId !== 0).length;
      if (budgetUsed != null && stops === 0) {
        setError(
          `Bugetul de ${budgetUsed} min e prea mic pentru acest tur — niciun obiectiv nu încape (deplasare + vizită). Alege mai mult timp.`,
        );
        return;
      }
      applyTourRoute(detail.attractions.map((a) => a.attractionId), result, tour.id);
      navigate('/visit-city');
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setOptimizingId(null);
    }
  };

  const totalVisitMinutes = (id: number): number | null => {
    const d = details[id];
    if (!d) return null;
    const durations = d.attractions.map((a) => a.visitDurationMinutes);
    if (durations.some((v) => typeof v !== 'number')) return null;
    return durations.reduce((s, v) => s + (v as number), 0);
  };

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      <div className="tours-hero">
        <span className="vc-eyebrow">
          <Icon name="tour" size={14} /> TURURI DE LA GHIZI VERIFICAȚI
        </span>
        <div className="headline-large" style={{ marginTop: 8 }}>Tururi</div>
        <p className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 6, maxWidth: 520 }}>
          Liste de obiective alese de ghizi locali. Spune cât timp ai la dispoziție, iar
          algoritmul construiește traseul care merită — deplasare și vizite incluse.
        </p>
        {isGuide ? (
          <button type="button" className="tours-create-btn" onClick={() => navigate('/tours/create')}>
            <Icon name="add" size={18} color="var(--on-primary)" />
            Creează tur
          </button>
        ) : null}
      </div>

      <div className="page" style={{ paddingTop: 18 }}>
        {error ? (
          <div
            className="body-small rise-in"
            style={{
              color: 'var(--error)',
              background: 'var(--error-container)',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 14,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 210 }} />
            ))}
          </div>
        ) : tours.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🗺️</div>
            <div className="title-medium">Niciun tur încă</div>
            <p className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}>
              Ghizii verificați pot publica tururi tematice. Devino ghid din pagina de profil.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tours.map((t) => {
              const open = openId === t.id;
              const busy = optimizingId === t.id;
              const visitTotal = totalVisitMinutes(t.id);
              return (
                <div key={t.id} className={`tour-card rise-in${open ? ' open' : ''}`}>
                  <div className="tour-cover">
                    {coverEmojis(details[t.id]).map((e, i) => (
                      <span key={i} className="cover-emoji">{e}</span>
                    ))}
                    <span className="cover-badge">
                      <Icon name="place" size={13} /> {t.attractionCount} obiective
                    </span>
                  </div>

                  <div className="tour-body">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div className="title-large" style={{ fontSize: 19, flex: 1 }}>{t.title}</div>
                      {role === 'guide' && myId != null && t.createdBy === myId ? (
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          onClick={async () => {
                            if (confirmDeleteId !== t.id) {
                              setConfirmDeleteId(t.id);
                              return;
                            }
                            setDeletingId(t.id);
                            try {
                              await ToursApi.remove(t.id);
                              setTours((prev) => prev.filter((x) => x.id !== t.id));
                            } catch (e) {
                              setError(extractErrorMessage(e));
                            } finally {
                              setDeletingId(null);
                              setConfirmDeleteId(null);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 10px',
                            borderRadius: 10,
                            flexShrink: 0,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--error)',
                            background:
                              confirmDeleteId === t.id
                                ? 'color-mix(in srgb, var(--error) 14%, transparent)'
                                : 'transparent',
                            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
                          }}
                          title="Șterge turul (doar autorul)"
                        >
                          <Icon name="delete-outline" size={16} color="var(--error)" />
                          {deletingId === t.id ? 'Se șterge…' : confirmDeleteId === t.id ? 'Sigur?' : 'Șterge'}
                        </button>
                      ) : null}
                    </div>
                    {t.description ? (
                      <p className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
                        {t.description}
                      </p>
                    ) : null}

                    <div className="tour-meta">
                      <span className="meta-chip">
                        <Icon
                          name={t.routingProfile === 'foot' ? 'directions-walk' : 'directions-car'}
                          size={14}
                        />
                        {t.routingProfile === 'foot' ? 'Pe jos' : 'Cu mașina'}
                      </span>
                      {visitTotal != null ? (
                        <span className="meta-chip">
                          <Icon name="timer" size={14} />
                          ~{Math.round(visitTotal / 60)}h de vizitat în total
                        </span>
                      ) : null}
                      <span className="meta-chip">
                        <Icon name="verified" size={14} color="var(--primary)" />
                        Ghid verificat
                      </span>
                    </div>

                    {!open ? (
                      <button type="button" className="tour-open-btn" onClick={() => togglePanel(t.id)}>
                        <Icon name="map" size={17} color="var(--on-primary)" />
                        Deschide pe hartă
                      </button>
                    ) : (
                      <div className="budget-panel rise-in">
                        <div className="budget-title">
                          <Icon name="schedule" size={16} color="var(--primary-strong)" />
                          Cât timp ai la dispoziție?
                        </div>
                        <p className="budget-hint">
                          Cu un buget de timp, algoritmul alege obiectivele care merită și ordinea lor.
                          Fără limită, vizitezi tot turul în ordinea optimă.
                        </p>
                        <div className="budget-chips">
                          {BUDGET_PRESETS.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              className={`budget-chip${budget === p.minutes && customBudget === '' ? ' active' : ''}`}
                              onClick={() => {
                                setBudget(p.minutes);
                                setCustomBudget('');
                              }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <div className="budget-custom">
                          <input
                            type="number"
                            min={15}
                            max={1440}
                            placeholder="Alt buget"
                            value={customBudget}
                            onChange={(e) => setCustomBudget(e.target.value)}
                          />
                          <span className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
                            minute
                          </span>
                        </div>
                        <button
                          type="button"
                          className="budget-go"
                          disabled={busy}
                          onClick={() => buildRoute(t)}
                        >
                          {busy ? (
                            <span className="spinner small" style={{ borderTopColor: 'var(--on-primary)' }} />
                          ) : (
                            <Icon name="auto-awesome" size={17} color="var(--on-primary)" />
                          )}
                          {busy ? 'Se construiește traseul…' : 'Construiește traseul optim'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
