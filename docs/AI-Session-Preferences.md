# AI Session Preferences

This document records working style preferences for AI-assisted development sessions.

## Code Style Preferences

### Formatting
- **Allman formatting style** - Strong preference for Allman brace style (opening braces on new lines)

### Code Changes
- **Minimal changes preferred** - Aim for the smallest possible diff, fewest lines of code
- **Avoid duplication** - Don't repeat information; state each preference/principle once
- Extra code is acceptable if it doesn't hide bugs
- Prefer simpler solutions when multiple approaches exist
- Optimization can happen after getting code working (two-phase approach)

### Defaults and Error Handling
- **No defaults unless explicitly requested** - If data is missing, throw an error rather than using a fallback value
- **Fail fast and explicitly** - Use clear error messages that help identify what's missing
- If a default is needed, the user will explicitly state what the default should be

### Optimization Reminders
- After providing a solution, mention if it can be simplified/optimized
- Example: "Note: This can be optimized/minimized once it's working if you'd like."
- This serves as a gentle reminder to the user to consider optimization

## Working Approach

1. Get it working first (if needed)
2. Then optimize/minimize code changes
3. Prefer explicit failures over silent fallbacks
4. Simpler solutions preferred in the end

## Notes

- These preferences apply to the current session
- For new sessions, reference this file or provide a quick reminder

