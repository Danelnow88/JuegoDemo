# Self-Healing & Adaptive Resiliency Protocol

## Trigger Conditions:
Activate this protocol ONLY if operating on limited local models OR if a task encounters an unexpected network/socket error mid-execution.

## Resilient Execution Protocol:
1. **Unrestricted Power for High-Tier Models:**
   - If using cloud/advanced models (GPT series, DeepSeek), do NOT artificially limit reasoning or context unless a network error occurs.
2. **Crash Recovery & State Preservation:**
   - On connection/socket drops ('socket error', 'other side closed'), DO NOT restart from scratch.
   - Read the last conversation context, identify the last successful file edit, and continue from the exact pending step.
3. **Adaptive Graceful Degradation (Local Models):**
   - If using constrained local models (Qwen, OSS) AND the task spans across 2+ complex files, automatically switch to step-by-step micro-edits.
   - In case of repeated model halts, stop and report: "Checkpoint saved. Ready to continue or hand off to a higher-capacity model."
