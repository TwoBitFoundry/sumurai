#!/usr/bin/env node

/**
 * Tailwind Usage Audit Script
 *
 * Scans all .tsx files in src/ for className props with >5 utility classes.
 * Generates a markdown report to help track technical debt and migration progress.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MAX_UTILITIES = 5
const SRC_DIR = path.join(__dirname, '../src')
const OUTPUT_FILE = path.join(__dirname, '../docs/TAILWIND_AUDIT.md')

const violations = []
let totalFiles = 0
let filesWithViolations = 0
let totalViolations = 0

function countTailwindUtilities(classNameValue) {
  if (!classNameValue || typeof classNameValue !== 'string') {
    return 0
  }

  const classes = classNameValue.trim().split(/\s+/).filter(Boolean)

  return classes.filter((cls) => {
    const isTemplateLiteral = cls.includes('${')
    const isCVACall = cls.includes('(')
    const isCnCall = cls === 'cn'

    return !isTemplateLiteral && !isCVACall && !isCnCall
  }).length
}

function extractClassNames(fileContent, filePath) {
  const classNameRegex = /className\s*=\s*["']([^"']*)["']/g
  const matches = []

  let match
  let lineNumber = 0
  const lines = fileContent.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineMatches = [...line.matchAll(classNameRegex)]

    for (const m of lineMatches) {
      const classNameValue = m[1]
      const utilityCount = countTailwindUtilities(classNameValue)

      if (utilityCount > MAX_UTILITIES) {
        matches.push({
          line: i + 1,
          className: classNameValue,
          utilityCount,
          snippet: line.trim(),
        })
      }
    }
  }

  return matches
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue
      }
      scanDirectory(fullPath)
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      totalFiles++
      const content = fs.readFileSync(fullPath, 'utf-8')
      const matches = extractClassNames(content, fullPath)

      if (matches.length > 0) {
        filesWithViolations++
        totalViolations += matches.length

        const relativePath = path.relative(SRC_DIR, fullPath)
        violations.push({
          file: relativePath,
          violations: matches,
        })
      }
    }
  }
}

function generateReport() {
  const now = new Date().toISOString().split('T')[0]

  let report = `# Tailwind Usage Audit Report

**Generated:** ${now}

## Summary

- **Total Files Scanned:** ${totalFiles}
- **Files with Violations:** ${filesWithViolations}
- **Total Violations:** ${totalViolations}
- **Compliance Rate:** ${(((totalFiles - filesWithViolations) / totalFiles) * 100).toFixed(1)}%

## Violation Threshold

Files with \`className\` props exceeding **${MAX_UTILITIES} utility classes** are flagged as violations.

### Why This Matters

Long Tailwind \`className\` strings indicate:
1. Missed opportunities to use existing primitives
2. Code duplication across components
3. Harder to maintain consistent design

### Recommended Actions

- **Extract to primitive:** If pattern is reused 3+ times
- **Compose primitives:** Combine existing primitives instead of inline classes
- **Document exception:** If truly one-off, add ESLint disable comment with reason

---

## Violations by File

`

  if (violations.length === 0) {
    report += `**No violations found!** All files comply with the 5-utility limit.

Great work! Consider running this audit quarterly to maintain compliance.
`
  } else {
    violations.sort((a, b) => b.violations.length - a.violations.length)

    for (const { file, violations: fileViolations } of violations) {
      report += `### \`${file}\`\n\n`
      report += `**Violations:** ${fileViolations.length}\n\n`

      for (const violation of fileViolations) {
        report += `- **Line ${violation.line}** (${violation.utilityCount} utilities)\n`
        report += `  \`\`\`tsx\n`
        report += `  ${violation.snippet}\n`
        report += `  \`\`\`\n\n`
      }

      report += `---\n\n`
    }
  }

  report += `## Next Steps

1. **Prioritize high-violation files** (listed first above)
2. **Create GitHub issues** for refactoring tasks using template:
   \`\`\`markdown
   **File:** src/path/to/file.tsx
   **Violations:** X
   **Action:** Extract to primitive / Use existing primitive / Document exception
   \`\`\`
3. **Re-run audit** after refactoring: \`npm run audit:tailwind\`
4. **Track progress** over time by comparing report dates

---

## Related Documentation

- [STYLING_GUIDE.md](STYLING_GUIDE.md) - When to use primitives vs inline classes
- [Primitives README](../src/ui/primitives/README.md) - Available primitives and variants
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines with styling section

---

*This audit was generated automatically by \`scripts/audit-tailwind-usage.js\`.*
`

  return report
}

function main() {
  console.log('🔍 Scanning src/ for Tailwind className violations...\n')

  scanDirectory(SRC_DIR)

  console.log(`📊 Scan complete!`)
  console.log(`   - Files scanned: ${totalFiles}`)
  console.log(`   - Files with violations: ${filesWithViolations}`)
  console.log(`   - Total violations: ${totalViolations}`)
  console.log(
    `   - Compliance rate: ${(((totalFiles - filesWithViolations) / totalFiles) * 100).toFixed(1)}%\n`
  )

  const report = generateReport()

  fs.writeFileSync(OUTPUT_FILE, report, 'utf-8')
  console.log(`📝 Report written to: ${path.relative(process.cwd(), OUTPUT_FILE)}`)
  console.log(`\n✅ Audit complete!`)
}

main()
