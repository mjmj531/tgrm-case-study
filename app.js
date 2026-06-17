const DATASETS = [
  {
    key: "Pantry",
    label: "Pantry",
    candidates: [
      "../case_study/Pantry/case_study_export_wtime_v1e0_cover5.json",
      "./case_study/Pantry/case_study_export_wtime_v1e0_cover5.json",
      "/case_study/Pantry/case_study_export_wtime_v1e0_cover5.json",
    ],
  },
  {
    key: "Instruments",
    label: "Instruments",
    candidates: [
      "../case_study/Instruments/case_study_export_wtime_v1e2_cover5.json",
      "./case_study/Instruments/case_study_export_wtime_v1e2_cover5.json",
      "/case_study/Instruments/case_study_export_wtime_v1e2_cover5.json",
    ],
  },
  {
    key: "Scientific",
    label: "Scientific",
    candidates: [
      "../case_study/Scientific/case_study_export_wtime_v1e3_cover5.json",
      "./case_study/Scientific/case_study_export_wtime_v1e3_cover5.json",
      "/case_study/Scientific/case_study_export_wtime_v1e3_cover5.json",
    ],
  },
];

const state = {
  data: null,
  cases: [],
  selectedIndex: 0,
  filter: "all",
  assetBase: "",
  datasetKey: DATASETS[0].key,
};

const els = {
  datasetMeta: document.getElementById("datasetMeta"),
  datasetTabs: document.getElementById("datasetTabs"),
  caseFilter: document.getElementById("caseFilter"),
  rankDistribution: document.getElementById("rankDistribution"),
  caseList: document.getElementById("caseList"),
  caseTitle: document.getElementById("caseTitle"),
  metricPills: document.getElementById("metricPills"),
  emptyState: document.getElementById("emptyState"),
  caseContent: document.getElementById("caseContent"),
  historyCount: document.getElementById("historyCount"),
  historyTrack: document.getElementById("historyTrack"),
  groundTruthRank: document.getElementById("groundTruthRank"),
  groundTruthCard: document.getElementById("groundTruthCard"),
  predictionSummary: document.getElementById("predictionSummary"),
  predictionList: document.getElementById("predictionList"),
  statCases: document.getElementById("statCases"),
  statDomain: document.getElementById("statDomain"),
  statTopK: document.getElementById("statTopK"),
};

function formatScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "n/a";
  return score.toFixed(3);
}

function metricValue(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toFixed(3);
  return String(value ?? "n/a");
}

function bestHitMetric(metrics = {}) {
  const hitEntries = Object.entries(metrics)
    .filter(([key]) => key.startsWith("hit_at_"))
    .sort((a, b) => Number(a[0].split("_").pop()) - Number(b[0].split("_").pop()));
  const hit = hitEntries.find(([, value]) => value);
  return hit ? hit[0].replace("hit_at_", "Hit@") : "Miss";
}

function itemImageSrc(item) {
  const source = item.image_path || item.image_url || "";
  if (!source || source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
    return source;
  }
  return `${state.assetBase}${source}`;
}

function decodeHtmlEntities(value) {
  if (value === null || value === undefined) return "";
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value);
  return textarea.value;
}

function shortText(value, fallback = "Unknown") {
  if (!value) return fallback;
  if (Array.isArray(value)) return decodeHtmlEntities(value.filter(Boolean).join(" / ")) || fallback;
  return decodeHtmlEntities(value) || fallback;
}

function hasMetaValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
  return String(value).trim() !== "";
}

function historyTimeLabel(item, index, total) {
  if (item.date) return shortText(item.date);
  const timestamp = item.timestamp ?? item.time ?? item.unixReviewTime ?? item.reviewTime;
  if (!timestamp) return `T-${total - index}`;
  if (typeof timestamp === "number") {
    const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
    return new Date(milliseconds).toLocaleDateString();
  }
  return shortText(timestamp);
}

