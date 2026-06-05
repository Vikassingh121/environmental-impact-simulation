// Chart instance
let impactChartInstance = null;

// Slider live updates & URL parameter syncing
const sliders = {
    cityArea: 'areaVal',
    greenCover: 'greenVal',
    avgTemp: 'tempVal',
    treesPerAcre: 'treesVal',
    pm25: 'pm25Val',
    popDensity: 'popVal'
};

function formatNum(n, decimals = 0) {
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(decimals);
}

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Slider Event Listeners
    Object.entries(sliders).forEach(([sliderId, valId]) => {
        const slider = document.getElementById(sliderId);
        const val = document.getElementById(valId);
        slider.addEventListener('input', () => {
            val.textContent = slider.value;
            // Hide share button when inputs change to encourage re-running first
            document.getElementById('shareBtn').style.display = 'none';
        });
    });

    // 2. Read URL Parameters
    const params = new URLSearchParams(window.location.search);
    let hasParams = false;
    
    Object.keys(sliders).forEach(sliderId => {
        if (params.has(sliderId)) {
            const slider = document.getElementById(sliderId);
            const val = document.getElementById(sliders[sliderId]);
            slider.value = params.get(sliderId);
            val.textContent = slider.value;
            hasParams = true;
        }
    });

    // 3. Auto-run if opened from a share link
    if (hasParams) {
        runSimulation();
    }
});

function shareResults() {
    const params = new URLSearchParams();
    Object.keys(sliders).forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        params.set(sliderId, slider.value);
    });

    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + params.toString();
    
    function showSuccess() {
        const shareBtn = document.getElementById('shareBtn');
        const originalText = shareBtn.textContent;
        shareBtn.textContent = '✅ Link Copied!';
        shareBtn.classList.add('copied');
        
        setTimeout(() => {
            shareBtn.textContent = originalText;
            shareBtn.classList.remove('copied');
        }, 3000);
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(newUrl).then(showSuccess).catch(fallbackCopy);
    } else {
        fallbackCopy();
    }
    
    function fallbackCopy() {
        const textArea = document.createElement("textarea");
        textArea.value = newUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showSuccess();
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
    }
}

