// ============================================================
// PHASE 21 — COMPOSANT : CahierCalendar
// Vue calendrier mensuel des séances
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEntreesByMois } from '../../services/cahierTextesService';
import { TYPE_CONTENU_CONFIG } from '../../types/cahierTextes.types';
import type { EntreeCahier } from '../../types/cahierTextes.types';
import '../../styles/CahierCalendar.css';

// ─── Types ───────────────────────────────────────────────────
interface CahierCalendarProps {
  cahierId: string;
}

// ─── Utilitaires date ────────────────────────────────────────
const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  entrees: EntreeCahier[];
}

// Construit la grille d'un mois (42 cases, lundi = premier)
const buildCalendarGrid = (year: number, month: number, entrees: EntreeCahier[]): CalendarDay[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Lundi = 0, dimanche = 6
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const today = new Date();
  const days: CalendarDay[] = [];

  // Jours du mois précédent
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({ date, isCurrentMonth: false, isToday: false, entrees: [] });
  }

  // Jours du mois courant
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const isToday = date.toDateString() === today.toDateString();

    // Entrées de ce jour
    const dayEntrees = entrees.filter(e => {
      const entreeDate = e.date.toDate();
      return entreeDate.getFullYear() === year &&
             entreeDate.getMonth() === month &&
             entreeDate.getDate() === d;
    });

    days.push({ date, isCurrentMonth: true, isToday, entrees: dayEntrees });
  }

  // Compléter à 42 cases
  let d = 1;
  while (days.length < 42) {
    const date = new Date(year, month + 1, d++);
    days.push({ date, isCurrentMonth: false, isToday: false, entrees: [] });
  }

  return days;
};

// ─── Composant principal ─────────────────────────────────────
const CahierCalendar: React.FC<CahierCalendarProps> = ({ cahierId }) => {
  const navigate = useNavigate();
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  // Charger les entrées du mois courant
  useEffect(() => {
    const fetchEntrees = async () => {
      setLoading(true);
      try {
        const data = await getEntreesByMois(cahierId, currentYear, currentMonth);
        setEntrees(data);
      } catch (err) {
        console.error('Erreur chargement entrées calendrier:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntrees();
  }, [cahierId, currentYear, currentMonth]);

  const grid = buildCalendarGrid(currentYear, currentMonth, entrees);

  // Navigation mois
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
  };

  // Clic sur un jour
  const handleDayClick = (day: CalendarDay, e: React.MouseEvent) => {
    if (!day.isCurrentMonth || day.entrees.length === 0) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopupPos({ x: rect.left, y: rect.bottom + window.scrollY + 8 });
    setSelectedDay(day);
  };

  return (
    <div className="cahier-calendar" onClick={() => setSelectedDay(null)}>
      {/* Navigation */}
      <div className="calendar-nav">
        <button className="calendar-nav-btn" onClick={prevMonth} aria-label="Mois précédent">
          ‹
        </button>
        <span className="calendar-nav-title">
          {MOIS_NOMS[currentMonth]} {currentYear}
          {loading && ' ...'}
        </span>
        <button className="calendar-nav-btn" onClick={nextMonth} aria-label="Mois suivant">
          ›
        </button>
      </div>

      {/* En-têtes jours */}
      <div className="calendar-weekdays">
        {JOURS_SEMAINE.map(j => (
          <div key={j} className="calendar-weekday">{j}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="calendar-grid" onClick={e => e.stopPropagation()}>
        {grid.map((day, idx) => (
          <div
            key={idx}
            className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${selectedDay?.date.toDateString() === day.date.toDateString() ? 'selected' : ''}`}
            onClick={e => handleDayClick(day, e)}
          >
            <div className="calendar-day-num">{day.date.getDate()}</div>
            <div className="calendar-day-events">
              {day.entrees.slice(0, 3).map(e => {
                const cfg = TYPE_CONTENU_CONFIG[e.typeContenu];
                return (
                  <div
                    key={e.id}
                    className="calendar-event-dot"
                    style={{ background: cfg.color }}
                    title={e.chapitre}
                  >
                    {cfg.emoji} {e.chapitre.substring(0, 12)}
                  </div>
                );
              })}
              {day.entrees.length > 3 && (
                <div className="calendar-more">+{day.entrees.length - 3}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="calendar-legend">
        {Object.entries(TYPE_CONTENU_CONFIG).slice(0, 5).map(([key, cfg]) => (
          <div key={key} className="legend-item">
            <div className="legend-dot" style={{ background: cfg.color }} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Popup séances du jour sélectionné */}
      {selectedDay && selectedDay.entrees.length > 0 && (
        <div
          className="calendar-day-popup"
          style={{ top: popupPos.y, left: Math.min(popupPos.x, window.innerWidth - 300) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="calendar-day-popup-title">
            📅 {selectedDay.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {selectedDay.entrees.map(e => {
            const cfg = TYPE_CONTENU_CONFIG[e.typeContenu];
            return (
              <div
                key={e.id}
                className="calendar-popup-entree"
                onClick={() => navigate(`/prof/cahiers/${cahierId}/modifier/${e.id}`)}
              >
                <span className="calendar-popup-entree-type">{cfg.emoji}</span>
                <div className="calendar-popup-entree-info">
                  <div className="calendar-popup-entree-chapitre">{e.chapitre}</div>
                  {e.heureDebut && (
                    <div className="calendar-popup-entree-heure">
                      {e.heureDebut}{e.heureFin ? ` → ${e.heureFin}` : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CahierCalendar;
