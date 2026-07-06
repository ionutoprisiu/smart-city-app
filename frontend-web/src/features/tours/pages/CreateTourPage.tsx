import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StackHeader } from '@app/StackHeader';
import { AppButton } from '@shared/components/AppButton';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { extractErrorMessage } from '@shared/api/errors';
import { VisitCityApi } from '@features/visit-city/api/visitCityApi';
import { Attraction, RoutingProfile, categoryIcon, categoryLabel } from '@features/visit-city/types';
import { ToursApi } from '../api/toursApi';

const DEFAULT_DURATION = 15;
const CATALOG_LIMIT = 60;

const fmtHours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
};

export const CreateTourPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [profile, setProfile] = useState<RoutingProfile>('foot');

  const [selected, setSelected] = useState<number[]>([]);
  const [durations, setDurations] = useState<Record<number, number>>({});

  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    VisitCityApi.getAttractions()
      .then(setAttractions)
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false));
    titleRef.current?.focus();
  }, []);

  // Catalog list: search-filtered, selected pushed to the top, then by score.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? attractions.filter((a) => a.name.toLowerCase().includes(q)) : attractions;
    return [...base].sort((a, b) => {
      const aSel = selected.includes(a.id);
      const bSel = selected.includes(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return b.importanceScore - a.importanceScore;
    });
  }, [attractions, search, selected]);

  const toggle = (id: number) => {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      setDurations((d) => ({ ...d, [id]: d[id] ?? DEFAULT_DURATION }));
      return [...prev, id];
    });
  };

  const setDuration = (id: number, value: number) =>
    setDurations((d) => ({ ...d, [id]: Math.max(5, Math.min(180, Math.round(value))) }));

  const totalVisit = selected.reduce((s, id) => s + (durations[id] ?? DEFAULT_DURATION), 0);
  const hasTitle = title.trim().length > 0;
  const canSubmit = hasTitle && selected.length >= 1 && !submitting;

  const disabledReason = !hasTitle
    ? 'Adaugă un titlu'
    : selected.length === 0
      ? 'Alege cel puțin un obiectiv'
      : null;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await ToursApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        routingProfile: profile,
        attractionIds: selected,
        visitDurationsMinutes: selected.map((id) => durations[id] ?? DEFAULT_DURATION),
      });
      navigate('/tours');
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <StackHeader title="Creează tur" />
      <div className="app-content" style={{ overflowY: 'auto' }}>
        <div className="ct-scroll">
          {error ? (
            <div
              className="body-small rise-in"
              style={{
                color: 'var(--error)',
                background: 'var(--error-container)',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 16,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          ) : null}

          {/* --- Detalii --- */}
          <div className="ct-card">
            <div className="ct-section-title">
              <Icon name="edit-note" size={20} color="var(--primary-strong)" />
              Detalii tur
            </div>
            <label className="ct-field">
              <Icon name="title" size={20} className="ct-field-icon" />
              <input
                ref={titleRef}
                placeholder="Titlu — ex. Cluj-ul istoric într-o zi"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="ct-field" style={{ marginTop: 10 }}>
              <Icon name="notes" size={20} className="ct-field-icon" />
              <textarea
                placeholder="Descriere (opțional) — ce cuprinde turul"
                value={description}
                maxLength={1000}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="segmented" style={{ marginTop: 12 }}>
              <button
                type="button"
                className={`segment${profile === 'foot' ? ' active' : ''}`}
                onClick={() => setProfile('foot')}
              >
                <Icon name="directions-walk" size={16} /> Pe jos
              </button>
              <button
                type="button"
                className={`segment${profile === 'driving' ? ' active' : ''}`}
                onClick={() => setProfile('driving')}
              >
                <Icon name="directions-car" size={16} /> Cu mașina
              </button>
            </div>
          </div>

          {/* --- Obiective --- */}
          <div className="ct-section-title" style={{ marginTop: 24 }}>
            <Icon name="place" size={20} color="var(--primary-strong)" />
            Obiective candidate
            {selected.length > 0 ? (
              <span className="ct-badge">
                <Icon name="check-circle" size={13} color="var(--primary-strong)" />
                {selected.length} · ~{fmtHours(totalVisit)}
              </span>
            ) : null}
          </div>
          <p className="body-small" style={{ color: 'var(--on-surface-variant)', margin: '-4px 2px 12px' }}>
            Alege mai multe obiective decât încap într-o vizită — algoritmul selectează ce merită
            după bugetul de timp al fiecărui utilizator. Setează cât durează vizita la fiecare.
          </p>

          <div className="ct-search">
            <Icon name="search" size={19} color="var(--primary)" />
            <input
              placeholder="Caută în catalog…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <Spinner size="medium" style={{ margin: '28px auto' }} />
          ) : filtered.length === 0 ? (
            <div className="body-medium" style={{ color: 'var(--on-surface-variant)', textAlign: 'center', padding: '28px 0' }}>
              Niciun obiectiv găsit pentru „{search}”.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
              {filtered.slice(0, CATALOG_LIMIT).map((a) => {
                const isSel = selected.includes(a.id);
                const dur = durations[a.id] ?? DEFAULT_DURATION;
                return (
                  <div key={a.id} className={`ct-row${isSel ? ' selected' : ''}`}>
                    <button type="button" className="ct-row-main" onClick={() => toggle(a.id)}>
                      <span className="ct-emoji">{categoryIcon(a.category)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          className="title-small"
                          style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {a.name}
                        </span>
                        <span className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
                          {categoryLabel(a.category)}
                          {a.importanceScore > 0 ? ` · ★ ${a.importanceScore.toFixed(1)}` : ''}
                        </span>
                      </span>
                      <span className={`ct-check${isSel ? ' on' : ''}`}>
                        <Icon
                          name={isSel ? 'check' : 'add'}
                          size={19}
                          color={isSel ? 'var(--on-primary)' : 'var(--on-surface-variant)'}
                        />
                      </span>
                    </button>
                    {isSel ? (
                      <div className="ct-duration">
                        <span className="ct-dur-label">
                          <Icon name="timer" size={15} /> Durata vizitei
                        </span>
                        <span className="ct-stepper">
                          <button type="button" onClick={() => setDuration(a.id, dur - 5)} aria-label="Scade">−</button>
                          <span className="ct-dur-val">{dur} min</span>
                          <button type="button" onClick={() => setDuration(a.id, dur + 5)} aria-label="Crește">+</button>
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky publish bar with helper */}
      <div className="ct-footer">
        <div className="ct-footer-inner">
          <AppButton
            label={submitting ? 'Se publică…' : `Publică turul${selected.length ? ` (${selected.length})` : ''}`}
            iconName="publish"
            disabled={!canSubmit}
            onPress={submit}
          />
          {disabledReason ? (
            <div className="ct-footer-hint">
              <Icon name="info-outline" size={14} />
              {disabledReason} pentru a publica
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