function createItemCard(item, options = {}) {
  const card = document.createElement("article");
  card.className = ["item-card", options.className || "", item.is_ground_truth ? "hit-card" : ""]
    .filter(Boolean)
    .join(" ");

  const imageBox = document.createElement("div");
  imageBox.className = "image-box";
  const src = itemImageSrc(item);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = item.title || item.raw_item_id || "item image";
    img.loading = "lazy";
    img.onerror = () => {
      imageBox.innerHTML = "";
      imageBox.classList.add("image-box--fallback");
      const fb = document.createElement("span");
      fb.className = "image-fallback";
      fb.textContent = "[No Image]";
      imageBox.appendChild(fb);
      if (options.showRankBadge && typeof item.rank === "number") {
        const badge = document.createElement("span");
        badge.className = item.rank === 1 ? "rank-badge rank-badge--gold" : "rank-badge";
        badge.textContent = `#${item.rank}`;
        imageBox.appendChild(badge);
      }
    };
    imageBox.appendChild(img);
  } else {
    imageBox.classList.add("image-box--fallback");
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.textContent = "[No Image]";
    imageBox.appendChild(fallback);
  }

  if (options.showRankBadge && typeof item.rank === "number") {
    const badge = document.createElement("span");
    badge.className = item.rank === 1 ? "rank-badge rank-badge--gold" : "rank-badge";
    badge.textContent = `#${item.rank}`;
    imageBox.appendChild(badge);
  }

  const body = document.createElement("div");
  body.className = "item-body";

  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = shortText(item.title || item.raw_item_id || `Item ${item.item_id}`);

  const meta = document.createElement("div");
  meta.className = "item-meta";
  const metaEntries = [
    ["Item ID", item.raw_item_id || item.item_id],
    ["Brand", item.brand],
    ["Category", item.category],
  ];
  for (const [label, value] of metaEntries) {
    if (!hasMetaValue(value)) continue;
    meta.append(createMetaLine(label, value));
  }

  const stats = document.createElement("div");
  stats.className = "item-stats";
  if (options.rankLabel || item.rank) stats.appendChild(createTag(options.rankLabel || `Rank ${item.rank}`));
  if (typeof item.score === "number") stats.appendChild(createTag(`Score ${formatScore(item.score)}`));
  if (item.is_ground_truth) stats.appendChild(createTag("Ground Truth", "hit"));

  body.append(title, meta, stats);
  card.append(imageBox, body);
  return card;
}

function createTag(text, type = "") {
  const tag = document.createElement("span");
  tag.className = ["tag", type].filter(Boolean).join(" ");
  tag.textContent = text;
  return tag;
}

function createMetaLine(label, value) {
  const line = document.createElement("div");
  line.className = "meta-line";
  const labelNode = document.createElement("span");
  labelNode.className = "meta-label";
  labelNode.textContent = `${label}:`;
  const valueNode = document.createElement("span");
  valueNode.className = "meta-value";
  valueNode.textContent = shortText(value, "Unknown");
  line.append(labelNode, valueNode);
  return line;
}

function rankCountMap(cases) {
  const counts = new Map();
  for (const item of cases) {
    const rank = item.summary?.ground_truth_rank;
    if (typeof rank === "number") {
      counts.set(rank, (counts.get(rank) || 0) + 1);
    }
  }
  return counts;
}

function populateFilterOptions(data) {
  if (!els.caseFilter) return;
  const cases = data?.cases || [];
  const ranks = [...rankCountMap(cases).keys()].sort((a, b) => a - b);
  const counts = rankCountMap(cases);

  const previousValue = state.filter;
  const options = [
    `<option value="all">All Cases (${cases.length})</option>`,
    `<option value="hit">Hits Only (Top-${data?.top_k ?? "?"})</option>`,
    `<option value="withImage">With Images</option>`,
  ];
  for (const rank of ranks) {
    options.push(`<option value="rank:${rank}">Rank ${rank} (${counts.get(rank)})</option>`);
  }
  els.caseFilter.innerHTML = options.join("");

  const optionValues = new Set(Array.from(els.caseFilter.options).map((o) => o.value));
  if (optionValues.has(previousValue)) {
    els.caseFilter.value = previousValue;
  } else {
    els.caseFilter.value = "all";
    state.filter = "all";
  }
}

function renderRankDistribution(data) {
  if (!els.rankDistribution) return;
  const cases = data?.cases || [];
  if (!cases.length) {
    els.rankDistribution.innerHTML = "";
    return;
  }
  const counts = rankCountMap(cases);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  if (!ranks.length) {
    els.rankDistribution.innerHTML = "";
    return;
  }
  const maxCount = Math.max(...counts.values());

  const heading = `
    <div class="rank-dist-heading">
      <span>GT Rank Distribution</span>
      <span class="rank-dist-total">${cases.length} total</span>
    </div>
  `;

  const rows = ranks
    .map((rank) => {
      const count = counts.get(rank);
      const widthPct = (count / maxCount) * 100;
      const isActive = state.filter === `rank:${rank}`;
      const goldClass = rank === 1 ? "rank-row--gold" : "";
      return `
        <button type="button" class="rank-row ${isActive ? "active" : ""} ${goldClass}" data-rank="${rank}">
          <span class="rank-row-label">#${rank}</span>
          <span class="rank-row-bar"><span class="rank-row-fill" style="width:${widthPct}%"></span></span>
          <span class="rank-row-count">${count}</span>
        </button>
      `;
    })
    .join("");

  els.rankDistribution.innerHTML = `${heading}<div class="rank-dist-rows">${rows}</div>`;

  els.rankDistribution.querySelectorAll(".rank-row").forEach((button) => {
    button.addEventListener("click", () => {
      const rank = button.dataset.rank;
      const nextFilter = state.filter === `rank:${rank}` ? "all" : `rank:${rank}`;
      state.filter = nextFilter;
      if (els.caseFilter) els.caseFilter.value = nextFilter;
      state.selectedIndex = 0;
      render();
    });
  });
}

