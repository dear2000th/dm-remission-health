// Modern Healthcare Visualizations powered by Chart.js
const AppCharts = (function () {
  let bpChartInstance = null;
  let glucoseChartInstance = null;
  let stepsChartInstance = null;

  // Chart Global Defaults
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    Chart.defaults.color = '#475569';
  }

  function renderBPChart(canvasId, labels, systolicData, diastolicData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (bpChartInstance) {
      bpChartInstance.destroy();
    }

    // Create subtle gradient fills
    const sysGradient = ctx.createLinearGradient(0, 0, 0, 300);
    sysGradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
    sysGradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    const diaGradient = ctx.createLinearGradient(0, 0, 0, 300);
    diaGradient.addColorStop(0, 'rgba(2, 132, 199, 0.22)');
    diaGradient.addColorStop(1, 'rgba(2, 132, 199, 0.0)');

    bpChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'ความดัน บน (Systolic)',
            data: systolicData,
            borderColor: '#ef4444',
            backgroundColor: sysGradient,
            borderWidth: 2.5,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            tension: 0.35,
            fill: true
          },
          {
            label: 'ความดัน ล่าง (Diastolic)',
            data: diastolicData,
            borderColor: '#0284c7',
            backgroundColor: diaGradient,
            borderWidth: 2.5,
            pointBackgroundColor: '#0284c7',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              font: { size: 12, weight: 600 }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.raw !== null ? context.raw : '-'} mmHg`
            }
          }
        },
        scales: {
          y: {
            min: 50,
            max: 180,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 11 } },
            title: { display: true, text: 'มิลลิเมตรปรอท (mmHg)', font: { size: 11, weight: 500 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }

  function renderGlucoseChart(canvasId, labels, g1Pre, g1Post, g2Pre, g2Post) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (glucoseChartInstance) {
      glucoseChartInstance.destroy();
    }

    glucoseChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'มื้อแรก: ก่อนอาหาร (FBS)',
            data: g1Pre,
            borderColor: '#8b5cf6',
            backgroundColor: '#8b5cf6',
            borderWidth: 2.5,
            pointBackgroundColor: '#8b5cf6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4.5,
            tension: 0.3
          },
          {
            label: 'มื้อแรก: หลังอาหาร',
            data: g1Post,
            borderColor: '#d946ef',
            borderDash: [4, 4],
            borderWidth: 2,
            pointBackgroundColor: '#d946ef',
            pointRadius: 3.5,
            tension: 0.3
          },
          {
            label: 'มื้อสุดท้าย: ก่อนอาหาร',
            data: g2Pre,
            borderColor: '#0d9488',
            backgroundColor: '#0d9488',
            borderWidth: 2.5,
            pointBackgroundColor: '#0d9488',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4.5,
            tension: 0.3
          },
          {
            label: 'มื้อสุดท้าย: หลังอาหาร',
            data: g2Post,
            borderColor: '#f59e0b',
            borderDash: [4, 4],
            borderWidth: 2,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 3.5,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              font: { size: 12, weight: 600 }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.raw !== null ? context.raw : '-'} mg/dL`
            }
          }
        },
        scales: {
          y: {
            min: 60,
            max: 220,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 11 } },
            title: { display: true, text: 'ระดับน้ำตาล (mg/dL)', font: { size: 11, weight: 500 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }

  function renderStepsChart(canvasId, labels, stepsData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (stepsChartInstance) {
      stepsChartInstance.destroy();
    }

    const barGradient = ctx.createLinearGradient(0, 0, 0, 300);
    barGradient.addColorStop(0, '#10b981');
    barGradient.addColorStop(1, '#059669');

    stepsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'จำนวนก้าวเฉลี่ยต่อวัน',
            data: stepsData,
            backgroundColor: barGradient,
            borderRadius: 6,
            maxBarThickness: 36
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              font: { size: 12, weight: 600 }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => ` เฉลี่ย: ${(context.raw || 0).toLocaleString()} ก้าว/วัน`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 14000,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 11 } },
            title: { display: true, text: 'ก้าวเดิน (Steps)', font: { size: 11, weight: 500 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }

  return {
    renderBPChart,
    renderGlucoseChart,
    renderStepsChart
  };
})();

// Explicitly export to window object so it is always accessible globally
window.AppCharts = AppCharts;
