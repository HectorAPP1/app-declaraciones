import { createItemRow, collectItems } from "./components/items.js";

const API_BASE = "http://127.0.0.1:5000/api";

const form = document.getElementById("invoice-form");
const tableBody = document.getElementById("invoice-table");
const filterType = document.getElementById("filter-type");
const filterYear = document.getElementById("filter-year");
const filterMonth = document.getElementById("filter-month");
const filterBtn = document.getElementById("filter-btn");
const itemsContainer = document.getElementById("items-container");
const addItemBtn = document.getElementById("add-item");
const fileInput = form.querySelector('input[name="document"]');
const typeSelect = form.querySelector('select[name="type"]');
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const analyticsYearInput = document.getElementById("analytics-year");
const quickYearButtonsContainer = document.getElementById("quick-year-buttons");
const analyticsRefreshBtn = document.getElementById("analytics-refresh");
const analyticsRangeGroup = document.getElementById("analytics-range-group");
const analyticsFocusSelect = document.getElementById("analytics-focus");
const analyticsTotalAmount = document.getElementById("analytics-total-amount");
const analyticsAmountDelta = document.getElementById("analytics-amount-delta");
const analyticsTotalTons = document.getElementById("analytics-total-tons");
const analyticsRecShare = document.getElementById("analytics-rec-share");
const analyticsRadialValue = document.getElementById("analytics-radial-value");
const cards = {
  dom: {
    amount: document.querySelector("#card-dom-amount .value"),
    tons: document.querySelector("#card-dom-tons .value"),
  },
  rec: {
    amount: document.querySelector("#card-rec-amount .value"),
    tons: document.querySelector("#card-rec-tons .value"),
  },
};
const modal = document.getElementById("invoice-modal");
const openModalBtn = document.getElementById("open-modal");
const closeModalBtn = document.getElementById("close-modal");
const navLinks = document.querySelectorAll(".nav-link");
const views = document.querySelectorAll(".view");
const lastSyncLabel = document.getElementById("last-sync");
const analyticsCategoryTable = document.getElementById("analytics-category-table");

const charts = {
  domAmount: null,
  domTons: null,
  recAmount: null,
  recCategories: null,
  analyticsArea: null,
  analyticsDonut: null,
  analyticsBar: null,
  analyticsRadial: null,
};

let currentInvoices = [];
let editingInvoiceId = null;
let currentAnalytics = null;
let analyticsRange = 3;
let analyticsFocus = "combined";
const ANALYTICS_GOAL_TONS = 120;

