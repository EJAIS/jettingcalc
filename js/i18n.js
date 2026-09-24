// i18n.js — EN/DE translations and language helpers
// Copyright (C) 2014 GUE — GPL v2.0

export const TRANSLATIONS = {
  en: {
    // Header
    'app.subtitle': "Evolved web port of 'Calculate Jetting for Dellorto Carbs v1.5'",

    // Buttons
    'btn.loadDemo':  'Load Demo',
    'btn.reset':     'Reset',
    'btn.darkMode':  'Dark Mode',
    'btn.lightMode': 'Light Mode',
    'btn.share':     'Share',
    'btn.copyLink':  'Copy link',
    'btn.copied':    'Copied!',
    'btn.close':     'Close',
    'btn.undo':      'Undo',
    'btn.updateNow': 'Update now',
    'btn.install':   'Install App',

    // Carb type selector
    'carbType.label': 'Carburetor Type',
    'carbType.VHSx':  'VHSx (VHSA / VHSB / VHSC / VHSH)',
    'carbType.PHBH':  'PHBH',
    'carbType.PHBL':  'PHBL',
    'carbType.betaLabel': 'Beta Features',
    'carbType.betaBadge': 'BETA',
    'carbType.phblBetaDisclaimer': 'PHBL support is experimental. The needle-exposure constant (16.3 mm) was measured on a 26 mm PHBL with a D36 needle and AQ atomizer. It is not yet confirmed whether the carburetor-size scaling term applies to PHBL — needle positions for smaller PHBL sizes (20–24 mm) may deviate by up to ~3 mm. Verify against real-world testing.',
    'carbType.phblBetaBanner': '⚠ Beta: PHBL calculations are experimental and not fully verified.',
    'carbType.phbhBetaDisclaimer': 'PHBH support is experimental. The needle length (55 mm) and needle-exposure constant (23.8 mm) were measured together on a 30 mm PHBH with an X2 needle and AS266 atomizer. It is not yet confirmed whether the carburetor-size scaling term applies equally to other PHBH bore sizes — needle positions for smaller/larger PHBH sizes may deviate. Verify against real-world testing.',
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
    'msg.customLengthMigrated': 'Corrected the total length of {n} custom needle(s): {needles}. Idle positions for these needles have changed.',
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
    'field.clips': 'Clip positions',
    'field.needleLengthType': 'Needle length type',
    'field.needleLengthType.K': 'K-type (73.5 mm)',
    'field.needleLengthType.U': 'U-type (68.0 mm)',
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
    'ref.note':      'ØD, E and F are only required for multi-taper needles. The total length follows from the carb type: VHSx K-type = 73.5 mm, VHSx U-type = 68.0 mm, PHBH = 55.0 mm, PHBL = 52.0 mm.',

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

    // Share links
    'share.title':     'Share setups',
    'share.intro':     'This creates a link that encodes your setups and carburetor type. Nothing is uploaded — the data lives entirely in the link itself.',
    'share.linkLabel': 'Share link',
    'err.share.noActiveSetups': 'No setup has a needle selected yet — choose at least one needle before sharing.',
    'err.share.customNeedle':   "Can't share — {setups} use custom needle(s) not in the built-in database: {needles}. Only built-in needles can be shared.",
    'msg.shareLoaded':          'Shared setups loaded.',
    'msg.shareFieldsIgnored':   '{n} field(s) in the shared link were invalid and were skipped.',
    'msg.shareInvalid':         'This share link is invalid or corrupted.',
    'msg.shareVersion':         "This share link was created with a newer version of this app and can't be loaded.",
    'msg.shareOfflineStaleWarning': 'This link may have been created with a newer needle database — reconnect and reload to make sure your values are current.',

    // Service worker updates
    'banner.updateAvailable': 'A new version of this app is available.',

    // Install App (PWA)
    'install.iosDialogTitle': 'Install this app',
    'install.iosDialogSteps': "Tap the Share icon in Safari's toolbar, then choose \"Add to Home Screen\".",

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

    // View tabs
    'view.nav.label': 'View',
    'view.calc':      'Calculator',
    'view.catalog':   'Needle catalog',

    // Needle catalog
    'catalog.count':              '{n} of {total} needles',
    'catalog.filter.label':       'Filter',
    'catalog.filter.all':         'All',
    'catalog.filter.series':      '{s} series',
    'catalog.filter.tapers':      '{n}-taper',
    'catalog.search.label':       'Search needle',
    'catalog.search.placeholder': 'Search needle, e.g. K98',
    'catalog.usedOnly':           'My setups only',
    'catalog.usedBy':             'Used in setup {names}',
    'catalog.sortBy':             'Sort by {col}',
    'catalog.badge.custom':       'custom',
    'catalog.clipsDefault.tooltip': 'Series default, not verified per needle',
    'catalog.footnote':           'Values in mm. * = series default clip count, not verified per needle. Coloured dots = used in a setup.',
    'catalog.empty':              'No needles match these filters.',
    'catalog.legend.show':        'Show dimension key',
    'catalog.legend.hide':        'Hide dimension key',
    'catalog.legend.note':        'All lengths in mm, measured from the needle tip. Single-taper needles only have ØA, ØB and C; two-taper needles add ØD and E, three-taper needles add F.',
    'catalog.col.name':   'Needle',
    'catalog.col.tapers': 'Tapers',
    'catalog.col.A':      'ØA',
    'catalog.col.B':      'ØB',
    'catalog.col.C':      'C',
    'catalog.col.D':      'ØD',
    'catalog.col.E':      'E',
    'catalog.col.F':      'F',
    'catalog.col.clips':  'Clips',
    'catalog.col.length': 'Length',
  },

  de: {
    // Header
    'app.subtitle': "Evolved Web-Port von 'Calculate Jetting for Dellorto Carbs v1.5'",

    // Buttons
    'btn.loadDemo':  'Demo laden',
    'btn.reset':     'Zurücksetzen',
    'btn.darkMode':  'Dunkelmodus',
    'btn.lightMode': 'Hellmodus',
    'btn.share':     'Teilen',
    'btn.copyLink':  'Link kopieren',
    'btn.copied':    'Kopiert!',
    'btn.close':     'Schließen',
    'btn.undo':      'Rückgängig',
    'btn.updateNow': 'Jetzt aktualisieren',
    'btn.install':   'App installieren',

    // Carb type selector
    'carbType.label': 'Vergaser-Typ',
    'carbType.VHSx':  'VHSx (VHSA / VHSB / VHSC / VHSH)',
    'carbType.PHBH':  'PHBH',
    'carbType.PHBL':  'PHBL',
    'carbType.betaLabel': 'Beta-Features',
    'carbType.betaBadge': 'BETA',
    'carbType.phblBetaDisclaimer': 'Die PHBL-Unterstützung ist experimentell. Die Konstante für die Nadel-Exposition (16,3 mm) wurde an einem 26-mm-PHBL mit D36-Nadel und AQ-Mischrohr gemessen. Ob der Vergasergrößen-Term auch für PHBL gilt, ist noch nicht bestätigt — bei kleineren PHBL-Größen (20–24 mm) kann die Nadelposition um bis zu ~3 mm abweichen. Durch Praxistests bestätigen.',
    'carbType.phblBetaBanner': '⚠ Beta: PHBL-Berechnungen sind experimentell und nicht vollständig verifiziert.',
    'carbType.phbhBetaDisclaimer': 'Die PHBH-Unterstützung ist experimentell. Die Nadellänge (55mm) und die Konstante für die Nadel-Exposition (23,8mm) wurden gemeinsam an einem 30mm PHBH mit X2-Nadel und AS266-Mischrohr gemessen. Ob der Vergasergrößen-Term auch für andere PHBH-Bohrungsgrößen gilt, ist noch nicht bestätigt — bei kleineren/größeren PHBH-Größen kann die Nadelposition abweichen. Durch Praxistests bestätigen.',
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
    'msg.customLengthMigrated': 'Gesamtlänge von {n} eigenen Nadel(n) korrigiert: {needles}. Die Leerlaufpositionen dieser Nadeln haben sich geändert.',
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
    'field.clips': 'Clip-Positionen',
    'field.needleLengthType': 'Nadellänge-Typ',
    'field.needleLengthType.K': 'K-Typ (73.5 mm)',
    'field.needleLengthType.U': 'U-Typ (68.0 mm)',
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
    'ref.note':      'ØD, E und F sind nur für Nadeln mit mehreren Tapern erforderlich. Die Gesamtlänge ergibt sich aus dem Vergasertyp: VHSx K-Typ = 73.5 mm, VHSx U-Typ = 68.0 mm, PHBH = 55.0 mm, PHBL = 52.0 mm.',

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

    // Share links
    'share.title':     'Setups teilen',
    'share.intro':     'Erzeugt einen Link, der deine Setups und den Vergaser-Typ enthält. Es wird nichts hochgeladen — die Daten stecken vollständig im Link selbst.',
    'share.linkLabel': 'Link zum Teilen',
    'err.share.noActiveSetups': 'Kein Setup hat bisher eine Nadel ausgewählt — bitte zuerst mindestens eine Nadel wählen.',
    'err.share.customNeedle':   'Teilen nicht möglich – {setups} verwenden eigene Nadel(n), die nicht in der eingebauten Datenbank enthalten sind: {needles}. Es können nur eingebaute Nadeln geteilt werden.',
    'msg.shareLoaded':          'Geteilte Setups geladen.',
    'msg.shareFieldsIgnored':   '{n} Feld(er) im geteilten Link waren ungültig und wurden übersprungen.',
    'msg.shareInvalid':         'Dieser Link zum Teilen ist ungültig oder beschädigt.',
    'msg.shareVersion':         'Dieser Link zum Teilen wurde mit einer neueren Version dieser App erstellt und kann nicht geladen werden.',
    'msg.shareOfflineStaleWarning': 'Dieser Link wurde möglicherweise mit einer neueren Nadeldatenbank erstellt — bitte erneut verbinden und neu laden, um aktuelle Werte sicherzustellen.',

    // Service worker updates
    'banner.updateAvailable': 'Eine neue Version dieser App ist verfügbar.',

    // Install App (PWA)
    'install.iosDialogTitle': 'App installieren',
    'install.iosDialogSteps': 'Tippe in der Safari-Werkzeugleiste auf das Teilen-Symbol und wähle dann „Zum Home-Bildschirm".',

    // SVG needle schematic labels
    'svg.shank':         'Schaft',
    'svg.taper1':        'Taper 1',
    'svg.taper2':        'Taper 2',
    'svg.cylTip':        'Zyl. Spitze',
    'svg.fromTipMm':     'von Spitze (mm)',
    'svg.fromTipOpt':    'von Spitze (opt.)',
    'svg.cylTipOpt':     'zyl. Spitze (opt.)',
    'svg.required':      'Pflichtfeld',
    'svg.optionalMulti': 'Optional (nur Nadeln mit mehreren Tapern)',
    'svg.title':         'Dellorto Nadel-Schema — Messpunkte ØA, ØB, C, ØD, E, F',
    'svg.desc':          'Querschnitt einer Dellorto-Nadel mit allen sechs offiziellen Messparametern',

    // View tabs
    'view.nav.label': 'Ansicht',
    'view.calc':      'Rechner',
    'view.catalog':   'Nadelkatalog',

    // Needle catalog
    'catalog.count':              '{n} von {total} Nadeln',
    'catalog.filter.label':       'Filter',
    'catalog.filter.all':         'Alle',
    'catalog.filter.series':      '{s}-Serie',
    'catalog.filter.tapers':      '{n}-Taper',
    'catalog.search.label':       'Nadel suchen',
    'catalog.search.placeholder': 'Nadel suchen, z. B. K98',
    'catalog.usedOnly':           'Nur meine Setups',
    'catalog.usedBy':             'Verwendet in Setup {names}',
    'catalog.sortBy':             'Sortieren nach {col}',
    'catalog.badge.custom':       'eigene',
    'catalog.clipsDefault.tooltip': 'Standardwert der Serie, nicht je Nadel verifiziert',
    'catalog.footnote':           'Werte in mm. * = Standard-Clipanzahl der Serie, nicht je Nadel verifiziert. Farbpunkte = in einem Setup verwendet.',
    'catalog.empty':              'Keine Nadeln für diese Filter.',
    'catalog.legend.show':        'Maßlegende anzeigen',
    'catalog.legend.hide':        'Maßlegende ausblenden',
    'catalog.legend.note':        'Alle Längen in mm, gemessen ab Nadelspitze. 1-Taper-Nadeln haben nur ØA, ØB und C; 2-Taper-Nadeln zusätzlich ØD und E, 3-Taper-Nadeln zusätzlich F.',
    'catalog.col.name':   'Nadel',
    'catalog.col.tapers': 'Taper',
    'catalog.col.A':      'ØA',
    'catalog.col.B':      'ØB',
    'catalog.col.C':      'C',
    'catalog.col.D':      'ØD',
    'catalog.col.E':      'E',
    'catalog.col.F':      'F',
    'catalog.col.clips':  'Clips',
    'catalog.col.length': 'Länge',
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
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
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
