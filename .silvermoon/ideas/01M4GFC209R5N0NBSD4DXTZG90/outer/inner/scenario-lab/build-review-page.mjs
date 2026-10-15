import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";

function scriptJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMarkdown(source) {
  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = function ({ href, title, tokens }) {
    const label = this.parser.parseInline(tokens);
    if (!/^(?:https?:|mailto:)/i.test(href)) {
      return `${label} <code>${escapeHtml(href)}</code>`;
    }
    const titleAttribute = title === null
      ? ""
      : ` title="${escapeHtml(title)}"`;
    return `<a href="${escapeHtml(href)}"${titleAttribute} target="_blank" rel="noreferrer">${label}</a>`;
  };
  return marked.parse(source, {
    gfm: true,
    breaks: false,
    renderer,
  });
}

export async function buildReviewPage({ labRoot, outputDirectory }) {
  const [manifest, reviewSource] = await Promise.all([
    readFile(resolve(outputDirectory, "manifest.json"), "utf8").then(JSON.parse),
    readFile(resolve(labRoot, "reviews.json"), "utf8").then(JSON.parse),
  ]);
  const reviews = new Map(
    reviewSource.reviews.map((review) => [review.scenario, review]),
  );
  if (!Array.isArray(manifest.scenarioDefinitions)) {
    throw new TypeError("Manifest must contain scenario transition definitions.");
  }
  const definitions = new Map(
    manifest.scenarioDefinitions.map((definition) => [definition.id, definition]),
  );
  const grouped = new Map();
  for (const result of manifest.results) {
    const definition = definitions.get(result.scenario);
    if (definition === undefined) {
      throw new Error(`Missing transition definition for ${result.scenario}.`);
    }
    const page = grouped.get(result.scenario) ?? {
      scenario: result.scenario,
      state: result.state,
      idea: result.idea,
      command: result.command,
      flow: definition.flow,
      reports: {},
    };
    page.reports[result.language] = await readFile(
      resolve(outputDirectory, result.stdout),
      "utf8",
    );
    grouped.set(result.scenario, page);
  }
  const pages = [...grouped.values()].map((page) => ({
    ...page,
    renderedReports: {
      "en-US": renderMarkdown(page.reports["en-US"]),
      "zh-CN": renderMarkdown(page.reports["zh-CN"]),
    },
    initialReview: reviews.get(page.scenario) ?? {
      verdict: "pending",
      redundancy: "unknown",
      missing: "unknown",
      missingPrompt: "unknown",
      comment: "",
    },
  }));
  const missingLocales = pages.filter(
    ({ reports }) => reports["en-US"] === undefined || reports["zh-CN"] === undefined,
  );
  if (missingLocales.length > 0) {
    throw new Error(
      `Review pages require en-US and zh-CN reports: ${
        missingLocales.map(({ scenario }) => scenario).join(", ")
      }.`,
    );
  }

  const document = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Whats-next 素材评审</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #111827; color: #e5e7eb; }
    header { position: sticky; top: 0; z-index: 2; padding: 12px 20px; background: #0f172a; border-bottom: 1px solid #334155; }
    header h1 { margin: 0 0 8px; font-size: 20px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    button, select, textarea { font: inherit; }
    button, select { padding: 7px 10px; border-radius: 6px; border: 1px solid #64748b; background: #1e293b; color: #e5e7eb; }
    button:disabled { opacity: .4; }
    main { padding: 18px; }
    .metadata { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-bottom: 14px; }
    .metadata div, .flow, .review { padding: 10px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; }
    .flow { margin-bottom: 14px; padding: 14px; }
    .flow-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; align-items: baseline; margin-bottom: 12px; }
    .flow-heading h2 { margin: 0; font-size: 18px; }
    .flow-position { color: #cbd5e1; font-size: 14px; }
    .flow-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
    .flow-card { position: relative; padding: 12px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; line-height: 1.55; }
    .flow-card:not(:last-child)::after { content: "→"; position: absolute; right: -15px; top: 50%; transform: translateY(-50%); color: #7dd3fc; font-size: 18px; }
    .flow-card strong { display: block; margin-bottom: 6px; color: #7dd3fc; }
    .materials { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .material { min-width: 0; }
    .material h2 { margin: 0; padding: 10px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 8px 8px 0 0; }
    .markdown { box-sizing: border-box; padding: 14px 18px; height: 52vh; overflow: auto; overflow-wrap: anywhere; background: #020617; border: 1px solid #334155; border-top: 0; border-radius: 0 0 8px 8px; }
    .markdown > :first-child { margin-top: 0; }
    .markdown > :last-child { margin-bottom: 0; }
    .markdown h1, .markdown h2, .markdown h3, .markdown h4 { line-height: 1.3; margin: 1.25em 0 .55em; }
    .markdown h1 { font-size: 1.55rem; }
    .markdown h2 { font-size: 1.35rem; border-bottom: 1px solid #334155; padding-bottom: .35em; }
    .markdown h3 { font-size: 1.15rem; }
    .markdown p, .markdown ul, .markdown ol, .markdown blockquote { line-height: 1.65; }
    .markdown table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: .92rem; }
    .markdown th, .markdown td { padding: 8px 10px; border: 1px solid #475569; text-align: left; vertical-align: top; }
    .markdown th { background: #1e293b; }
    .markdown tr:nth-child(even) td { background: #0f172a; }
    .markdown code { padding: .15em .35em; border-radius: 4px; background: #1e293b; color: #f8fafc; }
    .markdown pre { padding: 12px; overflow: auto; border-radius: 6px; background: #0f172a; border: 1px solid #334155; }
    .markdown pre code { padding: 0; background: transparent; }
    .markdown blockquote { margin-left: 0; padding-left: 14px; border-left: 4px solid #64748b; color: #cbd5e1; }
    .markdown a { color: #7dd3fc; }
    .review { margin-top: 14px; }
    .review-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 10px; }
    label { display: grid; gap: 5px; font-weight: 600; }
    textarea { box-sizing: border-box; width: 100%; min-height: 110px; margin-top: 10px; padding: 10px; border-radius: 6px; border: 1px solid #64748b; background: #0f172a; color: #e5e7eb; }
    .hint { color: #94a3b8; font-size: 13px; }
    @media (max-width: 900px) {
      .materials, .review-grid, .flow-grid { grid-template-columns: 1fr; }
      .flow-card:not(:last-child)::after { content: "↓"; right: 50%; top: auto; bottom: -19px; transform: translateX(50%); }
      .markdown { height: 38vh; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Whats-next 素材评审</h1>
    <div class="toolbar">
      <button id="previous">上一页</button>
      <select id="page"></select>
      <button id="next">下一页</button>
      <span id="position"></span>
      <button id="export">导出评审 JSON</button>
      <button id="import">导入评审 JSON</button>
      <input id="import-file" type="file" accept="application/json" hidden>
    </div>
  </header>
  <main>
    <section class="metadata" id="metadata"></section>
    <section class="flow" aria-labelledby="flow-title">
      <div class="flow-heading">
        <h2 id="flow-title">状态转换关系</h2>
        <div class="flow-position" id="flow-position"></div>
      </div>
      <div class="flow-grid" id="flow"></div>
    </section>
    <section class="materials">
      <article class="material"><h2>English (en-US)</h2><div class="markdown" id="en"></div></article>
      <article class="material"><h2>简体中文 (zh-CN)</h2><div class="markdown" id="zh"></div></article>
    </section>
    <section class="review">
      <h2>逐页评审意见</h2>
      <p class="hint">初始值是 Agent 初审，不代表人工已经完成 review。修改会自动保存在本浏览器。</p>
      <div class="review-grid">
        <label>结论<select id="verdict">
          <option value="pending">待评审</option><option value="ok">OK</option><option value="issues">有问题</option>
        </select></label>
        <label>冗余重复<select id="redundancy">
          <option value="unknown">待判断</option><option value="no">无</option><option value="yes">有</option>
        </select></label>
        <label>内容缺失<select id="missing">
          <option value="unknown">待判断</option><option value="no">无</option><option value="yes">有</option>
        </select></label>
        <label>缺少应有提示<select id="missingPrompt">
          <option value="unknown">待判断</option><option value="no">无</option><option value="yes">有</option>
        </select></label>
      </div>
      <textarea id="comment" aria-label="评审意见"></textarea>
    </section>
  </main>
  <script>
    const payload = ${scriptJson({
      sourceRevision: manifest.sourceRevision,
      sourceDirty: manifest.sourceDirty === true || manifest.sourceDirty === "true",
      generatedAt: manifest.finishedAt,
      pages,
    })};
    const storageKey = "silvermoon-whats-next-review:" + payload.sourceRevision;
    let reviews = JSON.parse(localStorage.getItem(storageKey) || "{}");
    let index = 0;
    const fields = ["verdict", "redundancy", "missing", "missingPrompt", "comment"];
    const byId = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
    const pageSelect = byId("page");
    payload.pages.forEach((page, pageIndex) => {
      const option = document.createElement("option");
      option.value = String(pageIndex);
      option.textContent = (pageIndex + 1) + ". " + page.flow.objective + " / "
        + page.flow.check + " — " + page.scenario;
      pageSelect.append(option);
    });
    function reviewFor(page) {
      return { ...page.initialReview, ...(reviews[page.scenario] || {}) };
    }
    function save() {
      const page = payload.pages[index];
      reviews[page.scenario] = Object.fromEntries(fields.map((field) => [field, byId(field).value]));
      localStorage.setItem(storageKey, JSON.stringify(reviews));
    }
    function render() {
      const page = payload.pages[index];
      const review = reviewFor(page);
      pageSelect.value = String(index);
      byId("position").textContent = (index + 1) + " / " + payload.pages.length;
      byId("previous").disabled = index === 0;
      byId("next").disabled = index === payload.pages.length - 1;
      byId("metadata").innerHTML =
        "<div><strong>Scenario</strong><br>" + escapeHtml(page.scenario) + "</div>" +
        "<div><strong>State</strong><br>" + escapeHtml(page.state) + "</div>" +
        "<div><strong>Idea</strong><br>" + escapeHtml(page.idea ?? "(none)") + "</div>" +
        "<div><strong>Source</strong><br>" + escapeHtml(payload.sourceRevision.slice(0, 12)) +
        (payload.sourceDirty ? " (dirty)" : " (clean)") + "</div>";
      byId("flow-position").innerHTML =
        "<strong>Objective:</strong> " + escapeHtml(page.flow.objective) +
        " &nbsp; <strong>Check:</strong> " + escapeHtml(page.flow.check) +
        " &nbsp; <strong>分支:</strong> " + escapeHtml(page.flow.branch);
      byId("flow").innerHTML = [
        ["前一状态", page.flow.previousState],
        ["到达动作", page.flow.transitionAction],
        ["当前状态", page.flow.currentState],
        ["后续动作 / 去向", page.flow.nextAction],
      ].map(([label, value]) =>
        "<div class=\\"flow-card\\"><strong>" + escapeHtml(label)
        + "</strong>" + escapeHtml(value) + "</div>"
      ).join("");
      byId("en").innerHTML = page.renderedReports["en-US"];
      byId("zh").innerHTML = page.renderedReports["zh-CN"];
      fields.forEach((field) => byId(field).value = review[field] ?? "");
    }
    fields.forEach((field) => byId(field).addEventListener("input", save));
    byId("previous").addEventListener("click", () => { save(); index--; render(); });
    byId("next").addEventListener("click", () => { save(); index++; render(); });
    pageSelect.addEventListener("change", () => { save(); index = Number(pageSelect.value); render(); });
    byId("export").addEventListener("click", () => {
      save();
      const blob = new Blob([JSON.stringify({
        sourceRevision: payload.sourceRevision,
        exportedAt: new Date().toISOString(),
        reviews: payload.pages.map((page) => ({ scenario: page.scenario, ...reviewFor(page) })),
      }, null, 2) + "\\n"], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "whats-next-reviews-" + payload.sourceRevision.slice(0, 12) + ".json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
    byId("import").addEventListener("click", () => byId("import-file").click());
    byId("import-file").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const imported = JSON.parse(await file.text());
      if (imported.sourceRevision !== payload.sourceRevision || !Array.isArray(imported.reviews)) {
        alert("评审文件的 source revision 或格式不匹配。");
        return;
      }
      reviews = Object.fromEntries(imported.reviews.map((review) => [review.scenario, review]));
      localStorage.setItem(storageKey, JSON.stringify(reviews));
      render();
    });
    render();
  </script>
</body>
</html>
`;
  await writeFile(resolve(outputDirectory, "review.html"), document, "utf8");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const outputDirectory = process.argv[2];
  if (outputDirectory === undefined) {
    throw new TypeError("Usage: node build-review-page.mjs <corpus-directory>");
  }
  await buildReviewPage({ labRoot: resolve(import.meta.dirname), outputDirectory });
}
