# Internationalization (i18n) Setup Guide

## Overview

LearnVault uses `i18next` for multilingual support, with complete translations
available in the following languages:

| Language          | Code | Status      | Locale File         |
| ----------------- | ---- | ----------- | ------------------- |
| English (Default) | en   | ✅ Complete | src/locales/en.json |
| Spanish           | es   | ✅ Complete | src/locales/es.json |
| French            | fr   | ✅ Complete | src/locales/fr.json |
| Swahili           | sw   | ✅ Complete | src/locales/sw.json |

## Architecture

### Configuration

- **Main config**: `src/i18n.ts` - Initializes i18next with supported languages
  and fallback settings
- **Supported languages**: English (en), Spanish (es), French (fr), Swahili (sw)
- **Fallback language**: English (en)
- **Locale detection**: Automatic via `i18next-browser-languagedetector`

### Translation Files

All translation files are stored in `src/locales/` and follow a nested JSON
structure:

```json
{
	"category": {
		"key": "Translated string",
		"nested": {
			"key": "Another translated string with {{interpolation}}"
		}
	}
}
```

### Usage in Components

Use the `useTranslation` hook from `react-i18next`:

```typescript
import { useTranslation } from "react-i18next"

export function MyComponent() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <h1>{t("nav.learn")}</h1>
      <p>Current language: {i18n.language}</p>
      <button onClick={() => i18n.changeLanguage("fr")}>Français</button>
    </div>
  )
}
```

## Key Coverage

### Complete Translation Keys (103 keys total)

#### Navigation (nav) - 16 keys

`contractExplorer`, `txExplorer`, `github`, `tutorial`, `viewDocs`, `debug`,
`learn`, `dashboard`, `dao`, `leaderboard`, `profile`, `courses`, `treasury`,
`discord`, `twitter`, `docs`

#### Home Page (home) - 35+ keys

- Hero section: `heroTitle`, `heroDesc`
- Course Progress: `courseProgress.title`, `courseProgress.desc`
- Milestones:
  `milestones.{1,2,3,locked,inProgress,submittingText,markComplete,completedText,tx,lrnReward}`
- Sample Contracts:
  `sampleContracts.{title,guess,guessDesc1,guessLink,guessDesc2,other,oz,soroban}`
- Start Building:
  `startBuilding.{title,step1,step2,step3,step4,watch,youtube,inspired,examples,deploy,mainnet}`
- Footer: `footer.{invoke,contractLink,browse,txLink}`

#### Connect/Wallet (connect, wallet) - 20 keys

Error handling, loading states, account funding, network selection, balance
display

#### Network Warnings (network) - 3 keys

`testnetWarning`, `futurenetWarning`, `localWarning`

#### USDC Operations (usdc) - 5 keys

`getTestUSDC`, `minting`, `mintSuccess`, `mintError`, `tooltip`

#### Pages (pages) - 30+ keys

- Learn: `pages.learn.{title,desc}`
- DAO: `pages.dao.{title,desc,lastUpdated}`
- Leaderboard: 17 keys for table, filters, pagination, search
- Profile: `pages.profile.{title,desc}`

## CI/CD Validation

### Running the Validation Check

```bash
npm run i18n-check
```

This script validates that:

- All supported locales (es, fr, sw) have complete key parity with en.json
- No unexpected locale files are present (e.g., ps.json)
- All keys in en.json exist in all supported locales
- Warns about extra keys in locale files not in en.json

### Automated Validation

The validation runs automatically in CI via `frontend-ci.yml`:

```yaml
- name: i18n key parity check
  run: npm run i18n-check
```

## Development Workflow

### Adding New Translations

1. Add the new key to `src/locales/en.json` with English text
2. Add the corresponding key to all other locale files (`es.json`, `fr.json`,
   `sw.json`)
3. Run `npm run i18n-check` to verify completeness
4. Use the key in your component via `t("namespace.key")`

### Updating Existing Translations

1. Modify the text in `src/locales/en.json`
2. Update all other locale files to reflect the change
3. Run `npm run i18n-check` to ensure consistency

### Testing with Pseudo-Locale

To verify that all keys are properly wrapped with translation calls (useful for
identifying missing translations):

```bash
npm run i18n:pseudo
```

This generates a pseudo-locale that wraps all strings with `[[...]]` to help
identify areas where translations might be missing.

## Language Preferences

All supported locales serve the project's mission of accessibility for African
learners:

- **Spanish (es)** - Widely spoken in Latin America and parts of Africa
- **French (fr)** - Official language in 18 African countries (Senegal, Côte
  d'Ivoire, DRC, Cameroon, etc.)
- **Swahili (sw)** - Widely spoken across East and Central Africa (Kenya,
  Tanzania, Uganda, DRC, etc.)

## Removing Languages

If a language needs to be removed:

1. Delete the locale file from `src/locales/`
2. Update `src/i18n.ts` to remove from `resources` and `supportedLngs`
3. Update this documentation

## Key Translation Resources

- i18next Documentation: https://www.i18next.com/
- React i18next: https://react.i18next.com/
- Language Detector: https://github.com/i18next/i18next-browser-languagedetector

## Troubleshooting

### Missing Translations

If you see raw i18n keys (e.g., `pages.leaderboard.title` instead of the
translated text):

1. Check that the key exists in all locale files
2. Run `npm run i18n-check` to verify parity
3. Verify the component is using `useTranslation()` hook correctly
4. Check browser console for i18next warnings

### Language Not Switching

1. Ensure language code matches the supported language codes (en, es, fr, sw)
2. Check that the locale file exists and has the required keys
3. Run `npm run i18n-check` to verify setup

### Build Failing with i18n-check

Run the validation locally:

```bash
npm run i18n-check
```

Add any missing keys to affected locale files until all checks pass.
