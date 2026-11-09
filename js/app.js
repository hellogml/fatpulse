/* ===== FatPulse — Body Fat Percentage Calculator =====
   U.S. Navy circumference method + BMI estimate + target planning.
   All calculations local; nothing is uploaded. */
(function () {
  'use strict';

  var gender = 'm';
  var form = document.getElementById('bf-form');
  var errEl = document.getElementById('error-msg');
  var results = document.getElementById('results');

  var ageI = document.getElementById('age');
  var hI = document.getElementById('height-cm');
  var wI = document.getElementById('weight-kg');
  var neckI = document.getElementById('neck-cm');
  var waistI = document.getElementById('waist-cm');
  var hipI = document.getElementById('hip-cm');

  // ---- Sex toggle ----
  document.querySelectorAll('#gender .seg-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#gender .seg-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      gender = btn.getAttribute('data-g');
      document.getElementById('hip-field').hidden = gender !== 'f';
      hideError();
    });
  });

  function val(el) { return parseFloat(el.value); }
  function ok(n) { return !isNaN(n) && n > 0; }
  function cmToIn(cm) { return cm / 2.54; }
  function cf(n, d) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d }); }

  // ---- US Navy body fat ----
  function navyBF(gender, heightIn, neckIn, waistIn, hipIn) {
    var h1 = Math.log10(heightIn);
    if (gender === 'm') {
      var x = 1.0324 - 0.19077 * Math.log10(waistIn - neckIn) + 0.15456 * h1;
      return 495 / x - 450;
    }
    var y = 1.29579 - 0.35004 * Math.log10(waistIn + hipIn - neckIn) + 0.22100 * h1;
    return 495 / y - 450;
  }

  // ---- BMI + Deurenberg estimate ----
  function bmiCalc(weightKg, heightCm) {
    var m = heightCm / 100;
    return weightKg / (m * m);
  }
  function bmiBF(bmi, age) {
    return 1.20 * bmi + 0.23 * age - 10.8 * (gender === 'm' ? 1 : 0) - 5.4;
  }

  // ---- ACE category ----
  function category(bf, gender) {
    if (gender === 'm') {
      if (bf <= 5)  return { k: 'essential',  label: 'Essential fat',  range: '2–5%' };
      if (bf <= 13) return { k: 'athletes',   label: 'Athletes',       range: '6–13%' };
      if (bf <= 17) return { k: 'fitness',    label: 'Fitness',        range: '14–17%' };
      if (bf <= 24) return { k: 'acceptable', label: 'Acceptable',     range: '18–24%' };
      return { k: 'obese', label: 'Obesity', range: '25%+' };
    }
    if (bf <= 13) return { k: 'essential',  label: 'Essential fat',  range: '10–13%' };
    if (bf <= 20) return { k: 'athletes',   label: 'Athletes',       range: '14–20%' };
    if (bf <= 24) return { k: 'fitness',    label: 'Fitness',        range: '21–24%' };
    if (bf <= 31) return { k: 'acceptable', label: 'Acceptable',     range: '25–31%' };
    return { k: 'obese', label: 'Obesity', range: '32%+' };
  }

  var catColors = {
    essential: '#C89B3C', athletes: '#4E9E7F', fitness: '#1C6B4F',
    acceptable: '#8A7B5E', obese: '#7A5547'
  };
  var catKey = ['essential', 'athletes', 'fitness', 'acceptable', 'obese'];

  function showError(msg) { errEl.textContent = msg; errEl.classList.add('active'); results.hidden = true; }
  function hideError() { errEl.textContent = ''; errEl.classList.remove('active'); }

  function drawGauge(bf) {
    var maxBF = gender === 'm' ? 40 : 50;
    var frac = Math.max(0, Math.min(1, bf / maxBF));
    var circ = 2 * Math.PI * 52;
    var prog = document.getElementById('ring-progress');
    prog.style.strokeDashoffset = String(circ * (1 - frac));
    // color shifts with severity: emerald → gold → terracotta → brown
    var color = bf <= 17 ? (gender === 'm' ? 13 : 20) : -1;
    var col = '#1C6B4F';
    var cat = category(bf, gender).k;
    if (cat === 'athletes' || cat === 'fitness') col = '#2E8B63';
    else if (cat === 'acceptable') col = '#C89B3C';
    else if (cat === 'obese') col = '#B3261E';
    prog.style.stroke = col;
    document.getElementById('bf-value').textContent = cf(bf);
  }

  function positionMarker(bf) {
    var bar = document.querySelector('.cat-bar');
    var marker = document.getElementById('cat-marker');
    var blocks = bar.querySelectorAll('.cat-block');
    var total = bar.getBoundingClientRect().width;
    // thresholds within 0..100 of the 5 zone midpoints — map by category order
    var zone = category(bf, gender).k;
    var idx = catKey.indexOf(zone);
    // interpolate by how far into the target range the value sits
    var lo, hi;
    var male = gender === 'm';
    switch (zone) {
      case 'essential': lo = 2;   hi = male ? 5 : 13;  break;
      case 'athletes':  lo = male ? 6 : 14;  hi = male ? 13 : 20; break;
      case 'fitness':   lo = male ? 14 : 21; hi = male ? 17 : 24; break;
      case 'acceptable':lo = male ? 18 : 25; hi = male ? 24 : 31; break;
      default:          lo = male ? 25 : 32; hi = lo + 8; break;
    }
    var within = Math.max(0, Math.min(1, (bf - lo) / (hi - lo)));
    var base = (idx / 5) * total;
    marker.style.left = (base + (within / 5) * total) + 'px';
  }

  function onCalculate(e) {
    e.preventDefault();
    hideError();

    var age = val(ageI), height = val(hI), weight = val(wI), neck = val(neckI), waist = val(waistI);
    var hip = gender === 'f' ? val(hipI) : 0;
    if (!ok(age) || age < 18 || age > 99) { showError('Enter a valid age between 18 and 99.'); ageI.closest('.input-field').classList.add('invalid'); return; }
    if (!ok(height)) { showError('Enter your height in cm.'); hI.closest('.input-field').classList.add('invalid'); return; }
    if (!ok(weight)) { showError('Enter your weight in kg.'); wI.closest('.input-field').classList.add('invalid'); return; }
    if (!ok(neck)) { showError('Enter your neck measurement in cm.'); neckI.closest('.input-field').classList.add('invalid'); return; }
    if (!ok(waist)) { showError('Enter your waist measurement in cm.'); waistI.closest('.input-field').classList.add('invalid'); return; }
    if (gender === 'f' && !ok(hip)) { showError('Enter your hip measurement in cm.'); hipI.closest('.input-field').classList.add('invalid'); return; }

    var hIn = cmToIn(height), neckIn = cmToIn(neck), waistIn = cmToIn(waist), hipIn = gender === 'f' ? cmToIn(hip) : 0;
    var bf = navyBF(gender, height, neck, waist, hip); /* FIX 2026-10-04: pass cm directly (cm-coefficient intercepts 1.0324/1.29579 expect cm inputs; passing inches under-weighted BF by ~6-23 pts) */
    bf = Math.max(2, Math.min(60, bf));

    var lean = weight * (1 - bf / 100);
    var fatMass = weight - lean;
    var bmi = bmiCalc(weight, height);
    var bmiEst = Math.max(2, Math.min(60, bmiBF(bmi, age)));
    var cat = category(bf, gender);

    // render
    results.hidden = false;
    document.getElementById('bf-value').textContent = cf(bf);
    drawGauge(bf);
    document.getElementById('bf-cat').textContent = 'ACE category · ' + cat.range;
    document.getElementById('bf-title').textContent = cat.label;
    document.getElementById('bf-desc').textContent = cardDesc(bf, cat, gender);
    document.getElementById('s-lean').textContent = cf(lean, 1) + ' kg';
    document.getElementById('s-fat').textContent = cf(fatMass, 1) + ' kg';
    document.getElementById('s-bmi').textContent = cf(bmi, 1);
    document.getElementById('cmp-navy').textContent = cf(bf) + '%';
    document.getElementById('cmp-bmi').textContent = cf(bmiEst) + '%';
    positionMarker(bf);

    var diff = bmiEst - bf;
    document.getElementById('compare-note').textContent = diff >= 0
      ? 'The BMI formula estimates about ' + cf(Math.abs(diff), 1) + ' points higher than the Navy method. It leans on weight, so it can overestimate fat in muscular builds and underestimate it in some older profiles.'
      : 'The BMI formula estimates about ' + cf(Math.abs(diff), 1) + ' points lower than the Navy method here. Circumference variables can lift the Navy estimate when fat clusters around the waist.';

    // store for target planner
    results.dataset.bf = bf; results.dataset.weight = weight; results.dataset.age = age;

    // clear previous target results
    document.getElementById('target-results').hidden = true;
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function cardDesc(bf, cat, gender) {
    var male = gender === 'm';
    if (cat.k === 'essential') return 'You hold only essential fat. This range is about vital physiological function — maintain it carefully with professional guidance.';
    if (cat.k === 'athletes') return 'A lean, athletic composition. Sustaining this level requires deliberate training and nutrition discipline.';
    if (cat.k === 'fitness') return 'A healthy, fit physique. Most recreational exercisers land here, and it supports strong performance with normal metabolic function.';
    if (cat.k === 'acceptable') return 'Within the commonly acceptable zone for your sex. Shedding a bit can improve energy, sleep quality and long-term health markers.';
    return 'This range carries higher cardiometabolic risk. A moderate, sustainable fat-loss plan guided by a professional is a sensible next step.';
  }

  // ---- Target planner ----
  document.getElementById('target-btn').addEventListener('click', function () {
    if (!results.dataset.bf) { return; }
    var curBF = parseFloat(results.dataset.bf);
    var weight = parseFloat(results.dataset.weight);
    var age = parseFloat(results.dataset.age);
    var target = parseFloat(document.getElementById('target-bf').value);
    var out = document.getElementById('target-results');
    if (isNaN(target) || target <= 0 || target >= curBF) {
      out.hidden = true;
      return;
    }
    // preserve lean mass
    var lean = weight * (1 - curBF / 100);
    var targetWeight = lean / (1 - target / 100);
    var toLose = weight - targetWeight;
    // safe rate: ~1% body weight/week → about 0.5-1% body fat per month
    var bfDrop = curBF - target;
    var months = Math.max(1, Math.round((bfDrop / 0.9)));
    document.getElementById('t-weight').textContent = cf(targetWeight) + ' kg';
    document.getElementById('t-to-lose').textContent = cf(Math.max(0, toLose)) + ' kg';
    document.getElementById('t-months').textContent = '~' + months + ' mo';
    document.getElementById('target-note').textContent =
      'Holding lean mass steady, reaching ' + cf(target) + '% means weighing about ' + cf(targetWeight) +
      ' kg — roughly ' + cf(Math.max(0, toLose)) + ' kg of fat to lose. At a sustainable ~0.5–1% fat loss per month, expect about ' + months + ' months.';
    out.hidden = false;
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  form.addEventListener('submit', onCalculate);
  ['age', 'height-cm', 'weight-kg', 'neck-cm', 'waist-cm', 'hip-cm'].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('input', function () { el.closest('.input-field').classList.remove('invalid'); });
  });

  // ---- Nav toggle ----
  // ---- Cookie ----
})();

