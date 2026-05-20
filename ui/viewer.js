// ══════════════════════════════════════════
    // CONSTANTS
    // ══════════════════════════════════════════
    let MY = { uwGpa: 4.00, wAcadGpa: 4.56, wTotalGpa: 4.52, w1012Gpa: 4.67, sat: 1540, act: 34 };

    const OUTCOMES = {
      acceptedEA: { label: 'Accepted EA', color: '#00e676' },
      acceptedRD: { label: 'Accepted RD', color: '#69f0ae' },
      acceptedED: { label: 'Accepted ED', color: '#b9f6ca' },
      deniedEA: { label: 'Denied EA', color: '#ff5252' },
      deniedRD: { label: 'Denied RD', color: '#ff867c' },
      deniedED: { label: 'Denied ED', color: '#ffcdd2' },
      waitlistedUnknownEA: { label: 'Waitlisted EA', color: '#ffab40' },
      waitlistedUnknownRD: { label: 'Waitlisted RD', color: '#ffd180' },
      waitlistedDeniedEA: { label: 'WL→Denied EA', color: '#ff6d00' },
      waitlistedDeniedRD: { label: 'WL→Denied RD', color: '#e65100' },
      waitlistedAcceptedEA: { label: 'WL→Accept EA', color: '#76ff03' },
      waitlistedAcceptedRD: { label: 'WL→Accept RD', color: '#ccff90' },
    };
    const DEFAULT_VISIBLE = new Set(['acceptedRD', 'acceptedED', 'acceptedEA', 'waitlistedAcceptedRD', 'waitlistedAcceptedEA']);
    const ACCEPTED_KEYS = new Set(['acceptedEA', 'acceptedRD', 'acceptedED', 'waitlistedAcceptedEA', 'waitlistedAcceptedRD']);

    // school colors for compare view
    const SCHOOL_COLORS = ['#00e5ff', '#ce93d8', '#ffab40', '#69f0ae', '#ff5252', '#f48fb1', '#80cbc4', '#ffe082', '#ef9a9a', '#b39ddb'];

    // ══════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════
    let SCHOOLS = []; // [{name, raw}]
    let currentSchoolIdx = 0;
    let sGpaMode = 'weightedGpa', sScoreMode = 'sat';
    let sHidden = new Set();
    let cGpaMode = 'weightedGpa', cScoreMode = 'sat';
    let cActiveTab = 'overlay';
    let cVisibleSchools = new Set();
    let sortCol = 'tag', sortDir = 1;

    // ══════════════════════════════════════════
    // FILE LOADING
    // ══════════════════════════════════════════
    document.getElementById('fileInput').addEventListener('change', function () {
      if (!this.files.length) return;
      const files = Array.from(this.files);
      const readers = files.map(f => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => {
          try {
            const data = JSON.parse(e.target.result);
            if (!data.scattergrams) throw new Error('Not a Naviance scattergram file');
            res({ name: f.name.replace('.json', '').replace(/_/g, ' '), raw: data });
          } catch (err) { rej(f.name + ': ' + err.message); }
        };
        r.readAsText(f);
      }));
      Promise.allSettled(readers).then(results => {
        const loaded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
        if (errors.length) {
          document.getElementById('loadError').textContent = '⚠ ' + errors.join(' | ');
          document.getElementById('loadError').style.display = 'block';
        }
        if (loaded.length) {
          // Merge: avoid duplicates by name
          loaded.forEach(s => {
            if (!SCHOOLS.find(e => e.name === s.name)) SCHOOLS.push(s);
          });
          showDash();
        }
      });
    });

    async function loadFromDB() {
      if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        document.getElementById('loadError').textContent = '⚠ Extension context not found. Cannot load from DB.';
        document.getElementById('loadError').style.display = 'block';
        return;
      }
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'DB_ACTION', action: 'getAllSchools' }, res => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(res);
          });
        });
        if (!response || !response.success || !response.result) {
          throw new Error('Failed to retrieve data from DB.');
        }
        
        const loaded = response.result.map(rec => ({ name: rec.schoolName, raw: rec.data }));
        if (loaded.length === 0) {
          document.getElementById('loadError').textContent = '⚠ No schools found in the Extension DB.';
          document.getElementById('loadError').style.display = 'block';
          return;
        }
        
        loaded.forEach(s => { // Merge duplicates
          const existingIdx = SCHOOLS.findIndex(e => e.name === s.name);
          if (existingIdx !== -1) SCHOOLS[existingIdx] = s; // override
          else SCHOOLS.push(s);
        });
        showDash();
      } catch (err) {
        document.getElementById('loadError').textContent = '⚠ ' + err.message;
        document.getElementById('loadError').style.display = 'block';
      }
    }

    // ══════════════════════════════════════════
    // VIEW ROUTING
    // ══════════════════════════════════════════
    function showView(id) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    }
    function showDash() { buildDash(); showView('v-dash'); }
    function showSchool(idx) {
      currentSchoolIdx = idx;
      sHidden = new Set();
      showView('v-school');
      buildSchoolView();
    }
    function showCompare() { showView('v-compare'); buildCompare(); }

    // ══════════════════════════════════════════
    // ANALYTICS HELPERS
    // ══════════════════════════════════════════
    function getSchoolStats(raw) {
      const sg = raw.scattergrams;
      // accepted applicants from weightedGpa/sat for medians
      const allAccepted = [];
      for (const gk of ['weightedGpa', 'gpa']) {
        const scoreData = sg[gk]?.sat?.apps;
        if (!scoreData) continue;
        for (const [k, items] of Object.entries(scoreData)) {
          if (!ACCEPTED_KEYS.has(k)) continue;
          items.forEach(item => {
            const score = item.studentSAT1600Composite || item.highestComboSat || 0;
            if (score > 0 && item.gpa > 0) allAccepted.push({ gpa: item.gpa, sat: score, weighted: gk === 'weightedGpa' });
          });
        }
        if (allAccepted.length > 0) break;
      }

      const wAccepted = allAccepted.filter(a => a.weighted);
      const uwAccepted = allAccepted.filter(a => !a.weighted);
      const pool = wAccepted.length ? wAccepted : allAccepted;

      const gpas = pool.map(a => a.gpa).sort((a, b) => a - b);
      const sats = pool.map(a => a.sat).sort((a, b) => a - b);
      const medGpa = gpas.length ? gpas[Math.floor(gpas.length / 2)] : null;
      const medSat = sats.length ? sats[Math.floor(sats.length / 2)] : null;
      const avgGpa = gpas.length ? gpas.reduce((s, v) => s + v, 0) / gpas.length : null;
      const avgSat = sats.length ? sats.reduce((s, v) => s + v, 0) / sats.length : null;

      // accept rate (from all outcomes with scores)
      let accepted = 0, total = 0;
      for (const gk of Object.values(sg)) {
        for (const sk of Object.values(gk)) {
          if (!sk?.apps) continue;
          for (const [k, v] of Object.entries(sk.apps)) {
            total += v.length;
            if (ACCEPTED_KEYS.has(k)) accepted += v.length;
          }
        }
      }
      // dedupe by using just one GPA/score combo
      const satApps = sg.weightedGpa?.sat?.apps || sg.gpa?.sat?.apps || {};
      let a2 = 0, t2 = 0;
      for (const [k, v] of Object.entries(satApps)) { t2 += v.length; if (ACCEPTED_KEYS.has(k)) a2 += v.length; }
      const acceptRate = t2 > 0 ? a2 / t2 : null;

      return { medGpa, medSat, avgGpa, avgSat, acceptRate, acceptedCount: a2, total: t2, gpas, sats };
    }

    function classify(stats) {
      if (!stats.medGpa && !stats.medSat) return 'unknown';
      const myGpa = MY.wTotalGpa;
      const mySat = MY.sat;
      const gpas = stats.gpas, sats = stats.sats;
      if (!gpas.length) return 'unknown';
      const pct75Gpa = gpas[Math.floor(gpas.length * 0.75)];
      const pct50Gpa = gpas[Math.floor(gpas.length * 0.50)];
      const pct25Gpa = gpas[Math.floor(gpas.length * 0.25)];
      const pct75Sat = sats.length ? sats[Math.floor(sats.length * 0.75)] : 0;
      const pct50Sat = sats.length ? sats[Math.floor(sats.length * 0.50)] : 0;
      const pct25Sat = sats.length ? sats[Math.floor(sats.length * 0.25)] : 0;
      if (myGpa >= pct75Gpa && (!sats.length || mySat >= pct75Sat)) return 'likely';
      if (myGpa >= pct50Gpa && (!sats.length || mySat >= pct50Sat)) return 'match';
      if (myGpa >= pct25Gpa && (!sats.length || mySat >= pct25Sat)) return 'match';
      return 'reach';
    }

    function tagHTML(cat) {
      const labels = { likely: 'Likely', match: 'Match', reach: 'Reach', unknown: '?' };
      return `<span class="tag tag-${cat}">${labels[cat] || cat}</span>`;
    }

    function getStableJitter(index, spread) {
      const seededRandom = (seed) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };
      return {
        x: (seededRandom(index * 2) - 0.5) * spread,
        y: (seededRandom(index * 2 + 1) - 0.5) * spread,
      };
    }

    // ══════════════════════════════════════════
    // DASHBOARD
    // ══════════════════════════════════════════
    function buildDash() {
      document.getElementById('dash-subtitle').textContent = SCHOOLS.length + ' school' + (SCHOOLS.length !== 1 ? 's' : '') + ' loaded';
      const rows = SCHOOLS.map((s, i) => {
        const st = getSchoolStats(s.raw);
        const cat = classify(st);
        const dGpa = st.medGpa ? (MY.wTotalGpa - st.medGpa) : null;
        const dSat = st.medSat ? (MY.sat - st.medSat) : null;
        return { i, name: s.name, tag: cat, acceptRate: st.acceptRate, medGpa: st.medGpa, deltaGpa: dGpa, medSat: st.medSat, deltaSat: dSat, total: st.total };
      });

      // sort
      const catOrder = { likely: 0, match: 1, reach: 2, unknown: 3 };
      rows.sort((a, b) => {
        let av = a[sortCol], bv = b[sortCol];
        if (sortCol === 'tag') { av = catOrder[av] ?? 9; bv = catOrder[bv] ?? 9; }
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === 'string') return sortDir * av.localeCompare(bv);
        return sortDir * (av - bv);
      });

      const tbody = document.getElementById('dashBody');
      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td class="school-name">${r.name}</td>
      <td>${tagHTML(r.tag)}</td>
      <td>${r.acceptRate !== null ? (r.acceptRate * 100).toFixed(0) + '%' : '<span class="no-data-cell">—</span>'}</td>
      <td class="mono">${r.medGpa !== null ? r.medGpa.toFixed(2) : '<span class="no-data-cell">—</span>'}</td>
      <td>${r.deltaGpa !== null ? `<span class="delta ${r.deltaGpa >= 0 ? 'pos' : 'neg'}">${r.deltaGpa >= 0 ? '+' : ''}${r.deltaGpa.toFixed(2)}</span>` : '<span class="no-data-cell">—</span>'}</td>
      <td class="mono">${r.medSat !== null ? r.medSat : '<span class="no-data-cell">—</span>'}</td>
      <td>${r.deltaSat !== null ? `<span class="delta ${r.deltaSat >= 0 ? 'pos' : 'neg'}">${r.deltaSat >= 0 ? '+' : ''}${r.deltaSat}</span>` : '<span class="no-data-cell">—</span>'}</td>
      <td class="mono" style="color:var(--muted2)">${r.total || '—'}</td>
    `;
        tr.addEventListener('click', () => showSchool(r.i));
        tbody.appendChild(tr);
      });

      // sort headers
      document.querySelectorAll('#dashTable thead th').forEach(th => {
        th.classList.toggle('sorted', th.dataset.col === sortCol);
        const arr = th.querySelector('.sort-arrow');
        if (arr && th.dataset.col === sortCol) arr.textContent = sortDir === 1 ? '↑' : '↓';
        th.onclick = () => {
          if (sortCol === th.dataset.col) sortDir *= -1; else { sortCol = th.dataset.col; sortDir = 1; }
          buildDash();
        };
      });
    }

    // ══════════════════════════════════════════
    // SINGLE SCHOOL VIEW
    // ══════════════════════════════════════════
    function buildSchoolView() {
      const s = SCHOOLS[currentSchoolIdx];
      const raw = s.raw;
      document.getElementById('s-title').textContent = s.name;

      const st = getSchoolStats(raw);
      const cat = classify(st);
      document.getElementById('s-tag-holder').innerHTML = tagHTML(cat);
      document.getElementById('s-sub').textContent = st.acceptRate !== null ? `${(st.acceptRate * 100).toFixed(0)}% accept rate · ${st.total} applicants with scores` : '';

      // reset controls UI
      document.querySelectorAll('#s-gpaToggle .ctrl-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === sGpaMode));
      document.querySelectorAll('#s-scoreToggle .ctrl-btn').forEach(b => b.classList.toggle('active', b.dataset.score === sScoreMode));

      // weighted GPA availability
      const hasW = raw.scattergrams.weightedGpa &&
        ['sat', 'act'].some(sc => Object.values(raw.scattergrams.weightedGpa[sc]?.apps || {}).some(v => v.length > 0));
      document.querySelectorAll('#s-gpaToggle .ctrl-btn').forEach(b => {
        if (b.dataset.mode === 'weightedGpa') b.disabled = !hasW;
      });

      buildSchoolFilterButtons(raw);
      renderSchool();
      buildYearBars(raw);
      buildTrendChart(raw);
    }

    function getSPoints(raw) {
      const sg = raw.scattergrams[sGpaMode];
      if (!sg) return [];
      const scoreData = sg[sScoreMode];
      if (!scoreData?.apps) return [];
      const pts = [];
      for (const [k, items] of Object.entries(scoreData.apps)) {
        for (const item of items) {
          const score = sScoreMode === 'sat'
            ? (item.studentSAT1600Composite || item.highestComboSat || 0)
            : (item.actComposite || item.actCompositeStudent || 0);
          if (score === 0) continue;
          pts.push({ gpa: item.gpa, score, outcome: k, typeName: item.typeName, isTestOptional: item.isTestOptional });
        }
      }
      return pts;
    }

    function renderSchool() { updateSchoolStats(); drawScatter(); updateMeBar(); }

    function updateSchoolStats() {
      const raw = SCHOOLS[currentSchoolIdx].raw;
      const apps = raw.scattergrams[sGpaMode]?.[sScoreMode]?.apps || {};
      let acc = 0, den = 0, wl = 0;
      for (const [k, v] of Object.entries(apps)) {
        if (k.startsWith('accepted')) acc += v.length;
        else if (k.startsWith('denied')) den += v.length;
        else wl += v.length;
      }
      const tot = acc + den + wl, rate = tot ? Math.round(acc / tot * 100) : 0;
      document.getElementById('s-stats').innerHTML = `
    <div class="stat-chip"><span class="val" style="color:var(--green)">${acc}</span><span class="lbl">Accepted</span></div>
    <div class="stat-chip"><span class="val" style="color:var(--red)">${den}</span><span class="lbl">Denied</span></div>
    <div class="stat-chip"><span class="val" style="color:var(--amber)">${wl}</span><span class="lbl">Waitlisted</span></div>
    <div class="stat-chip"><span class="val">${rate}%</span><span class="lbl">Accept rate</span></div>
    <div class="stat-chip"><span class="val">${tot}</span><span class="lbl">w/ scores</span></div>
  `;
    }

    function updateMeBar() {
      const isW = sGpaMode === 'weightedGpa';
      document.getElementById('s-me-label').innerHTML = isW
        ? `W GPA (Acad) <input type="number" step="0.01" class="my-input" data-key="wAcadGpa" value="${MY.wAcadGpa}"> · Total <input type="number" step="0.01" class="my-input" data-key="wTotalGpa" value="${MY.wTotalGpa}"> · 10-12 <input type="number" step="0.01" class="my-input" data-key="w1012Gpa" value="${MY.w1012Gpa}"> · SAT target <input type="number" step="10" class="my-input" data-key="sat" value="${MY.sat}"> · ACT target <input type="number" step="1" class="my-input" data-key="act" value="${MY.act}">`
        : `UW GPA <input type="number" step="0.01" class="my-input" data-key="uwGpa" value="${MY.uwGpa}"> · SAT target <input type="number" step="10" class="my-input" data-key="sat" value="${MY.sat}"> · ACT target <input type="number" step="1" class="my-input" data-key="act" value="${MY.act}">`;
    }

    function buildSchoolFilterButtons(raw) {
      const row = document.getElementById('s-filterRow');
      while (row.children.length > 1) row.removeChild(row.lastChild);
      const existing = new Set();
      for (const gk of Object.values(raw.scattergrams))
        for (const sk of Object.values(gk))
          if (sk?.apps) Object.keys(sk.apps).forEach(k => existing.add(k));
      sHidden = new Set([...existing].filter(k => !DEFAULT_VISIBLE.has(k)));
      for (const [key, cfg] of Object.entries(OUTCOMES)) {
        if (!existing.has(key)) continue;
        const isOn = !sHidden.has(key);
        const btn = document.createElement('button');
        btn.className = 'filter-btn ' + (isOn ? 'on' : 'off');
        btn.dataset.key = key; btn.style.borderColor = cfg.color;
        btn.style.background = isOn ? cfg.color : 'transparent';
        btn.innerHTML = `<span class="fdot"></span>${cfg.label}`;
        btn.addEventListener('click', () => {
          if (sHidden.has(key)) { sHidden.delete(key); btn.classList.replace('off', 'on'); btn.style.background = cfg.color; }
          else { sHidden.add(key); btn.classList.replace('on', 'off'); btn.style.background = 'transparent'; }
          drawScatter();
        });
        row.appendChild(btn);
      }
    }

    // ── scatter canvas ──
    function drawScatter() {
      const raw = SCHOOLS[currentSchoolIdx].raw;
      const pts = getSPoints(raw);
      const canvas = document.getElementById('scatterCanvas');
      const noData = document.getElementById('s-nodata');
      if (pts.length === 0) { canvas.style.display = 'none'; noData.classList.remove('hidden'); return; }
      canvas.style.display = 'block'; noData.classList.add('hidden');

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.parentElement.clientWidth - 36;
      const H = Math.max(340, Math.min(480, window.innerHeight * 0.44));
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      const pad = { top: 20, right: 24, bottom: 48, left: 54 };
      const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;

      const allGpas = pts.map(p => p.gpa), allScores = pts.map(p => p.score);
      const gpaMin = Math.max(0, Math.floor((Math.min(...allGpas) - 0.2) * 4) / 4);
      const gpaMax = Math.ceil((Math.max(...allGpas) + 0.1) * 4) / 4;
      const sMin = sScoreMode === 'sat' ? Math.floor((Math.min(...allScores) - 50) / 100) * 100 : Math.floor(Math.min(...allScores) - 1);
      const sMax = sScoreMode === 'sat' ? Math.ceil((Math.max(...allScores) + 50) / 100) * 100 : Math.ceil(Math.max(...allScores) + 1);

      ctx.clearRect(0, 0, W, H);

      // grid
      for (let g = Math.ceil(gpaMin / 0.5) * 0.5; g <= gpaMax; g = +(g + 0.5).toFixed(2)) {
        const y = pad.top + ph - ((g - gpaMin) / (gpaMax - gpaMin)) * ph;
        ctx.strokeStyle = '#141820'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
        ctx.fillStyle = '#3a4255'; ctx.font = '500 10px monospace'; ctx.textAlign = 'right';
        ctx.fillText(g.toFixed(1), pad.left - 7, y + 4);
      }
      const sStep = sScoreMode === 'sat' ? 100 : 2;
      for (let s = Math.ceil(sMin / sStep) * sStep; s <= sMax; s += sStep) {
        const x = pad.left + ((s - sMin) / (sMax - sMin)) * pw;
        ctx.strokeStyle = '#141820'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ph); ctx.stroke();
        ctx.fillStyle = '#3a4255'; ctx.font = '500 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(s, x, pad.top + ph + 15);
      }
      ctx.fillStyle = '#5a6478'; ctx.font = '500 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(sScoreMode === 'sat' ? 'SAT Score' : 'ACT Score', pad.left + pw / 2, H - 6);
      ctx.save(); ctx.translate(13, pad.top + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText(sGpaMode === 'gpa' ? 'Unweighted GPA' : 'Weighted GPA', 0, 0); ctx.restore();

      // avg accepted lines
      const st = getSchoolStats(raw);
      if (st.avgGpa && st.avgGpa >= gpaMin && st.avgGpa <= gpaMax) {
        const ay = pad.top + ph - ((st.avgGpa - gpaMin) / (gpaMax - gpaMin)) * ph;
        ctx.strokeStyle = 'rgba(0,230,118,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(pad.left, ay); ctx.lineTo(pad.left + pw, ay); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,230,118,0.5)'; ctx.font = '500 9px monospace'; ctx.textAlign = 'left';
        ctx.fillText('avg acc GPA ' + st.avgGpa.toFixed(2), pad.left + 4, ay - 4);
      }
      if (sScoreMode === 'sat' && st.avgSat && st.avgSat >= sMin && st.avgSat <= sMax) {
        const ax = pad.left + ((st.avgSat - sMin) / (sMax - sMin)) * pw;
        ctx.strokeStyle = 'rgba(0,230,118,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(ax, pad.top); ctx.lineTo(ax, pad.top + ph); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,230,118,0.5)'; ctx.font = '500 9px monospace'; ctx.textAlign = 'center';
        ctx.fillText('avg ' + Math.round(st.avgSat), ax, pad.top + 12);
      }

      // ME lines
      const myGpa = sGpaMode === 'gpa' ? MY.uwGpa : MY.wTotalGpa;
      let uy = null, vx = null;
      if (myGpa > gpaMin && myGpa < gpaMax) {
        uy = pad.top + ph - ((myGpa - gpaMin) / (gpaMax - gpaMin)) * ph;
        ctx.strokeStyle = 'rgba(0,229,255,0.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad.left, uy); ctx.lineTo(pad.left + pw, uy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,229,255,0.55)'; ctx.font = '600 9px monospace'; ctx.textAlign = 'left';
        ctx.fillText('MY GPA', pad.left + 4, uy - 4);
      }
      if (sScoreMode === 'sat' && MY.sat >= sMin && MY.sat <= sMax) {
        vx = pad.left + ((MY.sat - sMin) / (sMax - sMin)) * pw;
        ctx.strokeStyle = 'rgba(0,229,255,0.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(vx, pad.top); ctx.lineTo(vx, pad.top + ph); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,229,255,0.55)'; ctx.font = '600 9px monospace'; ctx.textAlign = 'center';
        ctx.fillText(MY.sat, vx, pad.top + 12);
      }
      // star at crossing
      if (uy !== null && vx !== null) {
        drawStar(ctx, vx, uy, 8, 3.5, 5, '#00e5ff', true);
        ctx.fillStyle = 'rgba(0,229,255,0.9)'; ctx.font = '700 9px monospace'; ctx.textAlign = 'left';
        ctx.fillText('ME', vx + 11, uy + 4);
      }

      // dots
      canvas._pts = [];
      for (const [i, pt] of pts.entries()) {
        const cfg = OUTCOMES[pt.outcome];
        const color = cfg ? cfg.color : '#aaa';
        const x = pad.left + ((pt.score - sMin) / (sMax - sMin)) * pw;
        const y = pad.top + ph - ((pt.gpa - gpaMin) / (gpaMax - gpaMin)) * ph;
        const jitter = getStableJitter(i, 5);
        const jx = jitter.x;
        const jy = jitter.y;
        canvas._pts.push({ ...pt, cx: x + jx, cy: y + jy });
        if (sHidden.has(pt.outcome)) continue;
        ctx.beginPath(); ctx.arc(x + jx, y + jy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = color + 'bb'; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.stroke();
      }
    }

    function drawStar(ctx, x, y, R, r, spikes, color, glow = false) {
      ctx.save(); ctx.translate(x, y);
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI / spikes) - Math.PI / 2;
        const rad = i % 2 === 0 ? R : r;
        i === 0 ? ctx.moveTo(Math.cos(angle) * rad, Math.sin(angle) * rad) : ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
      }
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
    }

    // ── scatter tooltip ──
    document.getElementById('scatterCanvas').addEventListener('mousemove', e => {
      const canvas = document.getElementById('scatterCanvas');
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let closest = null, minD = 18;
      for (const pt of (canvas._pts || [])) {
        if (sHidden.has(pt.outcome)) continue;
        const d = Math.hypot(pt.cx - mx, pt.cy - my);
        if (d < minD) { minD = d; closest = pt; }
      }
      const tt = document.getElementById('tooltip');
      if (closest) {
        const cfg = OUTCOMES[closest.outcome]; const color = cfg ? cfg.color : '#aaa';
        tt.innerHTML = `<div class="tt-head" style="color:${color}">${cfg ? cfg.label : closest.outcome}</div>
      <div class="tt-row"><span>GPA</span><span>${closest.gpa.toFixed(2)}</span></div>
      <div class="tt-row"><span>${sScoreMode.toUpperCase()}</span><span>${closest.score}</span></div>
      <div class="tt-row"><span>Round</span><span>${closest.typeName}</span></div>
      ${closest.isTestOptional ? '<div class="tt-row"><span>Test</span><span style="color:var(--amber)">Optional</span></div>' : ''}`;
        tt.style.left = (e.clientX + 14) + 'px'; tt.style.top = (e.clientY - 10) + 'px';
        tt.classList.add('visible');
      } else tt.classList.remove('visible');
    });
    document.getElementById('scatterCanvas').addEventListener('mouseleave', () => document.getElementById('tooltip').classList.remove('visible'));

    // ── controls ──
    document.getElementById('s-gpaToggle').addEventListener('click', e => {
      const btn = e.target.closest('.ctrl-btn'); if (!btn || btn.disabled) return;
      document.querySelectorAll('#s-gpaToggle .ctrl-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); sGpaMode = btn.dataset.mode; renderSchool();
    });
    document.getElementById('s-scoreToggle').addEventListener('click', e => {
      const btn = e.target.closest('.ctrl-btn'); if (!btn) return;
      document.querySelectorAll('#s-scoreToggle .ctrl-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); sScoreMode = btn.dataset.score; renderSchool();
    });

    // ── year bars ──
    function buildYearBars(raw) {
      const byYear = raw.applicationsByYear || {}, years = Object.keys(byYear).sort();
      if (!years.length) return;
      const maxApplied = Math.max(...years.map(y => byYear[y].totalApplied || 0));
      const container = document.getElementById('s-yearBars'); container.innerHTML = '';
      for (const yr of years) {
        const d = byYear[yr], applied = d.totalApplied || 0, accepted = d.totalAccepted || 0;
        const col = document.createElement('div'); col.className = 'year-col';
        const aH = (applied / maxApplied) * 60, acH = accepted ? (accepted / maxApplied) * 60 : 0;
        col.innerHTML = `
      <div class="year-nums">
        ${accepted ? `<div class="na">${accepted}</div>` : '<div style="height:1em"></div>'}
        <div class="nap">${applied}</div>
      </div>
      <div class="year-bar-wrap" style="height:60px">
        <div class="bar-applied" style="height:${aH}px"></div>
        ${accepted ? `<div class="bar-accepted" style="height:${acH}px"></div>` : ''}
      </div>
      <div class="year-label">${yr}</div>`;
        container.appendChild(col);
      }
    }

    // ── trend line chart ──
    function buildTrendChart(raw) {
      const byYear = raw.applicationsByYear || {};
      const years = Object.keys(byYear).sort().filter(y => {
        const d = byYear[y]; return d.totalApplied && d.totalAccepted;
      });
      const canvas = document.getElementById('trendChart');
      const W = canvas.parentElement.clientWidth - 32;
      const H = 90;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      if (years.length < 2) {
        ctx.fillStyle = '#3a4255'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText('Not enough year data', W / 2, H / 2); return;
      }

      const rates = years.map(y => byYear[y].totalAccepted / byYear[y].totalApplied);
      const pad = { top: 12, right: 16, bottom: 24, left: 36 };
      const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;
      const minR = Math.max(0, Math.min(...rates) - 0.05), maxR = Math.min(1, Math.max(...rates) + 0.05);

      const px = (i) => pad.left + (i / (years.length - 1)) * pw;
      const py = (r) => pad.top + ph - ((r - minR) / (maxR - minR || 1)) * ph;

      // grid lines at 0%, 10%, etc
      ctx.strokeStyle = '#141820'; ctx.lineWidth = 1;
      for (let r = Math.ceil(minR * 10) / 10; r <= maxR; r = +(r + 0.1).toFixed(2)) {
        const y = py(r);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
        ctx.fillStyle = '#3a4255'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
        ctx.fillText((r * 100).toFixed(0) + '%', pad.left - 4, y + 3);
      }

      // gradient fill
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
      grad.addColorStop(0, 'rgba(0,229,255,0.2)'); grad.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.beginPath(); ctx.moveTo(px(0), py(rates[0]));
      for (let i = 1; i < rates.length; i++) ctx.lineTo(px(i), py(rates[i]));
      ctx.lineTo(px(rates.length - 1), pad.top + ph); ctx.lineTo(px(0), pad.top + ph); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      // line
      ctx.beginPath(); ctx.moveTo(px(0), py(rates[0]));
      for (let i = 1; i < rates.length; i++) ctx.lineTo(px(i), py(rates[i]));
      ctx.strokeStyle = 'var(--accent)'; ctx.lineWidth = 1.5; ctx.stroke();

      // dots + labels
      for (let i = 0; i < rates.length; i++) {
        ctx.beginPath(); ctx.arc(px(i), py(rates[i]), 3, 0, Math.PI * 2);
        ctx.fillStyle = 'var(--accent)'; ctx.fill();
        ctx.fillStyle = '#3a4255'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        ctx.fillText(years[i].slice(2), px(i), pad.top + ph + 14);
      }
    }

    // ══════════════════════════════════════════
    // COMPARE VIEW
    // ══════════════════════════════════════════
    function buildCompare() {
      // school pills
      const picker = document.getElementById('c-picker');
      while (picker.children.length > 1) picker.removeChild(picker.lastChild);
      SCHOOLS.forEach((s, i) => {
        const color = SCHOOL_COLORS[i % SCHOOL_COLORS.length];
        const pill = document.createElement('button');
        pill.className = 'school-pill ' + (cVisibleSchools.has(i) ? 'on' : 'off');
        pill.style.borderColor = color; pill.style.color = color;
        pill.textContent = s.name;
        pill.addEventListener('click', () => {
          if (cVisibleSchools.has(i)) cVisibleSchools.delete(i); else cVisibleSchools.add(i);
          pill.classList.toggle('off', !cVisibleSchools.has(i));
          renderCompare();
        });
        picker.appendChild(pill);
      });

      // tab handlers
      document.querySelectorAll('.compare-tab').forEach(t => {
        t.onclick = () => {
          cActiveTab = t.dataset.ctab;
          document.querySelectorAll('.compare-tab').forEach(x => x.classList.toggle('active', x === t));
          const showScore = cActiveTab === 'overlay' || cActiveTab === 'mydot';
          document.getElementById('c-scoreControls').style.display = showScore ? 'flex' : 'none';
          renderCompare();
        };
      });

      document.getElementById('c-gpaToggle').addEventListener('click', e => {
        const btn = e.target.closest('.ctrl-btn'); if (!btn) return;
        document.querySelectorAll('#c-gpaToggle .ctrl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); cGpaMode = btn.dataset.mode; renderCompare();
      });
      document.getElementById('c-scoreToggle').addEventListener('click', e => {
        const btn = e.target.closest('.ctrl-btn'); if (!btn) return;
        document.querySelectorAll('#c-scoreToggle .ctrl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); cScoreMode = btn.dataset.score; renderCompare();
      });

      renderCompare();
    }

    function renderCompare() {
      document.getElementById('c-mydotTable').classList.add('hidden');
      document.getElementById('c-ratesWrap').classList.add('hidden');
      document.getElementById('c-chartWrap').style.display = 'block';

      if (cActiveTab === 'overlay') drawCompareOverlay();
      else if (cActiveTab === 'mydot') drawMyDotView();
      else drawRatesView();
    }

    function getAcceptedPoints(raw, gpaMode, scoreMode) {
      const apps = raw.scattergrams[gpaMode]?.[scoreMode]?.apps || {};
      const pts = [];
      for (const [k, items] of Object.entries(apps)) {
        if (!ACCEPTED_KEYS.has(k)) continue;
        for (const item of items) {
          const score = scoreMode === 'sat' ? (item.studentSAT1600Composite || item.highestComboSat || 0) : (item.actComposite || 0);
          if (score > 0) pts.push({ gpa: item.gpa, score });
        }
      }
      return pts;
    }

    function drawCompareOverlay() {
      const canvas = document.getElementById('compareCanvas');
      const allPts = [];
      SCHOOLS.forEach((s, i) => {
        if (!cVisibleSchools.has(i)) return;
        const apps = s.raw.scattergrams[cGpaMode]?.[cScoreMode]?.apps || {};
        for (const [k, items] of Object.entries(apps)) {
          if (!ACCEPTED_KEYS.has(k)) continue;
          for (const item of items) {
            const score = cScoreMode === 'sat' ? (item.studentSAT1600Composite || item.highestComboSat || 0) : (item.actComposite || 0);
            if (score > 0) allPts.push({ gpa: item.gpa, score, schoolIdx: i, schoolName: s.name });
          }
        }
      });

      canvas.style.display = 'block';

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.parentElement.clientWidth - 36;
      const H = Math.max(340, Math.min(480, window.innerHeight * 0.44));
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      const pad = { top: 20, right: 24, bottom: 48, left: 54 };
      const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;

      const myGpa = cGpaMode === 'gpa' ? MY.uwGpa : MY.wTotalGpa;
      const myScore = cScoreMode === 'sat' ? MY.sat : (MY.act || 34);
      const gpas = [...allPts.map(p => p.gpa), myGpa];
      const scores = [...allPts.map(p => p.score), myScore];
      const gpaMin = Math.max(0, Math.floor((Math.min(...gpas) - 0.2) * 4) / 4);
      const gpaMax = Math.ceil((Math.max(...gpas) + 0.1) * 4) / 4;
      const sMin = cScoreMode === 'sat' ? Math.floor((Math.min(...scores) - 50) / 100) * 100 : Math.floor(Math.min(...scores) - 1);
      const sMax = cScoreMode === 'sat' ? Math.ceil((Math.max(...scores) + 50) / 100) * 100 : Math.ceil(Math.max(...scores) + 1);

      ctx.clearRect(0, 0, W, H);
      // grid
      for (let g = Math.ceil(gpaMin / 0.5) * 0.5; g <= gpaMax; g = +(g + 0.5).toFixed(2)) {
        const y = pad.top + ph - ((g - gpaMin) / (gpaMax - gpaMin)) * ph;
        ctx.strokeStyle = '#141820'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
        ctx.fillStyle = '#3a4255'; ctx.font = '500 10px monospace'; ctx.textAlign = 'right';
        ctx.fillText(g.toFixed(1), pad.left - 7, y + 4);
      }
      const sStep = cScoreMode === 'sat' ? 100 : 2;
      for (let s = Math.ceil(sMin / sStep) * sStep; s <= sMax; s += sStep) {
        const x = pad.left + ((s - sMin) / (sMax - sMin)) * pw;
        ctx.strokeStyle = '#141820'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ph); ctx.stroke();
        ctx.fillStyle = '#3a4255'; ctx.font = '500 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(s, x, pad.top + ph + 15);
      }
      ctx.fillStyle = '#5a6478'; ctx.font = '500 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(cScoreMode === 'sat' ? 'SAT' : 'ACT', pad.left + pw / 2, H - 6);
      ctx.save(); ctx.translate(13, pad.top + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText(cGpaMode === 'gpa' ? 'Unweighted GPA' : 'Weighted GPA', 0, 0); ctx.restore();

      // ME lines
      let uy = null, vx = null;
      if (myGpa > gpaMin && myGpa < gpaMax) {
        uy = pad.top + ph - ((myGpa - gpaMin) / (gpaMax - gpaMin)) * ph;
        ctx.strokeStyle = 'rgba(0,229,255,0.2)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad.left, uy); ctx.lineTo(pad.left + pw, uy); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (myScore >= sMin && myScore <= sMax) {
        vx = pad.left + ((myScore - sMin) / (sMax - sMin)) * pw;
        ctx.strokeStyle = 'rgba(0,229,255,0.2)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(vx, pad.top); ctx.lineTo(vx, pad.top + ph); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (uy !== null && vx !== null) drawStar(ctx, vx, uy, 8, 3.5, 5, '#00e5ff', true);

      // dots by school
      canvas._cpts = [];
      for (const [i, pt] of allPts.entries()) {
        const color = SCHOOL_COLORS[pt.schoolIdx % SCHOOL_COLORS.length];
        const x = pad.left + ((pt.score - sMin) / (sMax - sMin)) * pw;
        const y = pad.top + ph - ((pt.gpa - gpaMin) / (gpaMax - gpaMin)) * ph;
        const jitter = getStableJitter(i, 5);
        const jx = jitter.x;
        const jy = jitter.y;
        canvas._cpts.push({ ...pt, cx: x + jx, cy: y + jy });
        ctx.beginPath(); ctx.arc(x + jx, y + jy, 5, 0, Math.PI * 2);
        ctx.fillStyle = color + '99'; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.stroke();
      }

      // legend
      let lx = pad.left; const ly = H - 6;
      SCHOOLS.forEach((s, i) => {
        if (!cVisibleSchools.has(i)) return;
        const color = SCHOOL_COLORS[i % SCHOOL_COLORS.length];
        ctx.beginPath(); ctx.arc(lx + 5, ly - 4, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = color; ctx.font = '600 9px monospace'; ctx.textAlign = 'left';
        ctx.fillText(s.name, lx + 12, ly);
        lx += ctx.measureText(s.name).width + 24;
      });
    }

    function drawMyDotView() {
      const canvas = document.getElementById('compareCanvas');
      // For each visible school, show accepted cluster + my dot
      const allPts = [];
      SCHOOLS.forEach((s, i) => {
        if (!cVisibleSchools.has(i)) return;
        const pts = getAcceptedPoints(s.raw, cGpaMode, cScoreMode);
        pts.forEach(p => allPts.push({ ...p, schoolIdx: i, schoolName: s.name }));
      });
      canvas.style.display = 'block';

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.parentElement.clientWidth - 36;
      const H = Math.max(340, Math.min(480, window.innerHeight * 0.44));
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      const pad = { top: 20, right: 24, bottom: 48, left: 54 };
      const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;

      const myGpa = cGpaMode === 'gpa' ? MY.uwGpa : MY.wTotalGpa;
      const myScore = cScoreMode === 'sat' ? MY.sat : (MY.act || 34);
      const allGpas = [...allPts.map(p => p.gpa), myGpa];
      const allScores = [...allPts.map(p => p.score), myScore];
      const gpaMin = Math.max(0, Math.floor((Math.min(...allGpas) - 0.3) * 4) / 4);
      const gpaMax = Math.ceil((Math.max(...allGpas) + 0.1) * 4) / 4;
      const sMin = cScoreMode === 'sat' ? Math.floor((Math.min(...allScores) - 50) / 100) * 100 : Math.floor(Math.min(...allScores) - 1);
      const sMax = cScoreMode === 'sat' ? Math.ceil((Math.max(...allScores) + 50) / 100) * 100 : Math.ceil(Math.max(...allScores) + 1);

      ctx.clearRect(0, 0, W, H);
      for (let g = Math.ceil(gpaMin / 0.5) * 0.5; g <= gpaMax; g = +(g + 0.5).toFixed(2)) {
        const y = pad.top + ph - ((g - gpaMin) / (gpaMax - gpaMin)) * ph;
        ctx.strokeStyle = '#141820'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
        ctx.fillStyle = '#3a4255'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
        ctx.fillText(g.toFixed(1), pad.left - 5, y + 3);
      }
      const sStep = cScoreMode === 'sat' ? 100 : 2;
      for (let s = Math.ceil(sMin / sStep) * sStep; s <= sMax; s += sStep) {
        const x = pad.left + ((s - sMin) / (sMax - sMin)) * pw;
        ctx.strokeStyle = '#141820'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ph); ctx.stroke();
        ctx.fillStyle = '#3a4255'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        ctx.fillText(s, x, pad.top + ph + 14);
      }
      ctx.fillStyle = '#5a6478'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(cScoreMode === 'sat' ? 'SAT' : 'ACT', pad.left + pw / 2, H - 5);

      // ME lines
      if (myGpa > gpaMin && myGpa < gpaMax) {
        const uy = pad.top + ph - ((myGpa - gpaMin) / (gpaMax - gpaMin)) * ph;
        ctx.strokeStyle = 'rgba(0,229,255,0.2)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad.left, uy); ctx.lineTo(pad.left + pw, uy); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (myScore >= sMin && myScore <= sMax) {
        const vx = pad.left + ((myScore - sMin) / (sMax - sMin)) * pw;
        ctx.strokeStyle = 'rgba(0,229,255,0.2)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(vx, pad.top); ctx.lineTo(vx, pad.top + ph); ctx.stroke();
        ctx.setLineDash([]);
      }

      // draw hulls per school (convex hull approximation: just scatter with alpha)
      canvas._cpts = [];
      for (const [i, pt] of allPts.entries()) {
        const color = SCHOOL_COLORS[pt.schoolIdx % SCHOOL_COLORS.length];
        const x = pad.left + ((pt.score - sMin) / (sMax - sMin)) * pw;
        const y = pad.top + ph - ((pt.gpa - gpaMin) / (gpaMax - gpaMin)) * ph;
        const jitter = getStableJitter(i, 4);
        const jx = jitter.x;
        const jy = jitter.y;
        canvas._cpts.push({ ...pt, cx: x + jx, cy: y + jy });
        ctx.beginPath(); ctx.arc(x + jx, y + jy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color + '55'; ctx.fill();
        ctx.strokeStyle = color + '88'; ctx.lineWidth = 0.7; ctx.stroke();
      }

      // MY star
      const mx = pad.left + ((myScore - sMin) / (sMax - sMin)) * pw;
      const my2 = pad.top + ph - ((myGpa - gpaMin) / (gpaMax - gpaMin)) * ph;
      drawStar(ctx, mx, my2, 10, 4, 5, '#00e5ff', true);
      ctx.fillStyle = 'rgba(0,229,255,0.9)'; ctx.font = '700 10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('ME', mx + 13, my2 + 4);

      // legend
      let lx = pad.left;
      SCHOOLS.forEach((s, i) => {
        if (!cVisibleSchools.has(i)) return;
        const color = SCHOOL_COLORS[i % SCHOOL_COLORS.length];
        ctx.beginPath(); ctx.arc(lx + 5, H - 6, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = color; ctx.font = '600 9px monospace'; ctx.textAlign = 'left';
        ctx.fillText(s.name, lx + 12, H - 3);
        lx += ctx.measureText(s.name).width + 24;
      });
    }

    function drawRatesView() {
      document.getElementById('c-chartWrap').style.display = 'none';
      document.getElementById('c-ratesWrap').classList.remove('hidden');
      const wrap = document.getElementById('c-ratesWrap');

      const rows = SCHOOLS.map((s, i) => {
        const st = getSchoolStats(s.raw);
        const cat = classify(st);
        return { name: s.name, i, rate: st.acceptRate, cat };
      }).filter(r => r.rate !== null).sort((a, b) => b.rate - a.rate);

      const maxRate = Math.max(...rows.map(r => r.rate));
      wrap.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;">
      <div style="font-family:monospace;font-size:0.65rem;color:var(--muted2);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">Accept Rate by School (your data)</div>
      ${rows.map((r, ri) => {
        const color = SCHOOL_COLORS[r.i % SCHOOL_COLORS.length];
        const pct = (r.rate * 100).toFixed(1);
        const barW = Math.max(2, (r.rate / maxRate) * 100);
        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;" data-idx="${r.i}" class="rate-row" style="cursor:pointer">
          <div style="width:160px;font-family:monospace;font-size:0.72rem;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;" >${r.name}</div>
          <div style="flex:1;background:var(--border);border-radius:3px;height:20px;position:relative;cursor:pointer">
            <div style="height:100%;width:${barW}%;background:${color}55;border-radius:3px;border-right:2px solid ${color};transition:width 0.3s;"></div>
          </div>
          <div style="width:48px;font-family:monospace;font-size:0.72rem;color:${color};text-align:right;">${pct}%</div>
          ${tagHTML(r.cat)}
        </div>`;
      }).join('')}
    </div>`;
      wrap.querySelectorAll('.rate-row').forEach(el => {
        el.addEventListener('click', () => showSchool(parseInt(el.dataset.idx, 10)));
      });

    }

    // canvas tooltip for compare
    document.getElementById('compareCanvas').addEventListener('mousemove', e => {
      const canvas = document.getElementById('compareCanvas');
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let closest = null, minD = 18;
      for (const pt of (canvas._cpts || [])) {
        const d = Math.hypot(pt.cx - mx, pt.cy - my);
        if (d < minD) { minD = d; closest = pt; }
      }
      const tt = document.getElementById('tooltip');
      if (closest) {
        const color = SCHOOL_COLORS[closest.schoolIdx % SCHOOL_COLORS.length];
        tt.innerHTML = `<div class="tt-head" style="color:${color}">${closest.schoolName}</div>
      <div class="tt-row"><span>GPA</span><span>${closest.gpa.toFixed(2)}</span></div>
      <div class="tt-row"><span>${cScoreMode.toUpperCase()}</span><span>${closest.score}</span></div>`;
        tt.style.left = (e.clientX + 14) + 'px'; tt.style.top = (e.clientY - 10) + 'px';
        tt.classList.add('visible');
      } else tt.classList.remove('visible');
    });
    document.getElementById('compareCanvas').addEventListener('mouseleave', () => document.getElementById('tooltip').classList.remove('visible'));

    window.addEventListener('resize', () => {
      if (document.getElementById('v-school').classList.contains('active')) {
        drawScatter();
        if (SCHOOLS[currentSchoolIdx]) buildTrendChart(SCHOOLS[currentSchoolIdx].raw);
      }
      if (document.getElementById('v-compare').classList.contains('active')) renderCompare();
    });
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-load-json')?.addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('btn-load-db')?.addEventListener('click', () => loadFromDB());
  document.getElementById('btn-dash-compare')?.addEventListener('click', () => showCompare());
  document.getElementById('btn-dash-load-db')?.addEventListener('click', () => loadFromDB());
  document.getElementById('btn-dash-load-json')?.addEventListener('click', () => document.getElementById('fileInput').click());
  
  // Both back buttons can be grabbed if there was only one, but we have two IDs now. Let's just bind both to showDash()
  document.querySelectorAll('#btn-school-dash, #btn-compare-dash, .back-btn').forEach(b => {
      b.addEventListener('click', () => showDash());
  });
  
  document.getElementById('btn-school-compare')?.addEventListener('click', () => showCompare());
});

document.addEventListener('input', (e) => {
  if (e.target.classList.contains('my-input')) {
    const key = e.target.dataset.key;
    if (key) {
      MY[key] = parseFloat(e.target.value) || 0;
      
      // sync values locally to other identical inputs implicitly
      document.querySelectorAll(`.my-input[data-key="${key}"]`).forEach(input => {
        if (input !== e.target) input.value = e.target.value;
      });

      if (document.getElementById('v-dash').classList.contains('active')) buildDash();
      if (document.getElementById('v-school').classList.contains('active')) drawScatter();
      if (document.getElementById('v-compare').classList.contains('active')) renderCompare();
    }
  }
});
