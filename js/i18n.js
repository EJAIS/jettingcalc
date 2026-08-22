// i18n.js — EN/DE translations and language helpers
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

const TRANSLATIONS = {
  en: {
    // Header
    'app.subtitle': "Web port of 'Calculate Jetting for Dellorto Carbs v1.5'",

    // Buttons
    'btn.loadDemo':  'Load Demo',
    'btn.reset':     'Reset',
    'btn.darkMode':  'Dark Mode',
    'btn.lightMode': 'Light Mode',

    // Carb type selector
    'carbType.label': 'Carburetor Type',
    'carbType.VHSx':  'VHSx (VHSA / VHSB / VHSC / VHSH)',
    'carbType.PHBH':  'PHBH',
    'carbType.PHBL':  'PHBL',
    'carbType.betaLabel': 'Beta Features',
    'carbType.betaBadge': 'BETA',
    'carbType.phblBetaDisclaimer': 'PHBL support is experimental. The needle-exposure constant (16.3 mm) was measured on a 26 mm PHBL with a D36 needle and AQ atomizer. It is not yet confirmed whether the carburetor-size scaling term applies to PHBL — needle positions for smaller PHBL sizes (20–24 mm) may deviate by up to ~3 mm. Verify against real-world testing.',
    'carbType.phblBetaBanner': '⚠ Beta: PHBL calculations are experimental and not fully verified.',
    'carbType.phbhBetaDisclaimer': 'PHBH support is experimental. Two coupled constants are unverified: the X-type needle length (68 mm in this app; Eurocarb lists 55 mm for part 9477) and the needle-exposure constant (inherited from VHSx). They must be measured together — correcting only one produces worse results. Needle positions may deviate by roughly 4–5 mm.',
    'carbType.phbhBetaBanner': '⚠ Beta: PHBH calculations are experimental and not fully verified.',

    // Setups table
    'section.setups':  'Setups',
    'col.name':        'Name',
    'col.needle':      'Needle',
    'col.clip':        'Clip',
    'col.carbSize':    'Carb Ø',
    'col.needleJet':   'Needle Jet',
    'col.jetType':       'Jet Type',
    'col.jetType.title': 'DP/DQ = VHSA/VHSB carbs · AV/AS = PHBH carbs · AQ = PHBL carbs',
    'col.maxHD':         'Max HD',
    'col.maxHD.tooltip': 'Equivalent main jet at 100 % throttle (WOT).',
    'col.cutaway':       'Cutaway',
    'col.nd':          'ND',
    'col.hd':          'HD',
    'col.actions':     'Actions',
    'setup.select':    '— select —',
    'msg.setupsReset': '{n} setup(s) cleared — needle type not compatible with selected carburetor.',
    'msg.noEmptyRowToDuplicate': 'All 5 rows are in use — reset one first to duplicate into it.',
    'action.resetRow':     'Reset this row',
    'action.duplicateRow': 'Duplicate this row',
    'duplicate.suffix':    ' (Copy)',

    // Charts
    'section.needleProfile': 'Needle Profile',
    'section.carbProfile':   'Carb Profile',
    'chart.needleX': 'Throttle position',
    'chart.needleY': 'Needle diameter (mm)',
    'chart.carbX':   'Throttle position',
    'chart.carbY':   'Equivalent HD',
    'chart.expand':  'Click to expand',

    // Calculation Results
    'section.calcResults': 'Calculation Results',
    'col.throttle':   'Throttle',
    'col.needlePos':  'Needle Pos (mm)',
    'col.needleDiam': 'Needle Ø (mm)',
    'col.hdEquiv':    'HD Equiv',
    'col.overall':    'Overall',
    'calc.extrapolationNote': '* Values above 100 % throttle are extrapolation — the bore is fully open at 100 %, so these points have no tuning significance.',

    // Carburetor cross-section card
    'crosssection.title':       'Carburetor cross-section',
    'crosssection.selectSetup': 'Setup',
    'crosssection.throttle':    'Throttle position',
    'crosssection.needlePos':   'Needle position',
    'crosssection.needleDiam':  'Needle diameter',
    'crosssection.annulus':     'Annulus cross-section',
    'crosssection.bore':        'Bore',
    'crosssection.needleJet':   'Needle jet',
    'crosssection.extrapolationNote': 'Above 100 % — extrapolated range',
    'crosssection.needleClear':   'Needle fully clear of jet at this throttle position',
    'crosssection.gapVisualNote': 'Highlighted line marks the bore (needle jet) diameter — annulus area shown below.',
    'crosssection.disclaimer':    'Schematic visualization for illustrating the calculation logic — not a precise technical drawing.',
    'crosssection.empty':         'Select a setup with a needle to see the cross-section',

    // Cutaway calculation
    'cutaway.label':      'Recommended cutaway',
    'cutaway.ratio':      'Needle-jet/main-jet ratio',
    'cutaway.target':     'target: 0.6',
    'cutaway.closest':    'closest stock slide',
    'cutaway.warning':    '⚠ Ratio far from target — estimate unreliable',
    'cutaway.disclaimer':   'Estimated using an unverified third-party heuristic (M. Forrest, dragonfly75.com). The 0.6 target ratio is not an official Dellorto specification and has no published derivation — treat this as a rough starting point, not a precise calculation. Confirm with real-world testing.',
    'cutaway.colWarning':   'Ratio ({ratio}) is far from the 0.6 target — this estimate may be unreliable. See {section} for details.',

    // Custom Needles
    'section.customNeedles': 'Custom Needles',
    'field.carbType': 'Carb Type *',
    'field.type': 'Type *',
    'field.A':    'ØA – shank Ø *',
    'field.B':    'ØB – tip Ø *',
    'field.C':    'C – from tip *',
    'field.D':    'ØD – junction Ø',
    'field.E':    'E – from tip',
    'field.F':    'F – cyl. tip',
    'field.needleLengthType': 'Needle length type',
    'field.needleLengthType.K': 'K-type (73.5mm)',
    'field.needleLengthType.U': 'U-type (68.0mm)',
    'placeholder.type': 'e.g. K99',
    'placeholder.mm':   'mm',
    'placeholder.opt':  'opt.',
    'btn.saveNeedle':   'Save locally',
    'btn.submitNeedle': 'Submit to developer',
    'needle.savedTitle': 'Saved custom needles (marked with * in dropdown)',
    'needle.empty':      'No custom needles saved.',

    // Field reference
    'ref.toggle':    'Field reference',
    'ref.col.param': 'Parameter',
    'ref.col.desc':  'Description',
    'ref.col.req':   'Required',
    'ref.type.desc': 'Needle code (e.g. K99, U26, X7)',
    'ref.A.desc':    'Shank diameter — cylindrical section (mm)',
    'ref.B.desc':    'Tip diameter — minimum Ø at needle tip (mm)',
    'ref.C.desc':    'Distance from tip to start of Taper 1 (mm)',
    'ref.D.desc':    'Diameter at junction between Taper 1 & 2 (mm)',
    'ref.E.desc':    'Distance from tip to start of Taper 2 (mm)',
    'ref.F.desc':    'Length of cylindrical section at tip (mm)',
    'ref.note':      'ØD, E and F are only required for multi-taper needles. Needle type prefix determines total length: K = 73.5 mm, U = X = 68 mm, D = 52 mm. Exception: X37 = 56.2 mm.',

    // Validation
    'err.carbTypeRequired': 'Carb Type is required.',
    'err.typeRequired': 'Type is required.',
    'err.typeExists':   'Type already exists in the database.',
    'err.abcRequired':  'ØA, ØB and C are required.',
    'err.deIncomplete': 'ØD and E must both be filled or both empty.',
    'err.fRequiresDe':  'F requires ØD and E to be set.',
    'err.lengthTypeRequired': 'Needle length type (K/U) is required for VHSx.',

    // Footer
    'footer.disclaimer': 'This tool is provided for informational purposes only. Calculations may contain errors — always verify jetting settings with a qualified mechanic. The author accepts no liability for engine damage, personal injury, or any other loss arising from the use of this software.',
    'footer.webport': 'Web port:',
    'footer.gsfNote':      'This JettingCalc focuses on Dellorto carburetors used on classic geared scooters. Please support and use the {link}!',
    'footer.gsfLinkText':  'German Scooter Forum',

    // Confirm dialogs and empty states
    'msg.noActiveSetups':      'No active setups to display.',
    'confirm.loadDemo':        'Load demo setups? This will overwrite your current data.',
    'confirm.resetAll':        'Reset all setups to empty?',
    'confirm.resetRow':        'Reset "{name}"?',
    'confirm.overwriteNeedle': '"${type}" already exists as a custom needle. Overwrite?',
    'confirm.deleteNeedle':    'Delete custom needle "${type}"?',

    // SVG needle schematic labels
    'svg.shank':         'Shank',
    'svg.taper1':        'Taper 1',
    'svg.taper2':        'Taper 2',
    'svg.cylTip':        'Cyl. tip',
    'svg.fromTipMm':     'from tip (mm)',
    'svg.fromTipOpt':    'from tip (opt.)',
    'svg.cylTipOpt':     'cyl. tip (opt.)',
    'svg.required':      'Required',
    'svg.optionalMulti': 'Optional (multi-taper only)',
    'svg.title':         'Dellorto needle schematic — measurement points ØA, ØB, C, ØD, E, F',
    'svg.desc':          'Cross-section of a full-featured Dellorto needle showing all six official measurement parameters',
  },

  de: {
    // Header
    'app.subtitle': "Web-Port von 'Calculate Jetting for Dellorto Carbs v1.5'",

    // Buttons
    'btn.loadDemo':  'Demo laden',
    'btn.reset':     'Zurücksetzen',
    'btn.darkMode':  'Dunkelmodus',
    'btn.lightMode': 'Hellmodus',

    // Carb type selector
    'carbType.label': 'Vergaser-Typ',
    'carbType.VHSx':  'VHSx (VHSA / VHSB / VHSC / VHSH)',
    'carbType.PHBH':  'PHBH',
    'carbType.PHBL':  'PHBL',
    'carbType.betaLabel': 'Beta-Features',
    'carbType.betaBadge': 'BETA',
    'carbType.phblBetaDisclaimer': 'Die PHBL-Unterstützung ist experimentell. Die Konstante für die Nadel-Exposition (16,3 mm) wurde an einem 26-mm-PHBL mit D36-Nadel und AQ-Mischrohr gemessen. Ob der Vergasergrößen-Term auch für PHBL gilt, ist noch nicht bestätigt — bei kleineren PHBL-Größen (20–24 mm) kann die Nadelposition um bis zu ~3 mm abweichen. Durch Praxistests bestätigen.',
    'carbType.phblBetaBanner': '⚠ Beta: PHBL-Berechnungen sind experimentell und nicht vollständig verifiziert.',
    'carbType.phbhBetaDisclaimer': 'Die PHBH-Unterstützung ist experimentell. Zwei gekoppelte Konstanten sind unverifiziert: die Länge der X-Nadel (68 mm in dieser App; Eurocarb nennt 55 mm für Teilenr. 9477) und die Konstante für die Nadel-Exposition (von VHSx übernommen). Beide müssen gemeinsam gemessen werden — eine einzelne Korrektur verschlechtert das Ergebnis. Nadelpositionen können um ca. 4–5 mm abweichen.',
    'carbType.phbhBetaBanner': '⚠ Beta: PHBH-Berechnungen sind experimentell und nicht vollständig verifiziert.',

    // Setups table
    'section.setups':  'Setups',
    'col.name':        'Name',
    'col.needle':      'Nadel',
    'col.clip':        'Clip',
    'col.carbSize':    'Vergaser Ø',
    'col.needleJet':   'Düse',
    'col.jetType':       'Düs. Typ',
    'col.jetType.title': 'DP/DQ = VHSA/VHSB Vergaser · AV/AS = PHBH Vergaser · AQ = PHBL Vergaser',
    'col.maxHD':         'Max HD',
    'col.maxHD.tooltip': 'Äquivalente Hauptdüse bei 100 % Gasstellung (Vollgas).',
    'col.cutaway':       'Cutaway',
    'col.nd':          'ND',
    'col.hd':          'HD',
    'col.actions':     'Aktionen',
    'setup.select':    '— wählen —',
    'msg.setupsReset': '{n} Setup(s) zurückgesetzt – Nadeltyp nicht kompatibel mit gewähltem Vergaser.',
    'msg.noEmptyRowToDuplicate': 'Alle 5 Zeilen sind belegt — bitte zuerst eine Zeile zurücksetzen, um dorthin zu duplizieren.',
    'action.resetRow':     'Diese Zeile zurücksetzen',
    'action.duplicateRow': 'Diese Zeile duplizieren',
    'duplicate.suffix':    ' (Kopie)',

    // Charts
    'section.needleProfile': 'Nadelprofil',
    'section.carbProfile':   'Vergaserprofil',
    'chart.needleX': 'Gasstellung',
    'chart.needleY': 'Nadeldurchmesser (mm)',
    'chart.carbX':   'Gasstellung',
    'chart.carbY':   'Äquivalente HD',
    'chart.expand':  'Zum Vergrößern klicken',

    // Calculation Results
    'section.calcResults': 'Berechnungsergebnisse',
    'col.throttle':   'Gas',
    'col.needlePos':  'Nadelpos (mm)',
    'col.needleDiam': 'Nadel Ø (mm)',
    'col.hdEquiv':    'HD Äquiv.',
    'col.overall':    'Gesamt',
    'calc.extrapolationNote': '* Werte über 100 % Gasstellung sind Extrapolation — die Bohrung ist bei 100 % vollständig geöffnet, diese Punkte haben keine Abstimmungsaussage.',

    // Carburetor cross-section card
    'crosssection.title':       'Vergaser-Querschnitt',
    'crosssection.selectSetup': 'Setup',
    'crosssection.throttle':    'Gasstellung',
    'crosssection.needlePos':   'Nadelposition',
    'crosssection.needleDiam':  'Nadeldurchmesser',
    'crosssection.annulus':     'Ringspalt-Querschnitt',
    'crosssection.bore':        'Bohrung',
    'crosssection.needleJet':   'Mischrohr',
    'crosssection.extrapolationNote': 'Über 100 % — extrapolierter Bereich',
    'crosssection.needleClear':   'Nadel vollständig aus Mischrohr ausgefahren bei dieser Gasstellung',
    'crosssection.gapVisualNote': 'Hervorgehobene Linie markiert den Mischrohrdurchmesser — Ringspalt-Querschnitt siehe unten.',
    'crosssection.disclaimer':    'Schematische Visualisierung zur Veranschaulichung der Berechnungslogik — kein technischer Anspruch auf Genauigkeit.',
    'crosssection.empty':         'Setup mit Nadel auswählen, um den Querschnitt zu sehen',

    // Cutaway calculation
    'cutaway.label':      'Empfohlener Cutaway',
    'cutaway.ratio':      'Verhältnis Mischrohr/Hauptdüse',
    'cutaway.target':     'Ziel: 0.6',
    'cutaway.closest':    'nächste Serienscheibe',
    'cutaway.warning':    '⚠ Verhältnis weit vom Zielwert entfernt — Schätzung unzuverlässig',
    'cutaway.disclaimer':   'Geschätzt anhand einer nicht verifizierten Drittquellen-Heuristik (M. Forrest, dragonfly75.com). Das Zielverhältnis 0.6 ist keine offizielle Dellorto-Spezifikation und hat keine veröffentlichte Herleitung — als groben Anhaltspunkt verstehen, nicht als präzise Berechnung. Mit Praxistests bestätigen.',
    'cutaway.colWarning':   'Verhältnis ({ratio}) liegt weit vom Zielwert 0.6 entfernt — diese Schätzung kann unzuverlässig sein. Details siehe {section}.',

    // Custom Needles
    'section.customNeedles': 'Eigene Nadeln',
    'field.carbType': 'Vergaser-Typ *',
    'field.type': 'Typ *',
    'field.A':    'ØA – Schaft Ø *',
    'field.B':    'ØB – Spitzen Ø *',
    'field.C':    'C – von Spitze *',
    'field.D':    'ØD – Übergang Ø',
    'field.E':    'E – von Spitze',
    'field.F':    'F – zyl. Spitze',
    'field.needleLengthType': 'Nadellänge-Typ',
    'field.needleLengthType.K': 'K-Typ (73,5mm)',
    'field.needleLengthType.U': 'U-Typ (68,0mm)',
    'placeholder.type': 'z.B. K99',
    'placeholder.mm':   'mm',
    'placeholder.opt':  'opt.',
    'btn.saveNeedle':   'Lokal speichern',
    'btn.submitNeedle': 'An Entwickler senden',
    'needle.savedTitle': 'Gespeicherte Nadeln (mit * im Dropdown)',
    'needle.empty':      'Keine eigenen Nadeln gespeichert.',

    // Field reference
    'ref.toggle':    'Feldreferenz',
    'ref.col.param': 'Parameter',
    'ref.col.desc':  'Beschreibung',
    'ref.col.req':   'Pflicht',
    'ref.type.desc': 'Nadelcode (z.B. K99, U26, X7)',
    'ref.A.desc':    'Schaftdurchmesser — zylindrischer Abschnitt (mm)',
    'ref.B.desc':    'Spitzendurchmesser — minimaler Ø an der Nadelspitze (mm)',
    'ref.C.desc':    'Abstand von Spitze zu Beginn Taper 1 (mm)',
    'ref.D.desc':    'Durchmesser am Übergang zwischen Taper 1 & 2 (mm)',
    'ref.E.desc':    'Abstand von Spitze zu Beginn Taper 2 (mm)',
    'ref.F.desc':    'Länge des zylindrischen Abschnitts an der Spitze (mm)',
    'ref.note':      'ØD, E und F sind nur für Mehrkonus-Nadeln erforderlich. Das Typkürzel bestimmt die Gesamtlänge: K = 73,5 mm, U = X = 68 mm, D = 52 mm. Ausnahme: X37 = 56,2 mm.',

    // Validation
    'err.carbTypeRequired': 'Vergaser-Typ ist erforderlich.',
    'err.typeRequired': 'Typ ist erforderlich.',
    'err.typeExists':   'Typ bereits in der Datenbank vorhanden.',
    'err.abcRequired':  'ØA, ØB und C sind Pflichtfelder.',
    'err.deIncomplete': 'ØD und E müssen beide ausgefüllt oder beide leer sein.',
    'err.fRequiresDe':  'F erfordert ØD und E.',
    'err.lengthTypeRequired': 'Nadellänge-Typ (K/U) ist für VHSx erforderlich.',

    // Footer
    'footer.disclaimer': 'Dieses Tool dient ausschließlich zu Informationszwecken. Berechnungen können Fehler enthalten — Einstellungen stets von einem Fachmann überprüfen lassen. Der Autor haftet nicht für Motorschäden, Personenschäden oder sonstige Verluste, die aus der Nutzung dieser Software entstehen.',
    'footer.webport': 'Web-Port:',
    'footer.gsfNote':      'Dieser JettingCalc fokussiert sich auf Dellorto-Vergaser, welche auf klassischen Schaltrollern zum Einsatz kommen. Bitte unterstützt und nutzt das {link}!',
    'footer.gsfLinkText':  'German Scooter Forum',

    // Confirm dialogs and empty states
    'msg.noActiveSetups':      'Keine aktiven Setups vorhanden.',
    'confirm.loadDemo':        'Demo-Setups laden? Aktuelle Daten werden überschrieben.',
    'confirm.resetAll':        'Alle Setups zurücksetzen?',
    'confirm.resetRow':        '„{name}" zurücksetzen?',
    'confirm.overwriteNeedle': '"${type}" existiert bereits als eigene Nadel. Überschreiben?',
    'confirm.deleteNeedle':    'Eigene Nadel "${type}" löschen?',

    // SVG needle schematic labels
    'svg.shank':         'Schaft',
    'svg.taper1':        'Konus 1',
    'svg.taper2':        'Konus 2',
    'svg.cylTip':        'Zyl. Spitze',
    'svg.fromTipMm':     'von Spitze (mm)',
    'svg.fromTipOpt':    'von Spitze (opt.)',
    'svg.cylTipOpt':     'zyl. Spitze (opt.)',
    'svg.required':      'Pflichtfeld',
    'svg.optionalMulti': 'Optional (nur Mehrkonus-Nadeln)',
    'svg.title':         'Dellorto Nadel-Schema — Messpunkte ØA, ØB, C, ØD, E, F',
    'svg.desc':          'Querschnitt einer Dellorto-Nadel mit allen sechs offiziellen Messparametern',
  },
};

let currentLang = localStorage.getItem('dellorto_lang') || 'en';

export function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS['en'][key] ?? key;
}

export function getLang() { return currentLang; }

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('dellorto_lang', lang);
  document.documentElement.lang = lang;
  applyTranslations();
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
    el.dataset.tooltip = t(el.getAttribute('data-i18n-tooltip'));
  });
  const gsfNote = document.getElementById('footer-gsf-note');
  if (gsfNote) {
    const gsfLink = `<a href="https://www.germanscooterforum.de/" target="_blank" rel="noopener noreferrer">${t('footer.gsfLinkText')}</a>`;
    gsfNote.innerHTML = t('footer.gsfNote').replace('{link}', gsfLink);
  }
  const btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = currentLang === 'en' ? 'DE' : 'EN';
}