async function fetchInvoices(params = {}) {
  const query = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}/invoices?${query.toString()}`);
  if (!res.ok) {
    throw new Error("No se pudo obtener facturas");
  }
  return res.json();
}

function updateAnalyticsKpis(data) {
  const combined = combineMonthlySeries(data);
  const totalAmount = combined.reduce((sum, item) => sum + item.domAmount + item.recAmount, 0);
  const totalTons = combined.reduce((sum, item) => sum + item.domTons + item.recTons, 0);
  const totalRecTons = combined.reduce((sum, item) => sum + item.recTons, 0);
  const delta = calculateAmountDelta(combined);
  if (analyticsTotalAmount) analyticsTotalAmount.textContent = formatCurrency(totalAmount);
  if (analyticsAmountDelta) analyticsAmountDelta.textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
  if (analyticsTotalTons) analyticsTotalTons.textContent = `${totalTons.toFixed(2)} t`;
  if (analyticsRecShare) analyticsRecShare.textContent = totalTons ? `${((totalRecTons / totalTons) * 100).toFixed(1)}%` : "0%";
}

function calculateAmountDelta(monthlySeries) {
  const combined = monthlySeries ?? combineMonthlySeries(currentAnalytics || { domiciliary: { monthly: [] }, recyclable: { monthly: [] } });
  if (combined.length < 2) return 0;
  const amounts = combined.map((item) => item.domAmount + item.recAmount);
  const last = amounts[amounts.length - 1] ?? 0;
  const prev = amounts[amounts.length - 2] ?? 0;
  if (prev === 0) return last === 0 ? 0 : 100;
  return ((last - prev) / prev) * 100;
}

function renderAnalyticsCharts() {
  if (!currentAnalytics) return;
  const monthly = combineMonthlySeries(currentAnalytics);
  const sliced = sliceByRange(monthly, analyticsRange);
  updateAnalyticsAreaChart(sliced, analyticsFocus);
  updateAnalyticsBarChart(sliced, analyticsFocus);
  updateDonutChart(currentAnalytics.recyclable.categories);
  updateAnalyticsRadialChart(currentAnalytics, monthly);
  renderAnalyticsTable(currentAnalytics.recyclable.categories);
}

function combineMonthlySeries(data) {
  const dom = data.domiciliary.monthly;
  const rec = data.recyclable.monthly;
  return dom.map((domMonth, index) => ({
    month: domMonth.month,
    domAmount: domMonth.amount,
    domTons: domMonth.tons,
    recAmount: rec[index]?.amount ?? 0,
    recTons: rec[index]?.tons ?? 0,
  }));
}

function sliceByRange(monthly, range) {
  if (!monthly.length) return monthly;
  const nonZero = monthly.filter((item) => item.domAmount + item.recAmount + item.domTons + item.recTons > 0);
  if (nonZero.length >= range) {
    return nonZero.slice(-range);
  }
  if (nonZero.length > 0) {
    return nonZero;
  }
  return monthly.slice(-range);
}

function updateAnalyticsAreaChart(monthly, focus) {
  const labels = monthly.map((item) => MONTH_NAMES[item.month - 1]);
  let datasets;
  if (focus === "combined") {
    datasets = [
      {
        label: "Domiciliarios",
        data: monthly.map((item) => item.domAmount),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        fill: true,
        tension: 0.35,
      },
      {
        label: "Reciclables",
        data: monthly.map((item) => item.recAmount),
        borderColor: "#34d399",
        backgroundColor: "rgba(52, 211, 153, 0.15)",
        fill: true,
        tension: 0.35,
      },
    ];
  } else {
    const mapKey = focus === "domiciliary" ? "domAmount" : "recAmount";
    const colors = focus === "domiciliary" ? ["#6366f1", "rgba(99, 102, 241, 0.18)"] : ["#34d399", "rgba(52, 211, 153, 0.2)"];
    datasets = [
      {
        label: focus === "domiciliary" ? "Domiciliarios" : "Reciclables",
        data: monthly.map((item) => item[mapKey]),
        borderColor: colors[0],
        backgroundColor: colors[1],
        fill: true,
        tension: 0.35,
      },
    ];
  }
  charts.analyticsArea = renderChart(
    charts.analyticsArea,
    "chart-analytics-area",
    "line",
    { labels, datasets },
    {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(148,163,184,0.2)" } },
      },
    }
  );
}

function updateAnalyticsBarChart(monthly, focus) {
  const labels = monthly.map((item) => MONTH_NAMES[item.month - 1]);
  const values = monthly.map((item) => {
    if (focus === "domiciliary") return item.domAmount;
    if (focus === "recyclable") return item.recAmount;
    return item.domAmount + item.recAmount;
  });
  charts.analyticsBar = renderChart(
    charts.analyticsBar,
    "chart-analytics-bar",
    "bar",
    {
      labels,
      datasets: [
        {
          label: "Gasto (CLP)",
          data: values,
          backgroundColor: "rgba(99,102,241,0.8)",
          borderRadius: 6,
        },
      ],
    },
    {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(148,163,184,0.25)" } },
      },
    }
  );
}

function updateAnalyticsRadialChart(data, monthlySeries) {
  const monthly = monthlySeries ?? combineMonthlySeries(data);
  const totalRecTons = monthly.reduce((sum, item) => sum + item.recTons, 0);
  const totalTons = monthly.reduce((sum, item) => sum + item.domTons + item.recTons, 0);
  const progress = ANALYTICS_GOAL_TONS ? Math.min(totalRecTons / ANALYTICS_GOAL_TONS, 1) : 0;
  const value = Math.round(progress * 100);
  if (analyticsRadialValue) analyticsRadialValue.textContent = `${value}%`;
  charts.analyticsRadial = renderChart(
    charts.analyticsRadial,
    "chart-analytics-radial",
    "doughnut",
    {
      labels: ["Logrado", "Pendiente"],
      datasets: [
        {
          data: [value, 100 - value],
          backgroundColor: ["#38bdf8", "#e2e8f0"],
          borderWidth: 0,
          cutout: "70%",
          circumference: 240,
          rotation: 240,
        },
      ],
    },
    {
      plugins: { legend: { display: false } },
    }
  );
  if (analyticsRecShare) {
    const share = totalTons ? (data.recyclable.totals.tons / totalTons) * 100 : 0;
    analyticsRecShare.textContent = `${share.toFixed(1)}%`;
  }
}

function updateAreaChart(data) {
  const labels = data.domiciliary.monthly.map((month) => MONTH_NAMES[month.month - 1]);
  const dataset = {
    labels,
    datasets: [
      {
        label: "Domiciliarios",
        data: data.domiciliary.monthly.map((month) => month.amount),
        borderColor: "#6c5ce7",
        backgroundColor: "rgba(108, 92, 231, 0.25)",
        fill: true,
        tension: 0.4,
      },
      {
        label: "Reciclables",
        data: data.recyclable.monthly.map((month) => month.amount),
        borderColor: "#ff9f43",
        backgroundColor: "rgba(255, 159, 67, 0.2)",
        fill: true,
        tension: 0.4,
      },
    ],
  };
  charts.analyticsArea = renderChart(
    charts.analyticsArea,
    "chart-analytics-area",
    "line",
    dataset,
    {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { grid: { display: false } } },
    }
  );
}

function updateDonutChart(categories) {
  const labels = categories.map((item) => item.label);
  const data = categories.map((item) => item.tons);
  const colors = ["#6c5ce7", "#ff9f43", "#1dd1a1", "#2e86de", "#ee5253", "#222f3e", "#48dbfb", "#ff6b6b", "#54a0ff", "#feca57"];
  const dataset = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: labels.map((_, index) => colors[index % colors.length]),
        borderWidth: 1,
      },
    ],
  };
  charts.analyticsDonut = renderChart(
    charts.analyticsDonut,
    "chart-analytics-donut",
    "doughnut",
    dataset,
    {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      cutout: "55%",
    }
  );
}

function renderChart(existingChart, canvasId, type, data, options) {
  const ctx = document.getElementById(canvasId);
  if (existingChart) {
    existingChart.data = data;
    existingChart.options = options;
    existingChart.update();
    return existingChart;
  }
  return new Chart(ctx, { type, data, options });
}

function renderAnalyticsTable(categories) {
  analyticsCategoryTable.innerHTML = "";
  categories.forEach((category) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${category.label}</td>
      <td>${category.tons.toFixed(2)} t</td>
      <td>${formatCurrency(category.amount)}</td>
    `;
    analyticsCategoryTable.appendChild(row);
  });
}

