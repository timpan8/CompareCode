import type { Language } from '../core/options'

/**
 * Every visible string lives here. English is the default; the EN/SV switch in
 * the header swaps the whole interface. Adding a language means adding one more
 * object with the same keys — TypeScript enforces that none are missing.
 */
const en = {
  'app.name': 'CompareCode',
  'app.tagline': 'Compare two versions of some code and see exactly what changed.',

  'privacy.badge': 'Nothing leaves your browser',
  'privacy.short': 'Your code is compared on this device and is never sent anywhere.',
  'privacy.offline': 'Download offline version',
  'privacy.offlineRunning': 'You are running the offline copy.',
  'privacy.source': 'Source code',

  'pane.old': 'OLD',
  'pane.oldSide': 'left',
  'pane.new': 'NEW',
  'pane.newSide': 'right',
  'pane.unmarked': 'Not marked yet',
  'pane.pasted': 'pasted {order}',
  'pane.first': '1st',
  'pane.second': '2nd',
  'pane.placeholder': 'Paste code here, or drop a file',
  'pane.lines': '{count} lines',
  'pane.dropHint': 'Drop to load this file',

  'role.question': 'Which version is this?',
  'role.chooseOld': 'This is the OLD code',
  'role.chooseNew': 'This is the NEW code',
  'role.swapped': 'New code always goes on the right.',
  'role.suggested': 'The file dates suggest this order. Swap if that is wrong.',
  'role.undo': 'Undo',
  'role.swap': 'Swap sides',

  'action.compare': 'Compare',
  'action.edit': 'Edit text',
  'action.clear': 'Clear all',
  'action.settings': 'Settings',
  'action.close': 'Close',

  'stats.added': '{count} added',
  'stats.removed': '{count} removed',
  'stats.changed': '{count} changed',
  'stats.identical': '{percent}% identical',
  'stats.noChanges': 'The two versions are identical.',
  'stats.noChangesIgnored': 'Identical, apart from what the settings ignore.',

  'view.split': 'Side by side',
  'view.inline': 'Inline',
  'view.collapse': 'Collapse unchanged',
  'view.expandFold': 'Show {count} unchanged lines',
  'view.narrow': 'Too narrow for two columns — showing the inline view.',

  'options.comparison': 'Comparison',
  'options.ignoreLeadingWhitespace': 'Ignore indentation',
  'options.ignoreTrailingWhitespace': 'Ignore trailing spaces',
  'options.ignoreAllWhitespace': 'Ignore all whitespace',
  'options.ignoreBlankLines': 'Ignore blank lines',
  'options.ignoreCase': 'Ignore upper/lower case',
  'options.display': 'Display',
  'options.wrapLines': 'Wrap long lines',
  'options.showWhitespace': 'Show spaces and tabs',
  'options.tabWidth': 'Tab width',
  'options.palette': 'Colours',
  'options.paletteClassic': 'Red / green',
  'options.paletteColorblind': 'Blue / orange (colour-blind safe)',
  'options.theme': 'Theme',
  'options.themeSystem': 'Follow system',
  'options.themeLight': 'Light',
  'options.themeDark': 'Dark',
  'options.autosave': 'Keep my text in this browser',
  'options.autosaveHelp': 'Stored on this device only, so a closed tab does not lose your work.',

  'copy.new': 'Copy new version',
  'copy.patch': 'Copy as patch',
  'copy.done': 'Copied',
  'copy.failed': 'Could not copy',

  'nav.previous': 'Previous change',
  'nav.next': 'Next change',
  'nav.hint': 'n / p jump between changes',

  'notice.truncated':
    'This comparison was large, so word-level detail was skipped. The line differences are complete.',
  'notice.tooLarge': 'Showing the first {count} rows. Scroll for more.',

  'language.switch': 'Svenska',
  'language.label': 'Language',
} as const

export type TranslationKey = keyof typeof en

