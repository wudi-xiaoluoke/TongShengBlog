# View Count Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `👀` reading-count Emoji with a consistent inline SVG eye icon on the home and article detail pages.

**Architecture:** Keep the existing Thymeleaf count expressions unchanged, but move them into text spans beside a decorative SVG. Add shared `.views-icon` styling and align both icon/count pairs with inline flex layout.

**Tech Stack:** Thymeleaf, HTML, inline SVG, CSS, PowerShell structural verification

---

### Task 1: Add a failing icon structure check

**Files:**
- Create: `scripts/verify-view-count-icon.ps1`
- Test: `src/main/resources/templates/home/index.html`
- Test: `src/main/resources/templates/article/detail.html`
- Test: `src/main/resources/static/css/home.css`

- [ ] Create a script that fails when either template contains `👀`, when either template lacks `class="views-icon"`, or when CSS lacks the shared SVG rule.
- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-view-count-icon.ps1` and confirm it fails because the Emoji is still present.

### Task 2: Replace Emoji with SVG icon

**Files:**
- Modify: `src/main/resources/templates/home/index.html:27`
- Modify: `src/main/resources/templates/article/detail.html:21`
- Modify: `src/main/resources/static/css/home.css:113`

- [ ] Replace each Emoji count span with this structure while preserving its existing count expression:

```html
<span class="views">
  <svg class="views-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
  <span th:text="${article.views}"></span>
</span>
```

- [ ] Add shared icon styling:

```css
.note .views{display:inline-flex;align-items:center;gap:4px;margin-top:12px;margin-left:10px;font-size:12px;color:#b39a77}
.views-icon{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
```

- [ ] Run the structural script and confirm it passes.

### Task 3: Verify the project

**Files:**
- Verify: both templates, `home.css`, and the verification script.

- [ ] Run the structural script again.
- [ ] Map the workspace to a temporary ASCII drive letter and run `mvn clean test`; remove the drive mapping afterward.
- [ ] Confirm four Maven tests pass and no `👀` remains in the two reading-count templates.
- [ ] Skip commit because the workspace has no `.git` directory.