function updateLastSync() {
  if (!lastSyncLabel) return;
  const now = new Date();
  lastSyncLabel.textContent = new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now);
}

function initNavigation() {
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.dataset.viewTarget;
      setActiveView(target);
      navLinks.forEach((l) => l.classList.toggle("active", l === link));
    });
  });
}

function initAnalyticsControls() {
  if (analyticsRangeGroup) {
    analyticsRangeGroup.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      analyticsRange = Number(button.dataset.range) || 3;
      analyticsRangeGroup.querySelectorAll(".chip").forEach((chip) => {
        chip.classList.toggle("active", chip === button);
      });
      renderAnalyticsCharts();
    });
  }
  if (analyticsFocusSelect) {
    analyticsFocusSelect.addEventListener("change", (event) => {
      analyticsFocus = event.target.value;
      renderAnalyticsCharts();
    });
  }
}

function setActiveView(viewName) {
  views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewName);
  });
}

function populateYearOptions() {
  const currentYear = new Date().getFullYear();
  analyticsYearInput.innerHTML = "";
  for (let year = currentYear; year >= currentYear - 5; year -= 1) {
    const option = document.createElement("option");
    option.value = year.toString();
    option.textContent = year;
    analyticsYearInput.appendChild(option);
  }
  analyticsYearInput.value = currentYear.toString();
  renderQuickYearButtons(currentYear);
}

function renderQuickYearButtons(currentYear) {
  if (!quickYearButtonsContainer) return;
  quickYearButtonsContainer.innerHTML = "";
  for (let offset = 0; offset < 4; offset += 1) {
    const year = currentYear - offset;
    const button = document.createElement("button");
    button.textContent = year;
    button.dataset.year = year.toString();
    button.addEventListener("click", () => {
      analyticsYearInput.value = year.toString();
      highlightQuickYear(button);
      refreshAnalytics();
    });
    quickYearButtonsContainer.appendChild(button);
    if (offset === 0) {
      highlightQuickYear(button);
    }
  }
}