const sv: Record<TranslationKey, string> = {
  'app.name': 'CompareCode',
  'app.tagline': 'Jämför två versioner av kod och se exakt vad som ändrats.',

  'privacy.badge': 'Inget lämnar din webbläsare',
  'privacy.short': 'Din kod jämförs på den här datorn och skickas aldrig någonstans.',
  'privacy.offline': 'Ladda ner offlineversion',
  'privacy.offlineRunning': 'Du kör offlinekopian.',
  'privacy.source': 'Källkod',

  'pane.old': 'GAMMAL',
  'pane.oldSide': 'vänster',
  'pane.new': 'NY',
  'pane.newSide': 'höger',
  'pane.unmarked': 'Inte markerad än',
  'pane.pasted': 'inlagd {order}',
  'pane.first': '1:a',
  'pane.second': '2:a',
  'pane.placeholder': 'Klistra in kod här, eller släpp en fil',
  'pane.lines': '{count} rader',
  'pane.dropHint': 'Släpp för att läsa in filen',

  'role.question': 'Vilken version är det här?',
  'role.chooseOld': 'Det här är GAMLA koden',
  'role.chooseNew': 'Det här är NYA koden',
  'role.swapped': 'Ny kod hamnar alltid till höger.',
  'role.suggested': 'Filernas datum tyder på den här ordningen. Byt plats om det blev fel.',
  'role.undo': 'Ångra',
  'role.swap': 'Byt plats',

  'action.compare': 'Jämför',
  'action.edit': 'Ändra text',
  'action.clear': 'Rensa allt',
  'action.settings': 'Inställningar',
  'action.close': 'Stäng',

  'stats.added': '{count} tillagda',
  'stats.removed': '{count} borttagna',
  'stats.changed': '{count} ändrade',
  'stats.identical': '{percent}% lika',
  'stats.noChanges': 'De två versionerna är identiska.',
  'stats.noChangesIgnored': 'Identiska, bortsett från det inställningarna ignorerar.',

  'view.split': 'Sida vid sida',
  'view.inline': 'Inline',
  'view.collapse': 'Fäll ihop oförändrat',
  'view.expandFold': 'Visa {count} oförändrade rader',
  'view.narrow': 'För smalt för två kolumner — visar inline-vyn.',

  'options.comparison': 'Jämförelse',
  'options.ignoreLeadingWhitespace': 'Ignorera indentering',
  'options.ignoreTrailingWhitespace': 'Ignorera blanksteg i radslut',
  'options.ignoreAllWhitespace': 'Ignorera alla blanksteg',
  'options.ignoreBlankLines': 'Ignorera tomma rader',
  'options.ignoreCase': 'Ignorera stora/små bokstäver',
  'options.display': 'Visning',
  'options.wrapLines': 'Bryt långa rader',
  'options.showWhitespace': 'Visa blanksteg och tabbar',
  'options.tabWidth': 'Tabbredd',
  'options.palette': 'Färger',
  'options.paletteClassic': 'Rött / grönt',
  'options.paletteColorblind': 'Blått / orange (färgblindsäkert)',
  'options.theme': 'Tema',
  'options.themeSystem': 'Följ systemet',
  'options.themeLight': 'Ljust',
  'options.themeDark': 'Mörkt',
  'options.autosave': 'Spara min text i den här webbläsaren',
  'options.autosaveHelp': 'Sparas bara på den här datorn, så en stängd flik inte tar med sig arbetet.',

  'copy.new': 'Kopiera nya versionen',
  'copy.patch': 'Kopiera som patch',
  'copy.done': 'Kopierat',
  'copy.failed': 'Kunde inte kopiera',

  'nav.previous': 'Föregående ändring',
  'nav.next': 'Nästa ändring',
  'nav.hint': 'n / p hoppar mellan ändringar',

  'notice.truncated':
    'Jämförelsen var stor, så detaljer på ordnivå hoppades över. Radskillnaderna är kompletta.',
  'notice.tooLarge': 'Visar de första {count} raderna. Skrolla för fler.',

  'language.switch': 'English',
  'language.label': 'Språk',
}

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, sv }

export type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string

export function createTranslate(language: Language): Translate {
  const dictionary = dictionaries[language]

  return (key, values) => {
    const template = dictionary[key]
    if (values === undefined) return template

    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name]
      return value === undefined ? match : String(value)
    })
  }
}

export const OTHER_LANGUAGE: Record<Language, Language> = { en: 'sv', sv: 'en' }