function filteredCases() {
  if (!state.data) return [];
  const cases = state.data.cases || [];
  if (state.filter === "hit") {
    return cases.filter((item) => item.summary?.ground_truth_rank <= state.data.top_k);
  }
  if (state.filter.startsWith("rank:")) {
    const rank = Number(state.filter.split(":")[1]);
    return cases.filter((item) => item.summary?.ground_truth_rank === rank);
  }
  if (state.filter === "withImage") {
    return cases.filter((item) => {
      const allItems = [
        ...(item.history || []),
        item.ground_truth,
        ...(item.predictions || []),
      ].filter(Boolean);
      return allItems.some((entry) => entry.has_image && itemImageSrc(entry));
    });
  }
  return cases;
}

function rankTagClass(rank) {
  if (rank === 1) return "rank-tag rank-tag--gold";
  if (rank <= 3) return "rank-tag rank-tag--good";
  if (rank <= 5) return "rank-tag rank-tag--ok";
  return "rank-tag rank-tag--miss";
}

function renderCaseList() {
  state.cases = filteredCases();
  els.caseList.innerHTML = "";

  if (!state.cases.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No matching cases</h3><p>Adjust the filter or load another export.</p>";
    els.caseList.appendChild(empty);
    renderCase(null);
    return;
  }

  if (state.selectedIndex >= state.cases.length) state.selectedIndex = 0;

  state.cases.forEach((caseItem, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === state.selectedIndex ? "active" : "";
    button.addEventListener("click", () => {
      state.selectedIndex = index;
      render();
    });

    const rank = caseItem.summary?.ground_truth_rank;
    const rankDisplay = typeof rank === "number" ? `#${rank}` : "n/a";
    const hitLabel = bestHitMetric(caseItem.metrics);
    const isHit = hitLabel !== "Miss";
    button.innerHTML = `
      <div class="case-row-top">
        <span>User ${caseItem.user_id}</span>
        <span class="${rankTagClass(rank)}">${rankDisplay}</span>
      </div>
      <div class="case-row-meta">
        <span class="tag ${isHit ? "hit" : "miss"}">${hitLabel}</span>
        <span>${caseItem.summary?.history_length ?? 0} history</span>
      </div>
    `;
    els.caseList.appendChild(button);
  });
}

function renderMetricPills(caseItem) {
  els.metricPills.innerHTML = "";
  if (!caseItem) return;

  const rank = caseItem.summary?.ground_truth_rank ?? "n/a";
  const hitLabel = bestHitMetric(caseItem.metrics);
  const metrics = caseItem.metrics || {};
  const values = [
    ["GT Rank", rank],
    ["Best Hit", hitLabel],
    ["Hit@1", metricValue(metrics.hit_at_1)],
    ["Hit@5", metricValue(metrics.hit_at_5)],
    ["NDCG@5", metricValue(metrics.ndcg_at_5)],
    ["NDCG@10", metricValue(metrics.ndcg_at_10)],
    ["History", caseItem.summary?.history_length ?? 0],
  ];

  values.forEach(([label, value]) => {
    const pill = document.createElement("div");
    const isGoldRank = label === "GT Rank" && (value === 1 || value === "1");
    pill.className = isGoldRank ? "metric-pill metric-pill--gold" : "metric-pill";
    pill.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    els.metricPills.appendChild(pill);
  });
}