function highlightQuickYear(activeButton) {
  quickYearButtonsContainer.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

async function loadInvoices() {
  const params = {};
  if (filterType.value) params.type = filterType.value;
  if (filterYear.value) params.year = filterYear.value;
  const selectedMonth = filterMonth.value;
  if (selectedMonth) params.month = selectedMonth;
  try {
    const invoices = await fetchInvoices(params);
    currentInvoices = invoices;
    renderTable(invoices);
  } catch (error) {
    alert(error.message);
  }
}

function renderTable(invoices) {
  tableBody.innerHTML = "";
  invoices.forEach((invoice) => {
    const row = document.createElement("tr");
    const tons = getInvoiceTons(invoice);
    row.innerHTML = `
      <td>${invoice.number}</td>
      <td>${invoice.provider}</td>
      <td>${invoice.date}</td>
      <td>${invoice.type}</td>
      <td>${invoice.totals?.total ?? invoice.aggregates?.total_amount ?? "-"}</td>
      <td>${tons ? tons.toFixed(3) : "-"}</td>
      <td class="actions" data-id="${invoice.id}">
        <button class="edit" data-id="${invoice.id}">Editar</button>
        <button class="delete" data-id="${invoice.id}">Eliminar</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderItems(items = [], type = typeSelect.value) {
  itemsContainer.innerHTML = "";
  if (!items.length) {
    itemsContainer.appendChild(createItemRow(type));
    return;
  }
  items.forEach((item) => {
    itemsContainer.appendChild(createItemRow(type, item));
  });
}

function resetFormState() {
  form.reset();
  editingInvoiceId = null;
  submitBtn.textContent = "Guardar";
  cancelEditBtn.hidden = true;
  renderItems([], typeSelect.value);
  fileInput.value = "";
}

function openModal() {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(reset = false) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (reset) {
    resetFormState();
  }
}

function getInvoiceTons(invoice) {
  const aggregates = invoice.aggregates || {};
  const residueTotals = aggregates.residue_totals || {};
  if (!Object.keys(residueTotals).length) return 0;
  if (invoice.type === "domiciliary") {
    return residueTotals.relleno_sanitario ?? Object.values(residueTotals).reduce((sum, value) => sum + value, 0);
  }
  return Object.values(residueTotals).reduce((sum, value) => sum + value, 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value || 0);
}

addItemBtn.addEventListener("click", () => {
  itemsContainer.appendChild(createItemRow(typeSelect.value));
});

typeSelect.addEventListener("change", () => {
  renderItems([], typeSelect.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = {
    number: formData.get("number"),
    provider: formData.get("provider"),
    date: formData.get("date"),
    currency: formData.get("currency"),
    type: formData.get("type"),
    items: collectItems(itemsContainer),
    totals: {
      subtotal: parseFloat(formData.get("subtotal") || "0"),
      tax: parseFloat(formData.get("tax") || "0"),
      total: parseFloat(formData.get("total") || "0"),
    },
  };

  try {
    const url = editingInvoiceId
      ? `${API_BASE}/invoices/${editingInvoiceId}`
      : `${API_BASE}/invoices`;
    const method = editingInvoiceId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(errorBody.error || "Error guardando factura");
    }
    const invoice = await res.json();

    if (fileInput.files.length) {
      const uploadData = new FormData();
      uploadData.append("file", fileInput.files[0]);
      const targetId = invoice.id || editingInvoiceId;
      const uploadRes = await fetch(`${API_BASE}/invoices/${targetId}/document`, {
        method: "POST",
        body: uploadData,
      });
      if (!uploadRes.ok) {
        const errorBody = await uploadRes.json();
        throw new Error(errorBody.error || "No se pudo subir el documento");
      }
    }

    resetFormState();
    closeModal();
    await loadInvoices();
  } catch (error) {
    alert(error.message);
  }
});

filterBtn.addEventListener("click", loadInvoices);

tableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { id } = button.dataset;
  if (!id) return;

  if (button.classList.contains("edit")) {
    const invoice = currentInvoices.find((item) => item.id === id);
    if (invoice) {
      setEditingInvoice(invoice);
    }
  } else if (button.classList.contains("delete")) {
    const confirmed = confirm("¿Eliminar esta factura?");
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorBody = await res.json();
        throw new Error(errorBody.error || "No se pudo eliminar");
      }
      if (editingInvoiceId === id) {
        resetFormState();
      }
      await loadInvoices();
    } catch (error) {
      alert(error.message);
    }
  }
});

cancelEditBtn.addEventListener("click", () => {
  resetFormState();
});

function setEditingInvoice(invoice) {
  editingInvoiceId = invoice.id;
  submitBtn.textContent = "Actualizar";
  cancelEditBtn.hidden = false;
  form.number.value = invoice.number || "";
  form.provider.value = invoice.provider || "";
  form.date.value = invoice.date || "";
  form.currency.value = invoice.currency || "CLP";
  typeSelect.value = invoice.type || "domiciliary";
  const totals = invoice.totals || {};
  form.subtotal.value = totals.subtotal ?? "";
  form.tax.value = totals.tax ?? "";
  form.total.value = totals.total ?? "";
  renderItems(invoice.items || [], typeSelect.value);
  openModal();
}

document.addEventListener("DOMContentLoaded", () => {
  resetFormState();
  populateYearOptions();
  loadInvoices();
  refreshAnalytics();
  initNavigation();
  updateLastSync();
  initAnalyticsControls();
});

analyticsRefreshBtn.addEventListener("click", () => {
  refreshAnalytics();
});

openModalBtn.addEventListener("click", () => {
  resetFormState();
  openModal();
});

closeModalBtn.addEventListener("click", () => closeModal(true));

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal(true);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) {
    closeModal(true);
  }
});

async function refreshAnalytics() {
  const year = analyticsYearInput.value;
  try {
    const data = await fetchAnalytics(year);
    updateDashboard(data);
  } catch (error) {
    console.error(error);
    alert("No se pudo cargar el dashboard");
  }
}

async function fetchAnalytics(year) {
  const query = year ? `?year=${year}` : "";
  const res = await fetch(`${API_BASE}/analytics${query}`);
  if (!res.ok) {
    throw new Error("Error al obtener analytics");
  }
  return res.json();
}

function updateDashboard(data) {
  const domTotals = data.domiciliary.totals;
  const recTotals = data.recyclable.totals;
  cards.dom.amount.textContent = formatCurrency(domTotals.amount);
  cards.dom.tons.textContent = `${domTotals.tons.toFixed(2)} t`;
  cards.rec.amount.textContent = formatCurrency(recTotals.amount);
  cards.rec.tons.textContent = `${recTotals.tons.toFixed(2)} t`;

  updateLineChart(
    "domAmount",
    "chart-dom-amount",
    data.domiciliary.monthly.map((month) => month.month),
    data.domiciliary.monthly.map((month) => month.amount),
    "Gasto (CLP)"
  );
  updateLineChart(
    "domTons",
    "chart-dom-tons",
    data.domiciliary.monthly.map((month) => month.month),
    data.domiciliary.monthly.map((month) => month.tons),
    "Toneladas"
  );
  updateLineChart(
    "recAmount",
    "chart-rec-amount",
    data.recyclable.monthly.map((month) => month.month),
    data.recyclable.monthly.map((month) => month.amount),
    "Gasto (CLP)"
  );
  updateLineChart(
    "recTons",
    "chart-rec-tons",
    data.recyclable.monthly.map((month) => month.month),
    data.recyclable.monthly.map((month) => month.tons),
    "Toneladas"
  );
  updateBarChart(
    "recCategories",
    "chart-rec-categories",
    data.recyclable.categories.map((item) => item.label),
    data.recyclable.categories.map((item) => item.tons)
  );

  updateAreaChart(data);
  updateDonutChart(data.recyclable.categories);
  renderAnalyticsTable(data.recyclable.categories);
  updateLastSync();
}

function updateLineChart(key, canvasId, labels, data, label) {
  const ctx = document.getElementById(canvasId);
  const dataset = {
    labels: labels.map((month) => MONTH_NAMES[month - 1]),
    datasets: [
      {
        label,
        data,
        borderColor: "#1b84f1",
        backgroundColor: "rgba(27,132,241,0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };
  if (charts[key]) {
    charts[key].data = dataset;
    charts[key].update();
  } else {
    charts[key] = new Chart(ctx, {
      type: "line",
      data: dataset,
      options: {
        responsive: true,
        scales: {
          x: { grid: { display: false } },
        },
      },
    });
  }
}

function updateBarChart(key, canvasId, labels, data) {
  const ctx = document.getElementById(canvasId);
  const dataset = {
    labels,
    datasets: [
      {
        label: "Toneladas",
        data,
        backgroundColor: "#10b981",
      },
    ],
  };
  if (charts[key]) {
    charts[key].data = dataset;
    charts[key].update();
  } else {
    charts[key] = new Chart(ctx, {
      type: "bar",
      data: dataset,
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
      },
    });
  }
}

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
