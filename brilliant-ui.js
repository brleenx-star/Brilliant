(() => {
  if (window.__DOM_PROPS_PATCHED__) return;
  window.__DOM_PROPS_PATCHED__ = true;

  // 0. Базовый генератор элементов и глобальный адресный реестр
  window.OBJ = {};
  window.$ = window.$ || {
    div: (cfg) => document.createElement('div'),
    span: (cfg) => document.createElement('span'),
    p: (cfg) => document.createElement('p'),
    button: (cfg) => document.createElement('button'),
    img: (cfg) => document.createElement('img'),
    canvas: (cfg) => document.createElement('canvas'),
    input: (cfg) => document.createElement('input'),
    section: (cfg) => document.createElement('section')
  };

  // 1. Глобальные метрики экрана
  const updateViewport = () => {
    window.W = window.innerWidth;
    window.H = window.innerHeight;
    window.centerX = window.W / 2;
    window.centerY = window.H / 2;
  };
  updateViewport();
  window.addEventListener('resize', updateViewport);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateViewport);

  // 2. Инициализация состояния элемента
  const getState = (el) => {
    if (!el._tr) {
      const st = el.style;
      const initX = st.left && st.left.endsWith('px') ? parseFloat(st.left) || 0 : 0;
      const initY = st.top  && st.top.endsWith('px')  ? parseFloat(st.top)  || 0 : 0;
      const initW = st.width  && st.width.endsWith('px')  ? parseFloat(st.width)  : null;
      const initH = st.height && st.height.endsWith('px') ? parseFloat(st.height) : null;

      if (initX !== 0) st.left = '0px';
      if (initY !== 0) st.top  = '0px';

      el._tr = {
        x: initX, y: initY,
        anchorX: 0, anchorY: 0,
        rotation: 0,
        scaleX: 1, scaleY: 1,
        w: initW, h: initH,
        tex: '', shape: '', name: '',
        gpu: false,
        prevDisplay: st.display && st.display !== 'none' ? st.display : ''
      };

      if (initX !== 0 || initY !== 0) sync(el);
    }
    return el._tr;
  };

  const ensureAbsolute = (el) => {
    const st = el.style;
    if (!st.position) { st.position = 'absolute'; st.top = '0px'; st.left = '0px'; }
  };

  const readW = (el, s) => {
    if (el.style.width && el.style.width.endsWith('px')) {
      const fixedW = parseFloat(el.style.width) || 0;
      s.w = fixedW;
      return fixedW;
    }
    const val = el.offsetWidth || s.w || 0;
    if (val > 0) s.w = val;
    return val;
  };

  const readH = (el, s) => {
    if (el.style.height && el.style.height.endsWith('px')) {
      const fixedH = parseFloat(el.style.height) || 0;
      s.h = fixedH;
      return fixedH;
    }
    const val = el.offsetHeight || s.h || 0;
    if (val > 0) s.h = val;
    return val;
  };

  // Единая точка отрисовки
  const sync = (el) => {
    const s = getState(el);
    ensureAbsolute(el);
    const w = readW(el, s);
    const h = readH(el, s);
    const shiftX = s.x - w * s.anchorX;
    const shiftY = s.y - h * s.anchorY;
    const pos = s.gpu
      ? `translate3d(${shiftX}px, ${shiftY}px, 0)`
      : `translate(${shiftX}px, ${shiftY}px)`;
    el.style.transformOrigin = `${s.anchorX * 100}% ${s.anchorY * 100}%`;
    el.style.transform = `${pos} rotate(${s.rotation}deg) scale(${s.scaleX}, ${s.scaleY})`;
  };

  // 3. Реактивные свойства на каждом HTML-элементе
  Object.defineProperties(HTMLElement.prototype, {
    name: {
      get() { return getState(this).name; },
      set(v) {
        const s = getState(this);
        if (s.name && window.OBJ[s.name] === this) delete window.OBJ[s.name];
        s.name = String(v || '');
        if (s.name) window.OBJ[s.name] = this;
      }
    },
    gpu:      { get() { return getState(this).gpu; },      set(v) { getState(this).gpu = Boolean(v); sync(this); } },
    x:        { get() { return getState(this).x; },        set(v) { getState(this).x = Number(v) || 0; sync(this); } },
    y:        { get() { return getState(this).y; },        set(v) { getState(this).y = Number(v) || 0; sync(this); } },
    z:        { get() { return Number(this.style.zIndex) || 0; }, set(v) { this.style.zIndex = Math.round(Number(v) || 0); } },

    anchorX:  { get() { return getState(this).anchorX; },  set(v) { getState(this).anchorX = Number(v) || 0; sync(this); } },
    anchorY:  { get() { return getState(this).anchorY; },  set(v) { getState(this).anchorY = Number(v) || 0; sync(this); } },
    anchor:   {
      get() { return getState(this).anchorX; },
      set(v) { const s = getState(this); s.anchorX = s.anchorY = Number(v) || 0; sync(this); }
    },

    rotation: { get() { return getState(this).rotation; }, set(v) { getState(this).rotation = Number(v) || 0; sync(this); } },
    scaleX:   { get() { return getState(this).scaleX; },   set(v) { const n = Number(v); if (!Number.isNaN(n)) { getState(this).scaleX = n; sync(this); } } },
    scaleY:   { get() { return getState(this).scaleY; },   set(v) { const n = Number(v); if (!Number.isNaN(n)) { getState(this).scaleY = n; sync(this); } } },
    scale:    {
      get() { return getState(this).scaleX; },
      set(v) { const n = Number(v); if (!Number.isNaN(n)) { const s = getState(this); s.scaleX = s.scaleY = n; sync(this); } }
    },

    alpha:    { get() { return this.style.opacity === '' ? 1 : Number(this.style.opacity); }, set(v) { this.style.opacity = v; } },
    visible:  {
      get() { return this.style.display !== 'none'; },
      set(v) {
        const s = getState(this);
        if (v) {
          this.style.display = s.prevDisplay || '';
          sync(this);
        } else if (this.style.display !== 'none') {
          s.prevDisplay = this.style.display;
          this.style.display = 'none';
        }
      }
    },
    touch: {
      get() { return this.style.pointerEvents !== 'none'; },
      set(v) { this.style.pointerEvents = v ? 'auto' : 'none'; }
    },

    w: {
      get() { return readW(this, getState(this)); },
      set(v) { const n = Number(v) || 0; getState(this).w = n; this.style.width = n + 'px'; sync(this); }
    },
    h: {
      get() { return readH(this, getState(this)); },
      set(v) { const n = Number(v) || 0; getState(this).h = n; this.style.height = n + 'px'; sync(this); }
    },

    realW:    { get() { return this.w * Math.abs(getState(this).scaleX); } },
    realH:    { get() { return this.h * Math.abs(getState(this).scaleY); } },

    left:     { get() { return this.x - this.realW * getState(this).anchorX; } },
    right:    { get() { return this.x + this.realW * (1 - getState(this).anchorX); } },
    top:      { get() { return this.y - this.realH * getState(this).anchorY; } },
    bottom:   { get() { return this.y + this.realH * (1 - getState(this).anchorY); } },
    cx:       { get() { return this.left + this.realW / 2; } },
    cy:       { get() { return this.top + this.realH / 2; } },

    color:    { get() { return this.style.backgroundColor; }, set(v) { this.style.backgroundColor = v; } },
    textColor:{ get() { return this.style.color; },           set(v) { this.style.color = v; } },
    radius:   {
      get() { return parseFloat(this.style.borderRadius) || 0; },
      set(v) { this.style.borderRadius = typeof v === 'number' ? v + 'px' : v; }
    },
    shape: {
      get() { return getState(this).shape; },
      set(v) {
        getState(this).shape = v || '';
        this.style.clipPath = v || '';
      }
    },
    blur: {
      get() { return parseFloat(this.style.filter) || 0; },
      set(v) { this.style.filter = typeof v === 'number' ? (v > 0 ? `blur(${v}px)` : '') : (v || ''); }
    },
    backdrop: {
      get() { return parseFloat(this.style.backdropFilter) || 0; },
      set(v) {
        const val = typeof v === 'number' ? (v > 0 ? `blur(${v}px)` : '') : (v || '');
        this.style.backdropFilter = val;
        this.style.WebkitBackdropFilter = val;
      }
    },
    fontSize: {
      get() { return parseFloat(this.style.fontSize) || 16; },
      set(v) {
        ensureAbsolute(this);
        this.style.fontSize = (typeof v === 'number' ? v + 'px' : v);
        const s = getState(this);
        if (!this.style.width) s.w = this.offsetWidth || null;
        if (!this.style.height) s.h = this.offsetHeight || null;
        sync(this);
      }
    },
    text: {
      get() { return this.textContent; },
      set(v) {
        const str = String(v ?? '');
        if (this.textContent !== str) {
          ensureAbsolute(this);
          this.textContent = str;
          const s = getState(this);
          if (!this.style.width) s.w = this.offsetWidth || null;
          if (!this.style.height) s.h = this.offsetHeight || null;
          sync(this);
        }
      }
    },
    tex: {
      get() { return getState(this).tex; },
      set(key) {
        getState(this).tex = key;
        const src = (window.ASSETS && window.ASSETS[key]) || key;
        if (this.tagName === 'IMG') {
          this.onload = () => this.remeasure();
          this.src = src;
        } else {
          this.style.backgroundImage = `url(${src})`;
          if (!this.style.backgroundSize) this.style.backgroundSize = '100% 100%';
          this.style.backgroundPosition = 'center';
          this.style.backgroundRepeat = 'no-repeat';
        }
      }
    },
    fit: {
      get() { return this.tagName === 'IMG' ? this.style.objectFit : this.style.backgroundSize; },
      set(v) {
        if (this.tagName === 'IMG') this.style.objectFit = v;
        else this.style.backgroundSize = v === 'fill' ? '100% 100%' : v;
      }
    }
  });

  // 4. Встроенные методы
  const origRemove = HTMLElement.prototype.remove;
  HTMLElement.prototype.remove = function() {
    const s = this._tr;
    if (s && s.name && window.OBJ[s.name] === this) delete window.OBJ[s.name];
    origRemove.call(this);
  };

  HTMLElement.prototype.move = function(x, y) {
    const s = getState(this);
    s.x = Number(x) || 0;
    s.y = Number(y) || 0;
    sync(this);
    return this;
  };

  HTMLElement.prototype.remeasure = function() {
    const s = getState(this);
    s.w = this.offsetWidth || null;
    s.h = this.offsetHeight || null;
    sync(this);
    return this;
  };

  HTMLElement.prototype.hit = function(other) {
    if (!other || !this.visible || !other.visible) return false;
    return this.left < other.right && this.right > other.left && this.top < other.bottom && this.bottom > other.top;
  };

  HTMLElement.prototype.dist = function(other) {
    if (!other) return Infinity;
    return Math.hypot(this.cx - other.cx, this.cy - other.cy);
  };

  // 5. Системные свойства движка, которые обрабатываются отдельно
  const SYSTEM_KEYS = new Set([
    'name', 'gpu', 'x', 'y', 'z', 'w', 'h', 'anchor', 'anchorX', 'anchorY', 
    'scale', 'scaleX', 'scaleY', 'rotation', 'alpha', 'visible', 'touch', 
    'color', 'textColor', 'radius', 'shape', 'blur', 'backdrop', 'fontSize', 
    'text', 'tex', 'fit'
  ]);

  const patchDollar = () => {
    if (window.$.__patched) return;
    window.$.__patched = true;
    ['div', 'span', 'p', 'button', 'img', 'canvas', 'input', 'section'].forEach(fnName => {
      if (typeof window.$[fnName] !== 'function') return;
      const orig = window.$[fnName].bind(window.$);
      window.$[fnName] = (cfg = {}, ...rest) => {
        const extra = {};
        const cssProps = {};

        // Гибридный разбор конфига: системные свойства отдельно, чистый CSS — в el.style
        if (cfg && typeof cfg === 'object') {
          for (const k in cfg) {
            if (SYSTEM_KEYS.has(k)) {
              extra[k] = cfg[k];
            } else {
              cssProps[k] = cfg[k];
            }
          }
        }

        // Создаем элемент и сразу добавляем в DOM для корректного замера размеров
        const el = orig({}, ...rest);
        ensureAbsolute(el);
        if (!el.parentNode) {
          document.body.appendChild(el);
        }

        const s = getState(el);

        // Сначала применяем CSS-свойства (шрифт, переносы, отступы), чтобы замер их учитывал
        for (const k in cssProps) {
          el.style[k] = cssProps[k];
        }

        // Применяем системные свойства движка
        if (extra.gpu !== undefined) s.gpu = Boolean(extra.gpu);
        if (extra.x !== undefined) s.x = Number(extra.x) || 0;
        if (extra.y !== undefined) s.y = Number(extra.y) || 0;
        if (extra.anchor !== undefined) s.anchorX = s.anchorY = Number(extra.anchor) || 0;
        if (extra.anchorX !== undefined) s.anchorX = Number(extra.anchorX) || 0;
        if (extra.anchorY !== undefined) s.anchorY = Number(extra.anchorY) || 0;
        if (extra.rotation !== undefined) s.rotation = Number(extra.rotation) || 0;
        if (extra.scale !== undefined) s.scaleX = s.scaleY = Number(extra.scale);
        if (extra.scaleX !== undefined) s.scaleX = Number(extra.scaleX);
        if (extra.scaleY !== undefined) s.scaleY = Number(extra.scaleY);

        for (const k of ['name', 'w', 'h', 'z', 'alpha', 'visible', 'touch', 'color', 'textColor', 'radius', 'shape', 'blur', 'backdrop', 'fontSize', 'text', 'tex', 'fit']) {
          if (extra[k] !== undefined) el[k] = extra[k];
        }

        if (extra.w === undefined && !el.style.width) s.w = null;
        if (extra.h === undefined && !el.style.height) s.h = null;

        sync(el);

        return el;
      };
    });
  };

  // Немедленный патч без ожидания событий
  patchDollar();
})();
