import React from 'react';

// Skill Eliminasi: terbuka setelah 3 bidak finish, dipakai sebelum melempar dadu
export default function SkillControls({ me, room, canAct, skillTargeting, actions }) {
  const finished = (room.pawns?.[me?.id] || []).filter(v => v === 44).length;
  if (!canAct || finished < 3 || !(me?.skillPoints > 0)) return null;

  return (
    <section className="action-card card" aria-label="Skill Eliminasi">
      <div className="action-card__head">
        <span className="action-card__icon" aria-hidden="true">🎯</span>
        <div>
          <strong>Skill Eliminasi siap</strong>
          <p className="muted">
            Poin skill {me.skillPoints}x{me.accumulatedThisTurn ? ', sudah dilipatgandakan giliran ini' : ''}.
          </p>
        </div>
      </div>
      <div className="action-card__buttons">
        <button type="button" className="btn btn--primary" aria-pressed={skillTargeting} onClick={actions.toggleSkillTargeting}>
          {skillTargeting ? 'Batal pilih target' : 'Pakai skill'}
        </button>
        {!skillTargeting && !me.accumulatedThisTurn && (
          <button type="button" className="btn btn--secondary" onClick={actions.accumulateSkill}>
            Simpan (lipat 2x)
          </button>
        )}
      </div>
      {skillTargeting && <p className="action-card__hint">Ketuk bidak lawan di lintasan untuk memulangkannya ke markas.</p>}
    </section>
  );
}
