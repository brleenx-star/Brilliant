(() => {
  if (window.__ANIM_LOADED__) return;
  window.__ANIM_LOADED__ = true;

  // =========================================================================
  // ПРЕСЕТЫ КРИВЫХ (МОЖНО ДОБАВЛЯТЬ СВОИ)
  // =========================================================================
  window.ANIM_EASINGS = {
    'linear':    [0.0, 0.0, 1.0, 1.0],
    'ease':      [0.25, 0.1, 0.25, 1.0],
    'in':        [0.4, 0.0, 1.0, 1.0],
    'out':       [0.0, 0.0, 0.2, 1.0],
    'in-out':    [0.4, 0.0, 0.2, 1.0],
    'spring':    [0.34, 1.56, 0.64, 1.0],
    'tactile':   [0.25, 1.0, 0.5, 1.0]
  };
  // =========================================================================

  const createBezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDerivX = (t) => (3 * ax * t + 2 * bx) * t + cx;

    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const dx = sampleX(t) - x;
        if (Math.abs(dx) < 1e-5) break;
        const d = sampleDerivX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= dx / d;
      }
      return sampleY(Math.max(0, Math.min(1, t)));
    };
  };

  const resolveEasing = (easing) => {
    if (typeof easing === 'function') return easing;
    if (!easing) return createBezier(0.0, 0.0, 0.2, 1.0);
    const str = String(easing).trim();
    if (window.ANIM_EASINGS[str]) return createBezier(...window.ANIM_EASINGS[str]);
    const match = str.match(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
    if (match) return createBezier(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
    return createBezier(0.0, 0.0, 0.2, 1.0);
  };

  const parseRGB = (val) => {
    if (typeof val !== 'string') return null;
    const s = val.trim();
    if (s.startsWith('#')) {
      let hex = s.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length !== 6) return null;
      const num = parseInt(hex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };

  const resolveEl = (target) => typeof target === 'string' ? window.OBJ?.[target] : target;

  const ENGINE_PROPS = new Set([
    'x', 'y', 'z', 'w', 'h', 'anchor', 'anchorX', 'anchorY',
    'scale', 'scaleX', 'scaleY', 'rotation', 'alpha',
    'color', 'textColor', 'radius', 'blur', 'backdrop', 'fontSize'
  ]);

  const activeTweens = [];
  let rafRunning = false;
  let lastFrameTime = 0;

  const tick = (now) => {
    // Защита от прыжка при сворачивании вкладки: максимум 64 мс за один кадр
    const rawDt = lastFrameTime ? (now - lastFrameTime) : 16.67;
    const dt = Math.min(rawDt, 64);
    lastFrameTime = now;

    for (let i = activeTweens.length - 1; i >= 0; i--) {
      const tw = activeTweens[i];

      if (!document.body.contains(tw.el)) {
        activeTweens.splice(i, 1);
        continue;
      }

      if (tw.paused) continue;

      tw.elapsed += dt;
      const rawProgress = tw.ms <= 0 ? 1 : Math.min(1, tw.elapsed / tw.ms);
      const k = tw.easeFn(rawProgress);

      if (tw.isColor) {
        const r = Math.round(tw.from[0] + (tw.to[0] - tw.from[0]) * k);
        const g = Math.round(tw.from[1] + (tw.to[1] - tw.from[1]) * k);
        const b = Math.round(tw.from[2] + (tw.to[2] - tw.from[2]) * k);
        if (tw.isSystem) {
          tw.el[tw.prop] = `rgb(${r}, ${g}, ${b})`;
        } else {
          tw.el.style[tw.prop] = `rgb(${r}, ${g}, ${b})`;
        }
      } else {
        const current = tw.from + (tw.to - tw.from) * k;
        if (tw.isSystem) {
          // Округление до 2 знаков для fontSize убирает джиттер букв в DOM
          tw.el[tw.prop] = tw.prop === 'fontSize' ? Math.round(current * 100) / 100 : current;
        } else {
          tw.el.style[tw.prop] = `${current}${tw.unit}`;
        }
      }

      if (rawProgress >= 1) {
        if (tw.prop === 'fontSize') tw.el.fontSize = tw.to;
        activeTweens.splice(i, 1);
        if (tw.onComplete) tw.onComplete(tw.el);
        if (tw.resolve) tw.resolve(tw.el);
      }
    }

    if (activeTweens.length > 0) {
      requestAnimationFrame(tick);
    } else {
      rafRunning = false;
      lastFrameTime = 0;
    }
  };

  const ensureLoop = () => {
    if (!rafRunning) {
      rafRunning = true;
      lastFrameTime = performance.now();
      requestAnimationFrame(tick);
    }
  };

  const createSingleTween = (el, prop, rawVal, ms, easeFn, onComplete, resolve) => {
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      if (activeTweens[i].el === el && activeTweens[i].prop === prop) {
        activeTweens.splice(i, 1);
      }
    }

    const isSystem = ENGINE_PROPS.has(prop);
    const isColorProp = prop === 'color' || prop === 'textColor' || prop === 'backgroundColor' || prop === 'borderColor';

    const tweenData = {
      el, prop, ms, easeFn, onComplete, resolve,
      isSystem,
      isColor: false,
      from: 0,
      to: 0,
      unit: '',
      elapsed: 0,
      paused: false
    };

    if (isColorProp) {
      const startColorStr = isSystem ? el[prop] : (el.style[prop] || getComputedStyle(el)[prop]);
      const fromRGB = parseRGB(startColorStr) || [0, 0, 0];
      const toRGB = parseRGB(String(rawVal));
      if (!toRGB) return null;

      tweenData.isColor = true;
      tweenData.from = fromRGB;
      tweenData.to = toRGB;
    } else {
      let currentNum = 0;
      let detectedUnit = '';

      if (isSystem) {
        currentNum = Number(el[prop]);
        if (Number.isNaN(currentNum)) currentNum = (prop.startsWith('scale') || prop === 'alpha') ? 1 : 0;
      } else {
        const rawCur = el.style[prop] || getComputedStyle(el)[prop] || '0';
        currentNum = parseFloat(rawCur) || 0;
        detectedUnit = String(rawCur).replace(/[-?0-9.]/g, '').trim();
      }

      const valStr = String(rawVal).trim();
      let targetNum = 0;

      if (valStr.startsWith('+=')) {
        targetNum = currentNum + (parseFloat(valStr.slice(2)) || 0);
      } else if (valStr.startsWith('-=')) {
        targetNum = currentNum - (parseFloat(valStr.slice(2)) || 0);
      } else {
        targetNum = parseFloat(valStr);
        if (Number.isNaN(targetNum)) targetNum = 0;
      }

      const explicitUnit = valStr.replace(/^[+-]=/, '').replace(/[-?0-9.]/g, '').trim();
      tweenData.from = currentNum;
      tweenData.to = targetNum;
      tweenData.unit = isSystem ? '' : (explicitUnit || detectedUnit || 'px');
    }

    activeTweens.push(tweenData);
    ensureLoop();
    return tweenData;
  };

  // =========================================================================
  // 1. ЗАПУСК:
  //    anim(OBJ.el, { property: 'scale', value: 2, ms: 300, easing: 'spring' })
  //    или мульти: anim(OBJ.el, { properties: { x: 200, alpha: 1 }, ms: 300 })
  // =========================================================================
  window.anim = function(target, opts = {}) {
    const el = resolveEl(target);
    if (!el) return Promise.resolve(null);

    const ms = opts.ms !== undefined ? Number(opts.ms) : 250;
    const easeFn = resolveEasing(opts.easing);
    const onComplete = opts.onComplete || null;

    // Режим нескольких свойств сразу: { properties: { x: 100, scale: 1.5 }, ms: 300 }
    if (opts.properties && typeof opts.properties === 'object') {
      const entries = Object.entries(opts.properties);
      if (entries.length === 0) return Promise.resolve(el);

      const promises = entries.map(([prop, val], idx) => {
        const isLast = idx === entries.length - 1;
        return new Promise((resolve) => {
          const tw = createSingleTween(el, prop, val, ms, easeFn, isLast ? onComplete : null, resolve);
          if (!tw) resolve(el);
        });
      });
      return Promise.all(promises).then(() => el);
    }

    // Режим одного свойства: { property: 'scale', value: 2, ms: 300, easing: '...' }
    if (!opts.property || opts.value === undefined) return Promise.resolve(el);

    return new Promise((resolve) => {
      const tw = createSingleTween(el, opts.property, opts.value, ms, easeFn, onComplete, resolve);
      if (!tw) resolve(el);
    });
  };

  // =========================================================================
  // 2. ПАУЗА / ПРОДОЛЖЕНИЕ / ОТКЛЮЧЕНИЕ
  // =========================================================================
  window.anim.pause = function(target, property = null) {
    const el = resolveEl(target);
    if (!el) return;
    activeTweens.forEach(tw => {
      if (tw.el === el && (!property || tw.prop === property)) tw.paused = true;
    });
  };

  window.anim.resume = function(target, property = null) {
    const el = resolveEl(target);
    if (!el) return;
    activeTweens.forEach(tw => {
      if (tw.el === el && (!property || tw.prop === property)) tw.paused = false;
    });
  };

  window.anim.stop = function(target, property = null) {
    const el = resolveEl(target);
    if (!el) return;
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      if (activeTweens[i].el === el && (!property || activeTweens[i].prop === property)) {
        activeTweens.splice(i, 1);
      }
    }
  };

  window.anim.pauseAll  = () => activeTweens.forEach(tw => tw.paused = true);
  window.anim.resumeAll = () => activeTweens.forEach(tw => tw.paused = false);
  window.anim.stopAll   = () => activeTweens.length = 0;
})();
