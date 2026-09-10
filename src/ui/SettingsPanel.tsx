import type { DiffOptions } from '../core/diff'
import type { Palette, ThemePreference, ViewOptions } from '../core/options'
import type { Translate, TranslationKey } from './i18n'

interface SettingsPanelProps {
  diff: DiffOptions
  view: ViewOptions
  t: Translate
  onDiff: (patch: Partial<DiffOptions>) => void
  onView: (patch: Partial<ViewOptions>) => void
}

export function SettingsPanel({ diff, view, t, onDiff, onView }: SettingsPanelProps) {
  const check = (
    label: TranslationKey,
    checked: boolean,
    onChange: (value: boolean) => void,
  ) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange((event.currentTarget as HTMLInputElement).checked)}
      />
      {t(label)}
    </label>
  )

  return (
    <div class="panel" role="dialog" aria-label={t('action.settings')}>
      <h3>{t('options.comparison')}</h3>
      {check('options.ignoreLeadingWhitespace', diff.ignoreLeadingWhitespace, (value) =>
        onDiff({ ignoreLeadingWhitespace: value }),
      )}
      {check('options.ignoreTrailingWhitespace', diff.ignoreTrailingWhitespace, (value) =>
        onDiff({ ignoreTrailingWhitespace: value }),
      )}
      {check('options.ignoreAllWhitespace', diff.ignoreAllWhitespace, (value) =>
        onDiff({ ignoreAllWhitespace: value }),
      )}
      {check('options.ignoreBlankLines', diff.ignoreBlankLines, (value) =>
        onDiff({ ignoreBlankLines: value }),
      )}
      {check('options.ignoreCase', diff.ignoreCase, (value) => onDiff({ ignoreCase: value }))}

      <h3>{t('options.display')}</h3>
      {check('options.wrapLines', view.wrapLines, (value) => onView({ wrapLines: value }))}
      {check('options.showWhitespace', view.showWhitespace, (value) =>
        onView({ showWhitespace: value }),
      )}

      <label>
        {t('options.tabWidth')}
        <input
          type="number"
          min={1}
          max={8}
          value={view.tabWidth}
          onInput={(event) => {
            const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10)
            if (Number.isFinite(parsed)) onView({ tabWidth: Math.min(8, Math.max(1, parsed)) })
          }}
        />
      </label>

      <label>
        {t('options.palette')}
        <select
          value={view.palette}
          onChange={(event) =>
            onView({ palette: (event.currentTarget as HTMLSelectElement).value as Palette })
          }
        >
          <option value="classic">{t('options.paletteClassic')}</option>
          <option value="colorblind">{t('options.paletteColorblind')}</option>
        </select>
      </label>

      <label>
        {t('options.theme')}
        <select
          value={view.theme}
          onChange={(event) =>
            onView({ theme: (event.currentTarget as HTMLSelectElement).value as ThemePreference })
          }
        >
          <option value="system">{t('options.themeSystem')}</option>
          <option value="light">{t('options.themeLight')}</option>
          <option value="dark">{t('options.themeDark')}</option>
        </select>
      </label>

      <h3>{t('options.autosave')}</h3>
      {check('options.autosave', view.autosave, (value) => onView({ autosave: value }))}
      <p class="help">{t('options.autosaveHelp')}</p>
    </div>
  )
}
