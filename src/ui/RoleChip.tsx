import type { Translate } from './i18n'

interface RoleChipProps {
  t: Translate
  onChoose: (role: 'old' | 'new') => void
}

/**
 * The question that makes this tool different: as soon as the first text lands in
 * an empty pane, it asks which version it is. The second text never gets asked —
 * with two documents the answer is already decided.
 */
export function RoleChip({ t, onChoose }: RoleChipProps) {
  return (
    <div class="role-ask" role="group" aria-label={t('role.question')}>
      <strong>{t('role.question')}</strong>
      <span class="grow" />
      <button type="button" class="button is-old" onClick={() => onChoose('old')}>
        {t('role.chooseOld')}
      </button>
      <button type="button" class="button is-new" onClick={() => onChoose('new')}>
        {t('role.chooseNew')}
      </button>
    </div>
  )
}