function renderCase(caseItem) {
  renderMetricPills(caseItem);

  if (!caseItem) {
    els.emptyState.classList.remove("hidden");
    els.caseContent.classList.add("hidden");
    els.caseTitle.textContent = "Select a case";
    return;
  }

  els.emptyState.classList.add("hidden");
  els.caseContent.classList.remove("hidden");
  els.caseTitle.textContent = `User ${caseItem.user_id}`;

  const history = caseItem.history || [];
  els.historyCount.textContent = `${history.length} items`;
  els.historyTrack.innerHTML = "";
  history.forEach((item, index) => {
    els.historyTrack.appendChild(createItemCard(item, { rankLabel: historyTimeLabel(item, index, history.length) }));
  });

  const groundTruth = caseItem.ground_truth;
  els.groundTruthRank.textContent = `Rank ${groundTruth?.rank ?? "n/a"}`;
  els.groundTruthCard.innerHTML = "";
  if (groundTruth) {
    els.groundTruthCard.appendChild(createItemCard(groundTruth, { className: "gt" }));
  }

  const predictions = (caseItem.predictions || []).slice(0, 5);
  const topK = state.data?.top_k ?? predictions.length;
  const hit = predictions.find((item) => item.is_ground_truth);
  els.predictionSummary.textContent = hit
    ? `Ground truth surfaced at #${hit.rank} of ${topK}`
    : `Top ${predictions.length} candidates · ground truth outside top-${topK}`;
  els.predictionList.innerHTML = "";
  predictions.forEach((item) => els.predictionList.appendChild(createItemCard(item, { showRankBadge: true })));
}

function render() {
  if (!state.data) {
    els.emptyState.classList.remove("hidden");
    els.caseContent.classList.add("hidden");
    return;
  }
  const data = state.data;
  const topK = data.top_k ?? "n/a";
  const parts = [];
  if (data.domain) parts.push(data.domain);
  parts.push(`${data.num_cases ?? (data.cases?.length || 0)} cases`);
  if (data.eval_mode) parts.push(data.eval_mode);
  parts.push(`Top-${topK}`);
  if (data.mask_history) parts.push("mask history");
  els.datasetMeta.textContent = parts.join(" · ");
  updateDemoStats(data);

  populateFilterOptions(data);
  renderRankDistribution(data);
  renderCaseList();
  renderCase(state.cases[state.selectedIndex]);
}

function updateDemoStats(data) {
  const cases = data?.cases || [];
  if (els.statCases) els.statCases.textContent = String(cases.length);
  if (els.statDomain) els.statDomain.textContent = shortText(data?.domain || data?.dataset, "Unknown");
  if (els.statTopK) els.statTopK.textContent = String(data?.top_k ?? "n/a");
}

function setData(data, assetBase = "") {
  state.data = data;
  state.assetBase = assetBase;
  // The exported JSON's `domain` field is hard-coded for all datasets —
  // override it with the label of the currently selected tab so each
  // dataset shows its own name in the meta line and stats box.
  const dataset = DATASETS.find((d) => d.key === state.datasetKey);
  if (dataset && state.data) state.data.domain = dataset.label;
  state.selectedIndex = 0;
  state.filter = "all";
  render();
}

async function loadDataset(datasetKey) {
  const dataset = DATASETS.find((d) => d.key === datasetKey) || DATASETS[0];
  state.datasetKey = dataset.key;
  renderDatasetTabs();
  els.datasetMeta.textContent = `Loading ${dataset.label}…`;

  const errors = [];
  for (const exportPath of dataset.candidates) {
    try {
      const response = await fetch(exportPath, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const assetBase = new URL(".", new URL(exportPath, window.location.href)).href;
      setData(await response.json(), assetBase);
      return;
    } catch (error) {
      errors.push(`${exportPath} (${error.message})`);
    }
  }
  state.data = null;
  els.datasetMeta.textContent = `Failed to load ${dataset.label}`;
  if (els.emptyState) {
    els.emptyState.querySelector("p").innerHTML = `
      Failed to load the case-study JSON for <strong>${dataset.label}</strong>.
      Start the static server from the project root, or deploy
      <code>case_study/${dataset.key}/</code> with this page.
      Tried: <code>${errors.join("</code>, <code>")}</code>.
    `;
  }
  render();
}

function renderDatasetTabs() {
  if (!els.datasetTabs) return;
  els.datasetTabs.innerHTML = "";
  for (const dataset of DATASETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `dataset-tab${dataset.key === state.datasetKey ? " active" : ""}`;
    button.textContent = dataset.label;
    button.addEventListener("click", () => {
      if (dataset.key === state.datasetKey) return;
      loadDataset(dataset.key);
    });
    els.datasetTabs.appendChild(button);
  }
}

els.caseFilter.addEventListener("change", (event) => {
  state.filter = event.target.value;
  state.selectedIndex = 0;
  render();
});

renderDatasetTabs();
loadDataset(state.datasetKey);
