(() => {
  if (window.__TACTILE_LOADED__) return;
  window.__TACTILE_LOADED__ = true;

  // =========================================================================
  // ГЛОБАЛЬНЫЕ НАСТРОЙКИ ТАКТИЛЬНОГО ПОВЕДЕНИЯ (МЕНЯЙ ЗДЕСЬ ПОД СВОЙ ВКУС)
  // =========================================================================
  window.TACTILE_CONFIG = {
    // 1. Геометрия нажатия
    pressScale:      0.900,  // Насколько сжимается элемент при нажатии (1 = без сжатия)
    recoil:          0.011,  // Импульс легкой отдачи («выдоха») при отпускании пальца

    // 2. Магнитное притяжение за пальцем (в пикселях)
    magnetX:         5,      // Максимальный сдвиг по горизонтали
    magnetY:         3.5,    // Максимальный сдвиг по вертикали
    magnetFactorX:   0.06,   // Чувствительность магнита по X
    magnetFactorY:   0.12,   // Чувствительность магнита по Y

    // 3. Физика пружины (нажатие vs отпускание)
    pressStiffness:  0.12,   // Жесткость при нажатии (чем выше, тем резче отклик)
    pressDamping:    0.82,   // Трение при нажатии
    releaseStiffness:0.14,   // Жесткость при отпускании (меньше = плавнее возврат)
    releaseDamping:  0.80,   // Трение при отпускании (выше = длиннее бархатный шлейф)

    // 4. Автоматическая подсветка фона при нажатии
    pressBrightness: 14,     // На сколько единиц RGB элемент становится светлее при тапе (0 = выкл)
    colorFadeIn:     0.28,   // Скорость осветления при нажатии
    colorFadeOut:    0.10,   // Скорость возврата исходного цвета после отпускания

    // 5. Световой блик под подушечкой пальца
    sheen:           true,   // Включить/выключить световой блик
    sheenSize:       110,    // Радиус светового пятна в пикселях
    sheenAlpha:      0.14,   // Максимальная яркость блика (0.0 .. 1.0)
    sheenFadeIn:     0.25,   // Скорость появления блика
    sheenFadeOut:    0.08    // Скорость растворения блика (меньше = длиннее шлейф)
  };
  // =========================================================================

  const parseRGB = (colorStr) => {
    if (!colorStr) return null;
    if (colorStr.startsWith('#')) {
      let hex = colorStr.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const num = parseInt(hex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    const match = colorStr.match(/\d+/g);
    return match ? [Number(match[0]), Number(match[1]), Number(match[2])] : null;
  };

  window.tactile = function(target, opts = {}) {
    const el = typeof target === 'string' ? window.OBJ?.[target] : target;
    if (!el || el._tactileAttached) return el;
    el._tactileAttached = true;

    const cfg = { ...window.TACTILE_CONFIG, ...opts };

    el.gpu = true;
    el.style.overflow = 'hidden';
    el.style.userSelect = 'none';
    el.style.touchAction = 'none';
    if (!el.style.cursor) el.style.cursor = 'pointer';

    let baseX = el.x;
    let baseY = el.y;
    let baseScale = el.scale || 1;

    let baseRGB = parseRGB(el.color);
    let curBoost = 0, tgtBoost = 0;

    let sheenEl = null;
    if (cfg.sheen) {
      sheenEl = document.createElement('div');
      sheenEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;z-index:1;';
      el.appendChild(sheenEl);
    }

    let isPressed = false;
    let isLooping = false;

    let scaleMult = 1, targetScaleMult = 1, velScale = 0;
    let offsetX = 0, targetOffsetX = 0, velX = 0;
    let offsetY = 0, targetOffsetY = 0, velY = 0;
    let curSheen = 0, tgtSheen = 0;

    const updateMagnet = (clientX, clientY) => {
      const centerPosX = baseX + (0.5 - el.anchorX) * el.w;
      const centerPosY = baseY + (0.5 - el.anchorY) * el.h;

      const relX = clientX - centerPosX;
      const relY = clientY - centerPosY;

      targetOffsetX = Math.max(-cfg.magnetX, Math.min(cfg.magnetX, relX * cfg.magnetFactorX));
      targetOffsetY = Math.max(-cfg.magnetY, Math.min(cfg.magnetY, relY * cfg.magnetFactorY));

      if (sheenEl) {
        const leftEdge = baseX - el.w * el.anchorX;
        const topEdge  = baseY - el.h * el.anchorY;
        const localX = clientX - leftEdge;
        const localY = clientY - topEdge;
        sheenEl.style.background = `radial-gradient(circle ${cfg.sheenSize}px at ${localX}px ${localY}px, rgba(255,255,255,${cfg.sheenAlpha}), transparent 80%)`;
      }
    };

    const loop = () => {
      if (!document.body.contains(el)) {
        isLooping = false;
        return;
      }

      const stiffness = isPressed ? cfg.pressStiffness : cfg.releaseStiffness;
      const damping   = isPressed ? cfg.pressDamping   : cfg.releaseDamping;

      velScale = (velScale + (targetScaleMult - scaleMult) * stiffness) * damping;
      scaleMult += velScale;

      velX = (velX + (targetOffsetX - offsetX) * stiffness) * damping;
      offsetX += velX;

      velY = (velY + (targetOffsetY - offsetY) * stiffness) * damping;
      offsetY += velY;

      if (sheenEl) {
        curSheen += (tgtSheen - curSheen) * (isPressed ? cfg.sheenFadeIn : cfg.sheenFadeOut);
        sheenEl.style.opacity = curSheen;
      }

      if (baseRGB && cfg.pressBrightness > 0) {
        curBoost += (tgtBoost - curBoost) * (isPressed ? cfg.colorFadeIn : cfg.colorFadeOut);
        if (curBoost > 0.05) {
          const r = Math.min(255, Math.round(baseRGB[0] + curBoost));
          const g = Math.min(255, Math.round(baseRGB[1] + curBoost));
          const b = Math.min(255, Math.round(baseRGB[2] + curBoost));
          el.color = `rgb(${r}, ${g}, ${b})`;
        } else if (tgtBoost === 0 && curBoost <= 0.05 && curBoost > 0) {
          curBoost = 0;
          el.color = `rgb(${baseRGB[0]}, ${baseRGB[1]}, ${baseRGB[2]})`;
        }
      }

      el.x = baseX + offsetX;
      el.y = baseY + offsetY;
      el.scale = baseScale * scaleMult;

      // Проверяем, успокоилась ли пружина — если да, усыпляем цикл до следующего касания!
      const isSettled = !isPressed
        && Math.abs(1 - scaleMult) < 0.0004 && Math.abs(velScale) < 0.0004
        && Math.abs(offsetX) < 0.02 && Math.abs(velX) < 0.02
        && Math.abs(offsetY) < 0.02 && Math.abs(velY) < 0.02
        && curSheen < 0.004
        && curBoost < 0.05;

      if (isSettled) {
        scaleMult = 1;
        offsetX = 0;
        offsetY = 0;
        curSheen = 0;
        curBoost = 0;
        if (sheenEl) sheenEl.style.opacity = 0;
        if (baseRGB && cfg.pressBrightness > 0) {
          el.color = `rgb(${baseRGB[0]}, ${baseRGB[1]}, ${baseRGB[2]})`;
        }
        el.x = baseX;
        el.y = baseY;
        el.scale = baseScale;
        isLooping = false;
        return;
      }

      requestAnimationFrame(loop);
    };

    const wakeUp = () => {
      if (!isLooping) {
        isLooping = true;
        requestAnimationFrame(loop);
      }
    };

    el.addEventListener('pointerdown', (e) => {
      // Если элемент перемещался или масштабировался через anim.js — фиксируем его текущую позицию как новую опорную
      if (!isLooping) {
        baseX = el.x;
        baseY = el.y;
        baseScale = el.scale || 1;
      } else {
        baseX = el.x - offsetX;
        baseY = el.y - offsetY;
        baseScale = (el.scale || 1) / (scaleMult || 1);
      }

      if (curBoost === 0) baseRGB = parseRGB(el.color) || baseRGB;

      isPressed = true;
      el.setPointerCapture(e.pointerId);
      targetScaleMult = cfg.pressScale;
      tgtSheen = 1;
      tgtBoost = cfg.pressBrightness;

      updateMagnet(e.clientX, e.clientY);
      wakeUp();

      if (cfg.onPress) cfg.onPress(el, e);
    });

    el.addEventListener('pointermove', (e) => {
      if (!isPressed) return;
      updateMagnet(e.clientX, e.clientY);
    });

    const release = (committed) => {
      if (!isPressed) return;
      isPressed = false;
      targetScaleMult = 1.0;
      targetOffsetX = 0;
      targetOffsetY = 0;
      tgtSheen = 0;
      tgtBoost = 0;
      velScale += cfg.recoil;
      wakeUp();

      if (cfg.onRelease) cfg.onRelease(el, committed);
    };

    el.addEventListener('pointerup', () => release(true));
    el.addEventListener('pointercancel', () => release(false));

    return el;
  };
})();
