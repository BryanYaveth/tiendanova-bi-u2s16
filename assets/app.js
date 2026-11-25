/* TiendaNova · Dashboard ejecutivo U2S16
   Datos: window.TN_DATA (assets/data.js)
   Motor de gráficos: Chart.js 4 (assets/chart.umd.min.js) */

(function () {
  "use strict";

  const DATA = window.TN_DATA;
  if (!DATA || !Array.isArray(DATA.transacciones)) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="padding:24px;font:16px Segoe UI,sans-serif;background:#fff3cd;color:#664d03">No se encontró el archivo de datos. Abre la página desde la carpeta completa del dashboard.</div>'
    );
    return;
  }

  const TX = DATA.transacciones;
  const EMBUDO = DATA.embudo;
  const SOCIAL = DATA.social;

  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun"];
  const MONTH_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio"];

  const CHANNEL_COLORS = {
    Marketplace: "#0b6e99",
    "Sitio web": "#0e9f6e",
    "App móvil": "#d99a2b",
    "Tienda física": "#7c5cbf",
    "Campaña Email": "#d95d39",
    "Campaña Social Ads": "#64748b"
  };

  const DEVICE_COLORS = {
    Móvil: "#0b6e99",
    Escritorio: "#0e9f6e",
    Tablet: "#d99a2b",
    "No especificado": "#94a3b8"
  };

  const SOCIAL_COLORS = {
    Instagram: "#c13584",
    Facebook: "#1877f2",
    TikTok: "#111827"
  };

  const money = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const money0 = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  });
  const num = new Intl.NumberFormat("es-MX");
  const pct = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const sum = (arr, fn) => arr.reduce((a, b) => a + fn(b), 0);
  const mean = (arr, fn) => (arr.length ? sum(arr, fn) / arr.length : 0);
  const round2 = (n) => Math.round(n * 100) / 100;

  function monthOf(fecha) {
    return Number(fecha.slice(5, 7)) - 1;
  }

  function monthLabel(fecha) {
    return MONTHS[monthOf(fecha)];
  }

  function formatDate(fecha) {
    const d = new Date(fecha + "T12:00:00");
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  }

  function groupBy(rows, keyFn) {
    const map = new Map();
    for (const row of rows) {
      const key = keyFn(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return map;
  }

  function sumBy(rows, keyFn, valFn) {
    const map = new Map();
    for (const row of rows) {
      const key = keyFn(row);
      map.set(key, (map.get(key) || 0) + valFn(row));
    }
    return map;
  }

  function sortedEntries(map, dir) {
    return Array.from(map.entries()).sort((a, b) => (dir === "asc" ? a[1] - b[1] : b[1] - a[1]));
  }

  function setText(sel, value) {
    const el = $(sel);
    if (el) el.textContent = value;
  }

  /* ------------------------------------------------------------------ */
  /* Charts                                                             */
  /* ------------------------------------------------------------------ */

  const charts = {};

  function chartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#5b6b82";
    Chart.defaults.borderColor = "#e6eef7";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = "#0b1f3a";
    Chart.defaults.plugins.tooltip.padding = 11;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: "700" };
    Chart.defaults.animation.duration = 500;
  }

  function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return null;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas.getContext("2d"), config);
    return charts[id];
  }

  const valueLabels = {
    id: "valueLabels",
    afterDatasetsDraw(chart, args, opts) {
      if (!opts || !opts.enabled) return;
      const ctx = chart.ctx;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      const horizontal = chart.options.indexAxis === "y";
      meta.data.forEach((el, i) => {
        const value = dataset.data[i];
        if (value == null) return;
        const text = opts.formatter ? opts.formatter(value) : String(value);
        ctx.save();
        ctx.fillStyle = opts.color || "#17233a";
        ctx.font = "700 11px " + getComputedStyle(document.body).fontFamily;
        if (horizontal) {
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const x = el.x + 8;
          const y = el.y;
          const width = ctx.measureText(text).width;
          if (x + width > chart.chartArea.right) {
            ctx.textAlign = "right";
            ctx.fillText(text, el.x - 8, y);
          } else {
            ctx.fillText(text, x, y);
          }
        } else {
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(text, el.x, el.y - 7);
        }
        ctx.restore();
      });
    }
  };

  const currencyTooltip = {
    callbacks: {
      label(ctx) {
        const v = ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed.x;
        return " " + money.format(v);
      }
    }
  };

  function lineConfig(labels, values, label) {
    return {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            borderColor: "#0e7c86",
            backgroundColor: (context) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return "rgba(14,124,134,.12)";
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, "rgba(14,124,134,.26)");
              gradient.addColorStop(1, "rgba(14,124,134,.01)");
              return gradient;
            },
            fill: true,
            tension: 0.34,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "#0e7c86",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            borderWidth: 2.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: currencyTooltip
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0 } },
          y: {
            beginAtZero: true,
            grid: { color: "#edf2f8" },
            ticks: { callback: (v) => money0.format(v) }
          }
        }
      }
    };
  }

  function barConfig(labels, values, colors, label, horizontal) {
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            backgroundColor: colors,
            borderRadius: 7,
            borderSkipped: false,
            maxBarThickness: 26
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? "y" : "x",
        layout: { padding: { right: horizontal ? 54 : 0, top: 18 } },
        plugins: {
          legend: { display: false },
          tooltip: currencyTooltip,
          valueLabels: {
            enabled: true,
            formatter: (v) => money0.format(v)
          }
        },
        scales: horizontal
          ? {
              x: {
                beginAtZero: true,
                grid: { color: "#edf2f8" },
                ticks: { callback: (v) => money0.format(v) }
              },
              y: { grid: { display: false } }
            }
          : {
              x: { grid: { display: false } },
              y: {
                beginAtZero: true,
                grid: { color: "#edf2f8" },
                ticks: { callback: (v) => money0.format(v) }
              }
            }
      },
      plugins: [valueLabels]
    };
  }

  /* ------------------------------------------------------------------ */
  /* Summary                                                            */
  /* ------------------------------------------------------------------ */

  function renderSummary() {
    const total = sum(TX, (r) => r.m);
    const cost = sum(TX, (r) => r.k);
    const margin = total - cost;
    const orders = TX.length;
    const ticket = total / orders;
    const mobile = TX.filter((r) => r.d === "Móvil").length;
    const mobileShare = (mobile / orders) * 100;
    const vistas = EMBUDO[0].usuarios;
    const compras = EMBUDO[EMBUDO.length - 1].usuarios;
    const conv = (compras / vistas) * 100;
    const drop = 100 - (EMBUDO[1].usuarios / EMBUDO[0].usuarios) * 100;

    setText("#kpiVentas", money.format(total));
    setText("#kpiPedidos", num.format(orders));
    setText("#kpiTicket", money.format(ticket));
    setText("#kpiMargen", money.format(margin));
    setText("#kpiMargenPct", "Margen " + pct.format((margin / total) * 100) + " % · CAC " + money0.format(cost));
    setText("#kpiConversion", pct.format(conv) + " %");
    setText("#kpiAbandono", pct.format(drop) + " %");
    setText("#kpiMovil", pct.format(mobileShare) + " %");

    const months = MONTHS.map((_, i) => sum(TX.filter((r) => monthOf(r.f) === i), (r) => r.m));
    makeChart("monthlyChart", lineConfig(MONTHS, months, "Ventas"));

    const byChannel = sortedEntries(sumBy(TX, (r) => r.c, (r) => r.m), "desc");
    makeChart(
      "channelChart",
      barConfig(
        byChannel.map((e) => e[0]),
        byChannel.map((e) => round2(e[1])),
        byChannel.map((e) => CHANNEL_COLORS[e[0]] || "#64748b"),
        "Ventas",
        true
      )
    );

    const byDevice = sortedEntries(sumBy(TX, (r) => r.d, (r) => r.m), "desc");
    makeChart("deviceChart", {
      type: "doughnut",
      data: {
        labels: byDevice.map((e) => e[0]),
        datasets: [
          {
            data: byDevice.map((e) => round2(e[1])),
            backgroundColor: byDevice.map((e) => DEVICE_COLORS[e[0]] || "#94a3b8"),
            borderColor: "#fff",
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label(ctx) {
                const totalDevice = sum(ctx.dataset.data, (v) => v);
                const share = (ctx.parsed / totalDevice) * 100;
                return " " + money.format(ctx.parsed) + " · " + pct.format(share) + " %";
              }
            }
          }
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Transactional view                                                 */
  /* ------------------------------------------------------------------ */

  const state = { mes: "all", canal: "all", dispositivo: "all", producto: "all" };

  function filteredRows() {
    return TX.filter((r) => {
      if (state.mes !== "all" && r.f.slice(0, 7) !== state.mes) return false;
      if (state.canal !== "all" && r.c !== state.canal) return false;
      if (state.dispositivo !== "all" && r.d !== state.dispositivo) return false;
      if (state.producto !== "all" && r.p !== state.producto) return false;
      return true;
    });
  }

  function renderTransactionKPIs() {
    const rows = filteredRows();
    const total = sum(rows, (r) => r.m);
    const cost = sum(rows, (r) => r.k);
    const orders = rows.length;
    const ticket = orders ? total / orders : 0;
    const share = TX.length ? (orders / TX.length) * 100 : 0;

    setText("#fVentas", money.format(total));
    setText("#fPedidos", num.format(orders));
    setText("#fTicket", money.format(ticket));
    setText("#fCac", money.format(cost));
    setText("#filterStatus", "Mostrando " + num.format(orders) + " de " + num.format(TX.length) + " transacciones (" + pct.format(share) + " %).");
    const status = $("#filterStatus");
    if (status) status.setAttribute("aria-live", "polite");
  }

  function renderTransactionCharts() {
    const rows = filteredRows();

    const months = MONTHS.map((_, i) => sum(rows.filter((r) => monthOf(r.f) === i), (r) => r.m));
    makeChart("filteredMonthlyChart", lineConfig(MONTHS, months, "Ventas filtradas"));

    const byChannel = sortedEntries(sumBy(rows, (r) => r.c, (r) => r.m), "desc");
    makeChart(
      "filteredChannelChart",
      barConfig(
        byChannel.map((e) => e[0]),
        byChannel.map((e) => round2(e[1])),
        byChannel.map((e) => CHANNEL_COLORS[e[0]] || "#64748b"),
        "Ventas",
        true
      )
    );

    const byProduct = sortedEntries(sumBy(rows, (r) => r.p, (r) => r.m), "desc");
    makeChart("productChart", {
      type: "bar",
      data: {
        labels: byProduct.map((e) => e[0]),
        datasets: [
          {
            label: "Ventas",
            data: byProduct.map((e) => round2(e[1])),
            backgroundColor: ["#0b6e99", "#0e9f6e", "#d99a2b", "#7c5cbf", "#d95d39"],
            borderRadius: 7,
            borderSkipped: false,
            maxBarThickness: 38
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: false },
          tooltip: currencyTooltip,
          valueLabels: { enabled: true, formatter: (v) => money0.format(v) }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: "#edf2f8" },
            ticks: { callback: (v) => money0.format(v) }
          }
        }
      },
      plugins: [valueLabels]
    });

    const channels = Array.from(new Set(rows.map((r) => r.c)));
    const datasets = channels.map((channel) => ({
      label: channel,
      data: rows
        .filter((r) => r.c === channel)
        .map((r) => ({ x: r.k, y: r.m, meta: r })),
      backgroundColor: (CHANNEL_COLORS[channel] || "#64748b") + "cc",
      borderColor: CHANNEL_COLORS[channel] || "#64748b",
      borderWidth: 1,
      pointRadius: 3.4,
      pointHoverRadius: 6
    }));

    makeChart("scatterChart", {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 8, padding: 10 } },
          tooltip: {
            callbacks: {
              title(items) {
                const raw = items[0].raw;
                return raw && raw.meta ? formatDate(raw.meta.f) + " · " + raw.meta.c : "";
              },
              label(ctx) {
                const raw = ctx.raw;
                if (!raw || !raw.meta) return "";
                return [
                  " Producto: " + raw.meta.p,
                  " Monto: " + money.format(raw.meta.m),
                  " CAC: " + money.format(raw.meta.k)
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: "Costo de adquisición (CAC)" },
            grid: { color: "#edf2f8" },
            ticks: { callback: (v) => money0.format(v) }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Monto de venta" },
            grid: { color: "#edf2f8" },
            ticks: { callback: (v) => money0.format(v) }
          }
        }
      }
    });
  }

  function renderTopDates() {
    const rows = filteredRows();
    const byDate = new Map();
    for (const r of rows) {
      if (!byDate.has(r.f)) byDate.set(r.f, { total: 0, orders: 0, flagged: 0 });
      const item = byDate.get(r.f);
      item.total += r.m;
      item.orders += 1;
      if (r.r) item.flagged += 1;
    }
    const total = sum(rows, (r) => r.m);
    const top = Array.from(byDate.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6);

    const tbody = $("#topDatesBody");
    if (!tbody) return;
    tbody.innerHTML = top
      .map(([fecha, item]) => {
        const share = total ? (item.total / total) * 100 : 0;
        const tag = item.flagged
          ? '<span class="tag">Revisar · ' + item.flagged + "</span>"
          : '<span class="tag tag--ok">OK</span>';
        return (
          "<tr><td>" +
          formatDate(fecha) +
          '</td><td class="num">' +
          num.format(item.orders) +
          '</td><td class="num">' +
          money.format(item.total) +
          '</td><td class="num">' +
          pct.format(share) +
          "%</td><td>" +
          tag +
          "</td></tr>"
        );
      })
      .join("");
  }

  function renderFlagged() {
    const rows = TX.filter((r) => r.r);
    const tbody = $("#flaggedBody");
    if (!tbody) return;
    tbody.innerHTML = rows
      .map(
        (r) =>
          "<tr><td>" +
          formatDate(r.f) +
          "</td><td>" +
          r.c +
          "</td><td>" +
          r.p +
          "</td><td>" +
          r.d +
          '</td><td class="num">' +
          money.format(r.m) +
          "</td></tr>"
      )
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Funnel & social                                                    */
  /* ------------------------------------------------------------------ */

  function renderFunnel() {
    const labels = EMBUDO.map((e) => e.paso);
    const values = EMBUDO.map((e) => e.usuarios);
    const colors = ["#0b1f3a", "#0b6e99", "#0e9f6e", "#d99a2b"];

    makeChart("funnelChart", {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Usuarios",
            data: values,
            backgroundColor: colors,
            borderRadius: 7,
            borderSkipped: false,
            maxBarThickness: 34
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        layout: { padding: { right: 86 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                return " " + num.format(ctx.parsed.x) + " usuarios";
              }
            }
          },
          valueLabels: {
            enabled: true,
            formatter: (v) => num.format(v)
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: "#edf2f8" },
            ticks: { callback: (v) => (v >= 1000 ? v / 1000 + "k" : v) }
          },
          y: { grid: { display: false }, ticks: { padding: 18 } }
        }
      },
      plugins: [valueLabels]
    });

    const tbody = $("#funnelBody");
    if (!tbody) return;
    tbody.innerHTML = EMBUDO.map((step, i) => {
      if (i === 0) {
        return (
          "<tr><td><strong>" +
          step.paso +
          "</strong></td><td class='num'>" +
          num.format(step.usuarios) +
          "</td><td class='num'>—</td><td class='num'>—</td></tr>"
        );
      }
      const prev = EMBUDO[i - 1].usuarios;
      const conv = (step.usuarios / prev) * 100;
      const drop = 100 - conv;
      return (
        "<tr><td><strong>" +
        step.paso +
        "</strong></td><td class='num'>" +
        num.format(step.usuarios) +
        "</td><td class='num'>" +
        pct.format(conv) +
        "%</td><td class='num'>" +
        pct.format(drop) +
        "%</td></tr>"
      );
    }).join("");

    const vistas = EMBUDO[0].usuarios;
    const compras = EMBUDO[EMBUDO.length - 1].usuarios;
    setText("#funnelConv", pct.format((compras / vistas) * 100) + " %");
    setText("#funnelDrop", pct.format(100 - (EMBUDO[1].usuarios / vistas) * 100) + " %");
  }

  function renderSocial() {
    const cards = $("#socialCards");
    if (cards) {
      cards.innerHTML = SOCIAL.map((s) => {
        const engagement = (s.interacciones / s.alcance) * 100;
        const clickRate = (s.clics / s.alcance) * 100;
        return (
          '<article class="social-card">' +
          '<div class="platform"><span class="dot" style="background:' +
          (SOCIAL_COLORS[s.plataforma] || "#64748b") +
          '"></span>' +
          s.plataforma +
          "</div>" +
          '<div class="big">' +
          num.format(s.alcance) +
          '</div><div class="small">alcance</div>' +
          "<dl>" +
          "<dt>Interacciones</dt><dd>" +
          num.format(s.interacciones) +
          "</dd>" +
          "<dt>Engagement</dt><dd>" +
          pct.format(engagement) +
          "%</dd>" +
          "<dt>Clics al sitio</dt><dd>" +
          num.format(s.clics) +
          "</dd>" +
          "<dt>Clic / alcance</dt><dd>" +
          pct.format(clickRate) +
          "%</dd>" +
          "</dl></article>"
        );
      }).join("");
    }

    const labels = SOCIAL.map((s) => s.plataforma);
    const engagement = SOCIAL.map((s) => round2((s.interacciones / s.alcance) * 100));
    const clickRate = SOCIAL.map((s) => round2((s.clics / s.alcance) * 100));

    makeChart("socialRateChart", {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Engagement (interacciones / alcance)",
            data: engagement,
            backgroundColor: "#0e7c86",
            borderRadius: 6,
            maxBarThickness: 34
          },
          {
            label: "Clic al sitio (clics / alcance)",
            data: clickRate,
            backgroundColor: "#d99a2b",
            borderRadius: 6,
            maxBarThickness: 34
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label(ctx) {
                return " " + ctx.dataset.label + ": " + pct.format(ctx.parsed.y) + " %";
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: "#edf2f8" },
            ticks: { callback: (v) => v + " %" }
          }
        }
      }
    });

    const tbody = $("#socialBody");
    if (tbody) {
      tbody.innerHTML = SOCIAL.map((s) => {
        const engagementRate = (s.interacciones / s.alcance) * 100;
        const clickRate = (s.clics / s.alcance) * 100;
        return (
          "<tr><td><strong>" +
          s.plataforma +
          "</strong></td><td class='num'>" +
          num.format(s.alcance) +
          "</td><td class='num'>" +
          num.format(s.impresiones) +
          "</td><td class='num'>" +
          num.format(s.interacciones) +
          "</td><td class='num'>" +
          num.format(s.clics) +
          "</td><td class='num'>" +
          pct.format(engagementRate) +
          "%</td><td class='num'>" +
          pct.format(clickRate) +
          "%</td></tr>"
        );
      }).join("");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Filters & tabs                                                     */
  /* ------------------------------------------------------------------ */

  function fillSelect(id, values, allLabel) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      '<option value="all">' + allLabel + "</option>" +
      values.map((v) => '<option value="' + v + '">' + v + "</option>").join("");
    select.value = current && Array.from(select.options).some((o) => o.value === current) ? current : "all";
  }

  function initFilters() {
    const months = Array.from(new Set(TX.map((r) => r.f.slice(0, 7)))).sort();
    const monthSelect = document.getElementById("filterMes");
    if (monthSelect) {
      monthSelect.innerHTML =
        '<option value="all">Todos los meses</option>' +
        months
          .map((m) => {
            const i = Number(m.slice(5, 7)) - 1;
            return '<option value="' + m + '">' + MONTH_FULL[i].charAt(0).toUpperCase() + MONTH_FULL[i].slice(1) + " 2026</option>";
          })
          .join("");
    }
    fillSelect("filterCanal", Array.from(new Set(TX.map((r) => r.c))).sort(), "Todos los canales");
    fillSelect("filterDispositivo", Array.from(new Set(TX.map((r) => r.d))).sort(), "Todos los dispositivos");
    fillSelect("filterProducto", Array.from(new Set(TX.map((r) => r.p))).sort(), "Todos los productos");

    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => {
        state[key] = el.value;
        renderTransactionKPIs();
        renderTransactionCharts();
        renderTopDates();
      });
    };
    bind("filterMes", "mes");
    bind("filterCanal", "canal");
    bind("filterDispositivo", "dispositivo");
    bind("filterProducto", "producto");

    const reset = document.getElementById("resetFilters");
    if (reset) {
      reset.addEventListener("click", () => {
        state.mes = "all";
        state.canal = "all";
        state.dispositivo = "all";
        state.producto = "all";
        ["filterMes", "filterCanal", "filterDispositivo", "filterProducto"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = "all";
        });
        renderTransactionKPIs();
        renderTransactionCharts();
        renderTopDates();
      });
    }
  }

  function activateTab(name) {
    $$(".tab").forEach((btn) => {
      const active = btn.dataset.tab === name;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
    });
    $$(".tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === name);
    });
    if (history.replaceState) history.replaceState(null, "", "#" + name);
    window.setTimeout(() => {
      Object.values(charts).forEach((chart) => {
        try { chart.resize(); } catch (e) { /* no-op */ }
      });
    }, 60);
  }

  function initTabs() {
    $$(".tab").forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.dataset.tab));
      btn.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        const tabs = $$(".tab");
        const index = tabs.indexOf(btn);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
        tabs[next].focus();
        activateTab(tabs[next].dataset.tab);
      });
    });
    const hash = window.location.hash.replace("#", "");
    if (hash && document.getElementById(hash)) activateTab(hash);
  }

  function initDownload() {
    const btn = document.getElementById("downloadCsv");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const rows = filteredRows();
      const header = "fecha,canal,producto,monto,costo_adquisicion,dispositivo,edad,genero,monto_revisar\n";
      const body = rows
        .map((r) => [r.f, r.c, r.p, r.m, r.k, r.d, r.e, r.g, r.r].join(","))
        .join("\n");
      const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tiendanova_transacciones_filtradas.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function init() {
    chartDefaults();
    if (!window.Chart) {
      $$(".chart-wrap").forEach((el) => {
        el.innerHTML = '<p style="color:#5b6b82;font-size:13px">No se pudo cargar el motor de gráficos. Verifica que assets/chart.umd.min.js esté presente.</p>';
      });
    }
    renderSummary();
    initFilters();
    renderTransactionKPIs();
    renderTransactionCharts();
    renderTopDates();
    renderFlagged();
    renderFunnel();
    renderSocial();
    initTabs();
    initDownload();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
