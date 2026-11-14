(() => {
  if (window.$shape) return;

  const cache = new Map();
  const TAU = Math.PI * 2;
  const TOP = -Math.PI / 2;

  const poly = (pts, fn) => {
    const out = new Array(pts);
    for (let i = 0; i < pts; i++) {
      const a = TOP + (i / pts) * TAU;
      const [x, y] = fn(a, i);
      out[i] = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
    }
    return `polygon(${out.join(',')})`;
  };

  const GENERATORS = {
    // 1. Google Material 3 круг с ямками: $shape('scallop', 10) или { lobes, depth, pts }
    scallop(o) {
      const lobes = o.lobes ?? o.n ?? 10;
      const depth = o.depth ?? 4.2;
      const pts   = o.pts ?? 120;
      return poly(pts, (a) => {
        const r = (50 - depth) + depth * Math.cos(lobes * (a - TOP));
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
      });
    },

    // 2. Суперэллипс (iOS / HyperOS иконка): $shape('squircle', 4.5) или { power, pts }
    squircle(o) {
      const n   = o.power ?? o.n ?? 4.5;
      const pts = o.pts ?? 64;
      const p   = 2 / n;
      return poly(pts, (a) => {
        const c = Math.cos(a), s = Math.sin(a);
        return [
          50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), p),
          50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), p)
        ];
      });
    },

    // 3. Четырёхлистник (Material 3 Expressive): $shape('clover', 4) или { lobes, depth, rotate }
    clover(o) {
      const lobes = o.lobes ?? o.n ?? 4;
      const depth = o.depth ?? 10;
      const rot   = ((o.rotate ?? (180 / lobes)) * Math.PI) / 180;
      const pts   = o.pts ?? 120;
      return poly(pts, (a) => {
        const r = (50 - depth) + depth * Math.cos(lobes * (a - TOP + rot));
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
      });
    },

    // 4. Мягкая печать / вспышка со скруглениями: $shape('softBurst', 12) или { rays, depth }
    softBurst(o) {
      const rays  = o.rays ?? o.n ?? 12;
      const depth = o.depth ?? 6.5;
      const pts   = o.pts ?? 140;
      return poly(pts, (a) => {
        const wave = 0.5 + 0.5 * Math.cos(rays * (a - TOP));
        const r = (50 - depth) + depth * Math.pow(wave, 1.4);
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
      });
    },

    // 5. Органическая галька / блоб: $shape('blob', 1) или { seed, pts }
    blob(o) {
      const seed = Number(o.seed ?? o.n ?? 1);
      const pts  = o.pts ?? 90;
      return poly(pts, (a) => {
        const r = 41
          + 4.5 * Math.sin(2 * a + seed)
          + 3.2 * Math.cos(3 * a - seed * 1.7)
          + 1.8 * Math.sin(5 * a + seed * 0.6);
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
      });
    },

    // 6. Звезда: $shape('star', 5) или { rays, inner }
    star(o) {
      const rays  = o.rays ?? o.points ?? o.n ?? 5;
      const inner = (o.inner ?? 38) * 0.5;
      return poly(rays * 2, (a, i) => {
        const r = i % 2 === 0 ? 50 : inner;
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
      });
    },

    // 7. Острая вспышка / шестерёнка для акций: $shape('burst', 14) или { teeth, depth }
    burst(o) {
      const teeth = o.teeth ?? o.n ?? 14;
      const depth = o.depth ?? 6;
      return poly(teeth * 2, (a, i) => {
        const r = i % 2 === 0 ? 50 : 50 - depth;
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
      });
    },

    // 8. Прямоугольник со скошенными углами (Chamfer): $shape('chamfer', 16) или { cut }
    chamfer(o) {
      const c = Math.max(0, Math.min(50, o.cut ?? o.n ?? 16));
      const b = 100 - c;
      return `polygon(${c}% 0%,${b}% 0%,100% ${c}%,100% ${b}%,${b}% 100%,${c}% 100%,0% ${b}%,0% ${c}%)`;
    },

    // 9. Капля / сообщение чата (3 скруглённых угла, 1 острый): $shape('teardrop', 'bl') или { corner, r }
    teardrop(o) {
      const corner = typeof o.n === 'string' ? o.n : (o.corner ?? 'bl');
      const r = o.r !== undefined ? (typeof o.r === 'number' ? o.r + 'px' : o.r) : '50%';
      const map = {
        tl: `0px ${r} ${r} ${r}`,
        tr: `${r} 0px ${r} ${r}`,
        br: `${r} ${r} 0px ${r}`,
        bl: `${r} ${r} ${r} 0px`
      };
      return `inset(0 round ${map[corner] || map.bl})`;
    },

    // 10. Лист (два противоположных угла скруглены): $shape('leaf') или { flip, r }
    leaf(o) {
      const r = o.r !== undefined ? (typeof o.r === 'number' ? o.r + 'px' : o.r) : '50%';
      return o.flip ? `inset(0 round ${r} 0px ${r} 0px)` : `inset(0 round 0px ${r} 0px ${r})`;
    },

    // 11. Билет / Купон с полукруглыми вырезами по бокам: $shape('ticket', 12) или { radius, pos }
    ticket(o) {
      const r   = Math.max(2, Math.min(40, o.radius ?? o.n ?? 12));
      const pos = Math.max(r, Math.min(100 - r, o.pos ?? 50));
      const steps = 16;
      const pts = ['0% 0%', '100% 0%'];
      for (let i = 0; i <= steps; i++) {
        const a = -Math.PI / 2 + (i / steps) * Math.PI;
        pts.push(`${(100 - r * Math.cos(a)).toFixed(1)}% ${(pos + r * Math.sin(a)).toFixed(1)}%`);
      }
      pts.push('100% 100%', '0% 100%');
      for (let i = 0; i <= steps; i++) {
        const a = Math.PI / 2 - (i / steps) * Math.PI;
        pts.push(`${(r * Math.cos(a)).toFixed(1)}% ${(pos + r * Math.sin(a)).toFixed(1)}%`);
      }
      return `polygon(${pts.join(',')})`;
    },

    // 12. Нижняя панель с вырезом под FAB (Notched Bar): $shape('notched', 14) или { rx, ry, pos }
    notched(o) {
      const rx  = Math.max(4, Math.min(45, o.rx ?? o.n ?? 14));
      const ry  = Math.max(4, Math.min(85, o.ry ?? rx * 2.4));
      const pos = Math.max(rx, Math.min(100 - rx, o.pos ?? 50));
      const steps = 24;
      const pts = ['0% 0%'];
      for (let i = 0; i <= steps; i++) {
        const a = Math.PI - (i / steps) * Math.PI;
        pts.push(`${(pos + rx * Math.cos(a)).toFixed(1)}% ${(ry * Math.sin(a)).toFixed(1)}%`);
      }
      pts.push('100% 0%', '100% 100%', '0% 100%');
      return `polygon(${pts.join(',')})`;
    },

    // 13. Тултип / Подсказка с хвостиком: $shape('tooltip', 'bottom') или { side, tail, pos }
    tooltip(o) {
      const side = typeof o.n === 'string' ? o.n : (o.side ?? 'bottom');
      const t    = Math.max(4, Math.min(40, o.tail ?? 14));
      const p    = Math.max(t, Math.min(100 - t, o.pos ?? 50));
      const hw   = t * 0.7;
      if (side === 'top')    return `polygon(0% ${t}%,${p - hw}% ${t}%,${p}% 0%,${p + hw}% ${t}%,100% ${t}%,100% 100%,0% 100%)`;
      if (side === 'left')   return `polygon(${t}% 0%,100% 0%,100% 100%,${t}% 100%,${t}% ${p + hw}%,0% ${p}%,${t}% ${p - hw}%)`;
      if (side === 'right')  return `polygon(0% 0%,${100 - t}% 0%,${100 - t}% ${p - hw}%,100% ${p}%,${100 - t}% ${p + hw}%,${100 - t}% 100%,0% 100%)`;
      return `polygon(0% 0%,100% 0%,100% ${100 - t}%,${p + hw}% ${100 - t}%,${p}% 100%,${p - hw}% ${100 - t}%,0% ${100 - t}%)`;
    },

    // 14. Угловая лента для карточек («ТОП», «NEW»): $shape('ribbon', 'tr') или { corner, width }
    ribbon(o) {
      const corner = typeof o.n === 'string' ? o.n : (o.corner ?? 'tr');
      const w = Math.max(8, Math.min(45, o.width ?? 28));
      const w2 = w * 2;
      if (corner === 'tl') return `polygon(${w}% 0%,${w2}% 0%,0% ${w2}%,0% ${w}%)`;
      if (corner === 'br') return `polygon(100% ${100 - w2}%,100% ${100 - w}%,${100 - w}% 100%,${100 - w2}% 100%)`;
      if (corner === 'bl') return `polygon(0% ${100 - w2}%,${w2}% 100%,${w}% 100%,0% ${100 - w}%)`;
      return `polygon(${100 - w2}% 0%,${100 - w}% 0%,100% ${w}%,100% ${w2}%)`;
    },

    // 15. Флажок закладки / избранного: $shape('bookmark', 22) или { depth }
    bookmark(o) {
      const d = Math.max(0, Math.min(50, o.depth ?? o.n ?? 22));
      return `polygon(0% 0%,100% 0%,100% 100%,50% ${100 - d}%,0% 100%)`;
    },

    // 16. Кольцо (для прогресс-баров и обводок): $shape('ring', 18) или { thick }
    ring(o) {
      const t = Math.max(1, Math.min(49, o.thick ?? o.n ?? 18));
      const rIn = 50 - t;
      const steps = 64;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const a = TOP + (i / steps) * TAU;
        pts.push(`${(50 + 50 * Math.cos(a)).toFixed(1)}% ${(50 + 50 * Math.sin(a)).toFixed(1)}%`);
      }
      for (let i = steps; i >= 0; i--) {
        const a = TOP + (i / steps) * TAU;
        pts.push(`${(50 + rIn * Math.cos(a)).toFixed(1)}% ${(50 + rIn * Math.sin(a)).toFixed(1)}%`);
      }
      return `polygon(${pts.join(',')})`;
    },

    // 17. Дуга прогресса (загрузка приложения в сторе): $shape('arc', 75) или { percent, thick }
    arc(o) {
      const pct = Math.max(0, Math.min(100, o.percent ?? o.n ?? 75));
      const t   = Math.max(1, Math.min(49, o.thick ?? 16));
      if (pct <= 0) return 'polygon(50% 0%)';
      if (pct >= 100) return GENERATORS.ring({ thick: t });
      const rIn = 50 - t;
      const steps = Math.max(3, Math.ceil((pct / 100) * 64));
      const maxA = (pct / 100) * TAU;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const a = TOP + (i / steps) * maxA;
        pts.push(`${(50 + 50 * Math.cos(a)).toFixed(1)}% ${(50 + 50 * Math.sin(a)).toFixed(1)}%`);
      }
      for (let i = steps; i >= 0; i--) {
        const a = TOP + (i / steps) * maxA;
        pts.push(`${(50 + rIn * Math.cos(a)).toFixed(1)}% ${(50 + rIn * Math.sin(a)).toFixed(1)}%`);
      }
      return `polygon(${pts.join(',')})`;
    },

    // 18. Круговой сектор (кулдаун / таймер): $shape('pie', 75) или { percent }
    pie(o) {
      const pct = Math.max(0, Math.min(100, o.percent ?? o.n ?? 75));
      if (pct <= 0) return 'polygon(50% 50%)';
      if (pct >= 100) return 'circle(50% at 50% 50%)';
      const steps = Math.max(3, Math.ceil((pct / 100) * 60));
      const maxA  = (pct / 100) * TAU;
      const pts   = ['50% 50%'];
      for (let i = 0; i <= steps; i++) {
        const a = TOP + (i / steps) * maxA;
        pts.push(`${(50 + 72 * Math.cos(a)).toFixed(1)}% ${(50 + 72 * Math.sin(a)).toFixed(1)}%`);
      }
      return `polygon(${pts.join(',')})`;
    },

    // 19. Шеврон (стрелка навигации): $shape('chevron', 'right') или { dir, thick }
    chevron(o) {
      const dir = typeof o.n === 'string' ? o.n : (o.dir ?? 'right');
      const t   = Math.max(6, Math.min(45, o.thick ?? 22));
      const x0  = 25 - t * 0.25;
      const x1  = 75 + t * 0.25;
      if (dir === 'left')  return `polygon(${100 - x0}% 0%,${100 - x0 - t}% 0%,${100 - x1}% 50%,${100 - x0 - t}% 100%,${100 - x0}% 100%,${100 - x1 + t}% 50%)`;
      if (dir === 'down')  return `polygon(0% ${x0}%,0% ${x0 + t}%,50% ${x1}%,100% ${x0 + t}%,100% ${x0}%,50% ${x1 - t}%)`;
      if (dir === 'up')    return `polygon(0% ${100 - x0}%,0% ${100 - x0 - t}%,50% ${100 - x1}%,100% ${100 - x0 - t}%,100% ${100 - x0}%,50% ${100 - x1 + t}%)`;
      return `polygon(${x0}% 0%,${x0 + t}% 0%,${x1}% 50%,${x0 + t}% 100%,${x0}% 100%,${x1 - t}% 50%)`;
    },

    // 20. Крест / Плюс: $shape('cross', 28) или { thick }
    cross(o) {
      const t = o.thick ?? o.n ?? 28;
      const a = (100 - t) / 2;
      const b = 100 - a;
      return `polygon(${a}% 0%,${b}% 0%,${b}% ${a}%,100% ${a}%,100% ${b}%,${b}% ${b}%,${b}% 100%,${a}% 100%,${a}% ${b}%,0% ${b}%,0% ${a}%,${a}% ${a}%)`;
    },

    // 21. Правильный многоугольник: $shape('ngon', 6) или { sides, rotate }
    ngon(o) {
      const sides = Math.max(3, o.sides ?? o.n ?? 6);
      const rot   = ((o.rotate ?? 0) * Math.PI) / 180;
      return poly(sides, (a) => [
        50 + 50 * Math.cos(a + rot),
        50 + 50 * Math.sin(a + rot)
      ]);
    },

    // 22. Сердце и Щит
    heart(o) {
      const pts = o.pts ?? 60;
      return poly(pts, (a) => {
        const t  = a - TOP;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [50 + (hx / 16) * 49, 44 - (hy / 16) * 45];
      });
    },
    shield:   () => 'polygon(50% 0%,94% 14%,94% 46%,84% 72%,68% 89%,50% 100%,32% 89%,16% 72%,6% 46%,6% 14%)',

    // 23. Базовые примитивы
    hexagon:  () => 'polygon(50% 0%,93.3% 25%,93.3% 75%,50% 100%,6.7% 75%,6.7% 25%)',
    capsule:  () => 'inset(0 round 999px)',
    circle:   () => 'circle(50% at 50% 50%)',
    diamond:  () => 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
    triangle: () => 'polygon(50% 0%,0% 100%,100% 100%)'
  };

  window.$shape = (type, opts = {}) => {
    if (!type) return '';
    if (type.includes('(')) return type;

    const norm = (typeof opts === 'number' || typeof opts === 'string') ? { n: opts } : (opts || {});
    const key  = `${type}:${JSON.stringify(norm)}`;

    if (cache.has(key)) return cache.get(key);

    const gen = GENERATORS[type];
    if (!gen) {
      console.warn(`$shape: неизвестная фигура "${type}"`);
      return '';
    }

    const res = gen(norm);
    cache.set(key, res);
    return res;
  };
})();