async function runSimulation() {
    const btn = document.getElementById('runBtn');
    const shareBtn = document.getElementById('shareBtn');
    const progress = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    btn.classList.add('running');
    btn.textContent = '⏳ Simulating...';
    shareBtn.style.display = 'none';
    progress.style.display = 'block';

    // Gather inputs
    const cityArea = parseFloat(document.getElementById('cityArea').value);
    const greenCover = parseFloat(document.getElementById('greenCover').value) / 100;
    const avgTemp = parseFloat(document.getElementById('avgTemp').value);
    const treesPerAcre = parseFloat(document.getElementById('treesPerAcre').value);
    const pm25 = parseFloat(document.getElementById('pm25').value);
    const popDensity = parseFloat(document.getElementById('popDensity').value);

    // Animate progress
    for (let i = 0; i <= 100; i += 2) {
        progressBar.style.width = i + '%';
        await new Promise(r => setTimeout(r, 20));
    }

    // === SIMULATION CALCULATIONS ===

    // Number of micro-sanctuaries needed
    const sanctuaryZoneArea = Math.PI * 2 * 2; // π×r² for 2km radius ≈ 12.57 km²
    const numSanctuaries = Math.ceil(cityArea / sanctuaryZoneArea);
    const acresPerSanctuary = 2;
    const totalAcres = numSanctuaries * acresPerSanctuary;
    const totalHectares = totalAcres * 0.4047;
    const totalSanctuaryKm2 = totalHectares / 100;

    // Trees planted (based on slider selection)
    const treesPerSanctuary = treesPerAcre;
    const totalTrees = numSanctuaries * treesPerSanctuary;

    // ----- OXYGEN -----
    const o2PerTree = 100; // kg/year
    const totalO2Produced = totalTrees * o2PerTree; // kg/year
    const totalO2Tons = totalO2Produced / 1000;
    const humansSupported = Math.floor(totalO2Produced / 740);

    // ----- CO₂ -----
    const co2PerTree = 22; // kg/year
    const totalCO2Absorbed = totalTrees * co2PerTree;
    const totalCO2Tons = totalCO2Absorbed / 1000;
    const population = cityArea * popDensity;
    const cityEmissionsTons = population * 2.5;
    const co2ReductionPercent = (totalCO2Tons / cityEmissionsTons) * 100;

    // ----- TEMPERATURE -----
    const newGreenFraction = totalSanctuaryKm2 / cityArea;
    const effectiveGreenAfter = greenCover + newGreenFraction;
    const tempReduction = (newGreenFraction * 100) * 0.15;
    // Manifesto states Miyawaki forests reduce temps by minimum 2°C (IIT Kanpur research)
    const localTempReduction = Math.max(Math.min(tempReduction * 8, 7), 2.0);
    const avgTempAfter = avgTemp - tempReduction;
    const localTempAfter = avgTemp - localTempReduction;

    // ----- PM2.5 -----
    const pm25ReductionFactor = 0.15 * Math.min(newGreenFraction * 10, 1);
    const pm25After = pm25 * (1 - pm25ReductionFactor);
    const pm25Reduction = pm25 - pm25After;

    // ----- Evapotranspiration / Cooling -----
    const totalWaterTranspired = totalTrees * 400; // liters/day
    const coolingKWH = totalWaterTranspired * 0.68 / 1000;
    const acEquivalent = Math.floor(coolingKWH / 3.5);

    // ----- LOCAL GAS COMPOSITION -----
    const gasBeforeO2 = 20.80 - (pm25 / 10000);
    const gasBeforeCO2 = 0.042 + (pm25 / 5000) + (popDensity / 500000);
    const gasBeforeNO2 = 0.003 + (pm25 / 20000);
    const gasBeforeSO2 = 0.001 + (pm25 / 30000);
    const gasBeforeN2 = 78.09;
    const gasBeforeAr = 0.93;
    const gasBeforeOther = 0.10 + gasBeforeNO2 + gasBeforeSO2;

    const o2Boost = newGreenFraction * 3.5;
    const co2Drop = newGreenFraction * 1.2;
    const gasAfterO2 = Math.min(gasBeforeO2 + o2Boost, 21.2);
    const gasAfterCO2 = Math.max(gasBeforeCO2 - co2Drop * gasBeforeCO2, 0.038);
    const gasAfterNO2 = gasBeforeNO2 * (1 - pm25ReductionFactor * 0.8);
    const gasAfterSO2 = gasBeforeSO2 * (1 - pm25ReductionFactor * 0.6);
    const gasAfterN2 = 78.09;
    const gasAfterAr = 0.93;
    const gasAfterOther = 0.10 + gasAfterNO2 + gasAfterSO2;

    // ----- HEAT EFFECT MODELING -----
    const uhiBefore = 3 + (popDensity / 10000) * 2;
    const surfaceTempBefore = avgTemp + uhiBefore;
    const uHIAfter = uhiBefore * (1 - newGreenFraction * 5);
    const surfaceTempAfter = avgTempAfter + uHIAfter;

    // ======= RENDER RESULTS =======
    document.getElementById('results').classList.remove('hidden');

    // Impact Cards
    const impactGrid = document.getElementById('impactGrid');
    impactGrid.innerHTML = '';
    const impacts = [
        { icon: '🌳', number: formatNum(totalTrees), label: 'Trees Planted', delta: `${formatNum(numSanctuaries)} sanctuaries`, positive: true, color: 'green' },
        { icon: '💨', number: formatNum(totalO2Tons) + 't', label: 'O₂ Produced / Year', delta: `Supports ${formatNum(humansSupported)} people`, positive: true, color: 'green' },
        { icon: '🏭', number: formatNum(totalCO2Tons) + 't', label: 'CO₂ Absorbed / Year', delta: `-${co2ReductionPercent.toFixed(2)}% city emissions`, positive: true, color: 'blue' },
        { icon: '🌡️', number: `-${localTempReduction.toFixed(1)}°C`, label: 'Local Temp Reduction', delta: `Min 2°C cooling per sanctuary`, positive: true, color: 'amber' },
        { icon: '🫁', number: `-${pm25Reduction.toFixed(1)}`, label: 'PM2.5 Reduction (µg/m³)', delta: `${(pm25ReductionFactor*100).toFixed(1)}% cleaner`, positive: true, color: 'purple' },
        { icon: '❄️', number: formatNum(acEquivalent), label: 'AC Units Equivalent', delta: `${formatNum(totalWaterTranspired)} L/day transpired`, positive: true, color: 'blue' },
    ];

    impacts.forEach((imp, i) => {
        const card = document.createElement('div');
        card.className = `impact-card ${imp.color}`;
        card.style.animationDelay = `${i * 0.1}s`;
        card.classList.add('fade-in');
        card.innerHTML = `
            <div class="impact-icon">${imp.icon}</div>
            <div class="impact-number">${imp.number}</div>
            <div class="impact-label">${imp.label}</div>
            <div class="impact-delta ${imp.positive ? 'positive' : 'negative'}">${imp.delta}</div>
        `;
        impactGrid.appendChild(card);
    });

    // Comparison Grid
    const compGrid = document.getElementById('comparisonGrid');
    compGrid.innerHTML = '';
    const metrics = [
        { name: 'Green Cover', before: `${(greenCover*100).toFixed(1)}%`, after: `${(effectiveGreenAfter*100).toFixed(1)}%` },
        { name: 'Avg Surface Temperature', before: `${surfaceTempBefore.toFixed(1)}°C`, after: `${surfaceTempAfter.toFixed(1)}°C` },
        { name: 'UHI Effect', before: `+${uhiBefore.toFixed(1)}°C`, after: `+${uHIAfter.toFixed(1)}°C` },
        { name: 'PM2.5 Level', before: `${pm25.toFixed(0)} µg/m³`, after: `${pm25After.toFixed(1)} µg/m³` },
        { name: 'O₂ Near Surface', before: `${gasBeforeO2.toFixed(3)}%`, after: `${gasAfterO2.toFixed(3)}%` },
        { name: 'CO₂ Near Surface', before: `${gasBeforeCO2.toFixed(4)}%`, after: `${gasAfterCO2.toFixed(4)}%` },
        { name: 'NO₂ Near Surface', before: `${gasBeforeNO2.toFixed(5)}%`, after: `${gasAfterNO2.toFixed(5)}%` },
        { name: 'Water Transpired', before: '0 L/day', after: `${formatNum(totalWaterTranspired)} L/day` },
    ];

    const beforeCard = document.createElement('div');
    beforeCard.className = 'scenario-card before fade-in';
    beforeCard.innerHTML = `
        <div class="scenario-header">
            <div class="scenario-dot"></div>
            <span class="scenario-label">Before — Current State</span>
        </div>
        <div class="metric-list">${metrics.map(m => `
            <div class="metric-item">
                <span class="metric-name">${m.name}</span>
                <span class="metric-value">${m.before}</span>
            </div>
        `).join('')}</div>
    `;
    compGrid.appendChild(beforeCard);

    const afterCard = document.createElement('div');
    afterCard.className = 'scenario-card after fade-in';
    afterCard.style.animationDelay = '0.15s';
    afterCard.innerHTML = `
        <div class="scenario-header">
            <div class="scenario-dot"></div>
            <span class="scenario-label">After — With Micro-Sanctuaries</span>
        </div>
        <div class="metric-list">${metrics.map(m => `
            <div class="metric-item">
                <span class="metric-name">${m.name}</span>
                <span class="metric-value">${m.after}</span>
            </div>
        `).join('')}</div>
    `;
    compGrid.appendChild(afterCard);

    // Gas Composition Rings
    const gasRingsDiv = document.getElementById('gasRings');
    gasRingsDiv.innerHTML = '';

    function createGasRing(title, className, gases) {
        const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4'];
        const total = gases.reduce((s, g) => s + g.value, 0);
        let cumulative = 0;

        const card = document.createElement('div');
        card.className = `ring-card ${className} fade-in`;

        const svgArcs = gases.map((g, i) => {
            const pct = g.value / total;
            const dashArray = pct * 440;
            const dashOffset = -cumulative * 440 / total;
            cumulative += g.value;
            return `<circle cx="100" cy="100" r="70" fill="none" stroke="${colors[i]}" stroke-width="20"
                stroke-dasharray="${dashArray} ${440 - dashArray}" stroke-dashoffset="${dashOffset}"
                opacity="0.85"/>`;
        }).join('');

        const legend = gases.map((g, i) => `
            <div class="gas-legend-item">
                <div class="gas-legend-left">
                    <div class="gas-dot" style="background:${colors[i]}"></div>
                    <span>${g.name}</span>
                </div>
                <span class="gas-legend-value">${g.display}</span>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="ring-title">${title}</div>
            <svg class="ring-svg" viewBox="0 0 200 200">${svgArcs}</svg>
            <div class="gas-legend">${legend}</div>
        `;
        gasRingsDiv.appendChild(card);
    }

    createGasRing('Before — Urban Air', 'before', [
        { name: 'N₂', value: gasBeforeN2, display: gasBeforeN2.toFixed(2) + '%' },
        { name: 'O₂', value: gasBeforeO2, display: gasBeforeO2.toFixed(3) + '%' },
        { name: 'Ar', value: gasBeforeAr, display: gasBeforeAr.toFixed(2) + '%' },
        { name: 'CO₂', value: gasBeforeCO2 * 100, display: gasBeforeCO2.toFixed(4) + '%' },
        { name: 'NO₂ / SO₂', value: (gasBeforeNO2 + gasBeforeSO2) * 100, display: (gasBeforeNO2 + gasBeforeSO2).toFixed(5) + '%' },
        { name: 'Other', value: gasBeforeOther, display: gasBeforeOther.toFixed(3) + '%' },
    ]);

    createGasRing('After — With Green Lungs', 'after', [
        { name: 'N₂', value: gasAfterN2, display: gasAfterN2.toFixed(2) + '%' },
        { name: 'O₂', value: gasAfterO2, display: gasAfterO2.toFixed(3) + '%' },
        { name: 'Ar', value: gasAfterAr, display: gasAfterAr.toFixed(2) + '%' },
        { name: 'CO₂', value: gasAfterCO2 * 100, display: gasAfterCO2.toFixed(4) + '%' },
        { name: 'NO₂ / SO₂', value: (gasAfterNO2 + gasAfterSO2) * 100, display: (gasAfterNO2 + gasAfterSO2).toFixed(5) + '%' },
        { name: 'Other', value: gasAfterOther, display: gasAfterOther.toFixed(3) + '%' },
    ]);

    // Chart.js Setup
    const ctx = document.getElementById('impactChart').getContext('2d');
    
    if (impactChartInstance) {
        impactChartInstance.destroy();
    }

    // Prepare data for Chart.js
    // Chart.js requires normalized values if we plot them on the same axis, or different axes.
    // To keep it simple, we'll make a grouped bar chart with a logarithmic scale so all items can be viewed nicely.
    impactChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [
                'Surface Temp (°C)', 
                'PM2.5 (µg/m³)', 
                'CO₂ (x100 ppm)', 
                'O₂ (%)', 
                'UHI Effect (°C)', 
                'Green Cover (%)'
            ],
            datasets: [
                {
                    label: 'Before',
                    data: [
                        surfaceTempBefore, 
                        pm25, 
                        gasBeforeCO2 * 100, // scaled for chart visibility alongside other metrics
                        gasBeforeO2, 
                        uhiBefore, 
                        greenCover * 100
                    ],
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'After',
                    data: [
                        surfaceTempAfter, 
                        pm25After, 
                        gasAfterCO2 * 100, 
                        gasAfterO2, 
                        uHIAfter, 
                        effectiveGreenAfter * 100
                    ],
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'logarithmic',
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#f1f5f9'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // Temperature Heatmap
    const heatmapGrid = document.getElementById('heatmapGrid');
    heatmapGrid.innerHTML = '';

    function createHeatmap(title, baseTemp, sanctuaryEffect, className) {
        const section = document.createElement('div');
        section.className = 'heatmap-section';

        const label = document.createElement('div');
        label.className = 'heatmap-label';
        label.style.color = className === 'before' ? 'var(--accent-red)' : 'var(--accent-green)';
        label.textContent = title;

        const grid = document.createElement('div');
        grid.className = 'heatmap';

        // Generate 12x8 grid
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 12; col++) {
                const cell = document.createElement('div');
                cell.className = 'heat-cell';

                const isSanctuary = className === 'after' && (row % 3 === 1 && col % 4 === 2);
                let temp;
                
                if (className === 'before') {
                    temp = baseTemp + (Math.random() * 4 - 1);
                } else {
                    if (isSanctuary) {
                        temp = baseTemp - sanctuaryEffect;
                    } else {
                        const distToSanctuary = Math.min(Math.abs(row % 3 - 1) + Math.abs(col % 4 - 2), 3);
                        const cooling = sanctuaryEffect * Math.max(0, 1 - distToSanctuary / 3.5);
                        temp = baseTemp + (Math.random() * 2 - 0.5) - cooling;
                    }
                }

                const normalized = Math.max(0, Math.min(1, (temp - 32) / 20));
                const r = Math.round(normalized * 255);
                const g = Math.round((1 - Math.abs(normalized - 0.5) * 2) * 100);
                const b = Math.round((1 - normalized) * 180);
                
                cell.style.background = `rgb(${r}, ${g}, ${b})`;
                cell.title = `${temp.toFixed(1)}°C`;
                grid.appendChild(cell);
            }
        }

        const scale = document.createElement('div');
        scale.className = 'heat-scale';
        scale.innerHTML = `<span>32°C</span><span style="background: linear-gradient(90deg, rgb(0,100,180), rgb(128,100,90), rgb(255,50,0)); height:8px; flex:1; margin:0 0.5rem; border-radius:4px;"></span><span>52°C</span>`;

        section.appendChild(label);
        section.appendChild(grid);
        section.appendChild(scale);
        heatmapGrid.appendChild(section);
    }

    createHeatmap('Before — Urban Heat Island', surfaceTempBefore, 0, 'before');
    createHeatmap('After — Micro-Sanctuary Cooling', surfaceTempBefore, localTempReduction, 'after');

    // Verdict
    const verdict = document.getElementById('verdictCard');
    const isSignificant = localTempReduction >= 2.0 || co2ReductionPercent > 0.5;
    const estCostInCrores = (numSanctuaries * 10) / 100; // ~10 lakh per sanctuary average
    verdict.innerHTML = `
        <div class="verdict-emoji">${isSignificant ? '🌿' : '🌱'}</div>
        <div class="verdict-title">Simulation Verdict: The Coexistence Mandate</div>
        <div class="verdict-text">
            Deploying <strong>${formatNum(numSanctuaries)} micro-sanctuaries</strong> across ${cityArea} km² would establish 
            <strong>${formatNum(totalAcres)} acres</strong> of dedicated habitat, planting <strong>${formatNum(totalTrees)} trees</strong>. 
            This produces <strong>${formatNum(totalO2Tons)} tonnes of oxygen</strong> annually (supporting <strong>${formatNum(humansSupported)} people</strong>), 
            absorbs <strong>${formatNum(totalCO2Tons)} tonnes of CO₂</strong>, and guarantees local temperatures drop by at least <strong>${localTempReduction.toFixed(1)}°C</strong> near sanctuary zones.
            The evapotranspiration cooling alone equals <strong>${formatNum(acEquivalent)} air conditioning units</strong> running 24/7.
            <br><br>
            <strong>Cost & Implementation:</strong> Funding this via existing CAMPA funds requires approximately <strong>₹${estCostInCrores.toFixed(1)} Crore</strong> 
            (estimated at ₹10 Lakh per sanctuary). For the farmers, this means <strong>${formatNum(numSanctuaries)} new grazing and water zones</strong> to draw stray 
            cattle and wildlife away from active agricultural fields, solving the human-animal conflict at the root.
            <br><br>
            <em>"I don't want to hurt the cow. But if I don't chase it away, my family doesn't eat tonight."</em> — This policy ensures the farmer never has to make that choice again.
        </div>
    `;

    // Finish
    btn.classList.remove('running');
    btn.textContent = '🔄 Re-Run Simulation';
    
    // Show share button
    shareBtn.style.display = 'inline-flex';

    // Scroll to results
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
