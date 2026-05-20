# Contributing to Ren0va

Thank you for your interest in contributing to Ren0va. Please follow these guidelines to ensure a smooth contribution process.

---

## Technical Standards

We prioritize performance and readability above all else. 

1.  **TypeScript:** All logic must be strictly typed. Avoid `any` or complex generic hacks.
2.  **No "LLM Slop":** Do not add verbose comments, preambles, or apologies in code or commit messages. The code should be clean and self-explanatory.
3.  **Style:** Follow the existing patterns. Use Vanilla JS/CSS for frontend changes and avoid adding heavy external dependencies.
4.  **Testing:** Any performance-sensitive changes should include a benchmark (using `Server-Timing` or `k6`) to ensure no regressions.

---

## Workflow

1.  **Fork & Clone:** Fork the repository and clone it locally.
2.  **Create a Branch:** Use descriptive branch names (e.g., `feat/new-icons` or `fix/dropdown-scroll`).
3.  **Implement Changes:** Ensure your changes align with the project architecture.
4.  **Validate:** 
    - Run `npm run build` to ensure the pipeline is intact.
    - Run `npm run dev` to verify the changes locally.
5.  **Commit:** Use clear, concise commit messages (e.g., `fix: resolve race condition in dropdown`).
6.  **Pull Request:** Submit a PR to the `main` branch. Provide a brief technical summary of your changes.

---

## Adding New Icons

To add a new built-in icon to the exhaustive list:

1.  Place your raw SVG in `icons/raw-svg/` following the nomenclature `{name}.svg`.
2.  Run `npm run process` to generate the normalized 48x48 tiles in `icons/processed-svg/`.
3.  Run `npm run build:icons` to update the `icons.json` manifest.
4.  Verify the new icon appears in the landing page dropdown.

---