/* rate-fields: min 2 decimals on load+blur+Enter (2026-10-04) */
(function(){
  var IDS=["target-bf"];
  function padDec(el){var v=(el.value||"").trim();if(v===""||isNaN(parseFloat(v)))return;var p=v.split("."),d=p[1]||"";while(d.length<2)d+="0";if(p[0]==="")p[0]="0";el.value=p[0]+"."+d;}
  function init(id){var el=document.getElementById(id);if(!el||el.__ratePadded)return;el.__ratePadded=true;el.setAttribute("step","0.01");if(el.value)padDec(el);el.addEventListener("blur",function(){padDec(el);});el.addEventListener("keydown",function(e){if(e.key==="Enter")padDec(el);});}
  function boot(){IDS.forEach(init);}
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
  window.addEventListener("load",boot);
})();
/* nav variant: drawer-kebab */
(function(){var b=document.getElementById('fp-kebab'),d=document.getElementById('fp-drawer'),v=document.getElementById('fp-veil');if(!b||!d)return;function setOpen(o){d.classList[o?'add':'remove']('fp-on');if(v)v.hidden=!o;d.setAttribute('aria-hidden',String(!o));b.setAttribute('aria-expanded',String(o));}b.addEventListener('click',function(e){e.stopPropagation();setOpen(!d.classList.contains('fp-on'));});if(v)v.addEventListener('click',function(){setOpen(false);});d.addEventListener('click',function(e){if(e.target.closest('a'))setOpen(false);});document.addEventListener('keydown',function(e){if(e.key==='Escape')setOpen(false);});document.addEventListener('click',function(e){if(d.classList.contains('fp-on')&&!d.contains(e.target)&&!b.contains(e.target))setOpen(false);});})();

/* nav variant: overlay-move */
(function(){var ids=['fp-drawer','fp-veil'];for(var i=0;i<ids.length;i++){var m=document.getElementById(ids[i]);if(m&&m.parentNode!==document.body)document.body.appendChild(m);}})();

/* nav variant: overlay-unify-close */
(function(){var p=document.getElementById('fp-drawer');if(!p)return;if(p.parentNode!==document.body)document.body.appendChild(p);p.addEventListener('click',function(e){if(e.target===p)p.classList.remove('fp-on');});})();