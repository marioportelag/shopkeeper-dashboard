// Renders the chart and table from server-provided JSON. No inline scripts, so the CSP can forbid them.
(() => {
  const dataElement = document.getElementById('chart-data');
  const canvas = document.getElementById('listing-chart');
  if (!dataElement || !canvas) return;

  const chartData = JSON.parse(dataElement.textContent);

  new Chart(canvas, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Total listings' } },
        x: { title: { display: true, text: 'Month' } },
      },
    },
  });

  const table = document.getElementById('broker-table');
  if (table) {
    new DataTable(table, {
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50, 100],
      order: [
        [0, 'asc'],
        [1, 'asc'],
      ],
    });
  }
})();
