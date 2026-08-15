# Category Table Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the category management table's oversized rows and stacked actions with the approved balanced single-row layout.

**Architecture:** Keep all category CRUD behavior unchanged. Add category-page-specific template classes and CSS rules so column sizing, input geometry, row height, and responsive overflow are isolated from the shared admin table and button styles.

**Tech Stack:** Java 21, Spring Boot 3.2, Thymeleaf, JUnit 5, CSS

---

### Task 1: Add a failing structural layout test

**Files:**
- Create: `scripts/verify-category-layout.ps1`
- Test: `src/main/resources/templates/admin/categories.html`
- Test: `src/main/resources/static/css/admin.css`

- [ ] **Step 1: Write the failing test**

```powershell
$template = Get-Content -LiteralPath 'src\main\resources\templates\admin\categories.html' -Raw
$css = Get-Content -LiteralPath 'src\main\resources\static\css\admin.css' -Raw

if (-not $template.Contains('class="category-table"')) { throw 'Missing category table class.' }
if (-not $css.Contains('.category-actions{flex-wrap:nowrap;justify-content:flex-start}')) { throw 'Missing inline action layout.' }
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-category-layout.ps1`

Expected: FAIL because the dedicated category layout classes do not exist yet.

### Task 2: Implement the balanced single-row layout

**Files:**
- Modify: `src/main/resources/templates/admin/categories.html`
- Modify: `src/main/resources/static/css/admin.css`

- [ ] **Step 1: Add dedicated template classes and column definitions**

Change the table opening and headings to:

```html
<table class="category-table">
  <colgroup>
    <col class="category-col-sort">
    <col class="category-col-name">
    <col class="category-col-description">
    <col class="category-col-actions">
  </colgroup>
```

Remove the inline widths from the four headings. Replace input inline styles with `category-sort-input`, `category-name-input`, and `category-description-input`. Change the action wrapper to `class="actions category-actions"`.

- [ ] **Step 2: Add category-specific CSS**

Append before the existing mobile media query:

```css
/* ---- 分类管理表格 ---- */
.category-table{min-width:760px;table-layout:fixed}
.category-table .category-col-sort{width:96px}
.category-table .category-col-name{width:180px}
.category-table .category-col-actions{width:168px}
.category-table tbody td{height:62px;vertical-align:middle}
.category-table input{height:34px;padding:6px 10px;font-size:13px;border:1px solid #eadcc0;border-radius:5px;background:#fffdf6;font-family:inherit}
.category-table input:focus{outline:none;border-color:#d1662f;box-shadow:0 0 0 3px rgba(209,102,47,.10)}
.category-sort-input{width:68px}
.category-name-input{width:100%}
.category-description-input{width:100%}
.category-actions{flex-wrap:nowrap;justify-content:flex-start}
.category-actions form.inline{flex:none}
.category-actions .btn{min-width:62px;padding:6px 12px}
```

- [ ] **Step 3: Run the focused test and confirm GREEN**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-category-layout.ps1`

Expected: PASS with two tests and zero failures.

### Task 3: Verify the full project

**Files:**
- Verify: `src/main/resources/templates/admin/categories.html`
- Verify: `src/main/resources/static/css/admin.css`

- [ ] **Step 1: Run all Maven tests**

Run: `mvn test`

Expected: BUILD SUCCESS with zero test failures.

- [ ] **Step 2: Inspect the final diff-equivalent file sections**

Run: `rg -n "category-table|category-(sort|name|description)-input|category-actions" src/main/resources/templates/admin/categories.html src/main/resources/static/css/admin.css`

Expected: all dedicated template hooks and CSS rules are present; no unrelated files are modified.

- [ ] **Step 3: Skip commit because this workspace has no `.git` directory**

Record the completed files in the final handoff instead of creating a Git commit.
