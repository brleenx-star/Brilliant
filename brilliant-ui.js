(() => {
  if (window.__DOM_PROPS_PATCHED__) return;
  window.__DOM_PROPS_PATCHED__ = true;

  window.OBJ = Object.create(null);
  const root = () => document.getElementById('app') || document.body;

  window.$ = window.$ || {
    div: () => document.createElement('div'),
    span: () => document.createElement('span'),
    p: () => document.createElement('p'),
    button: () => document.createElement('button'),
    img: () => document.createElement('img'),
    canvas: () => document.createElement('canvas'),
    input: () => document.createElement('input'),
    section: () => document.createElement('section')
  };

  const updateViewport = () => {
    window.W = window.innerWidth;
    window.H = window.innerHeight;
    window.centerX = window.W * 0.5;
    window.centerY = window.H * 0.5;
  };
  updateViewport();
  window.addEventListener('resize', updateViewport, { passive: true });

  const getState = (el) => {
    let s = el._tr;
    if (!s) {
      const st = el.style;
      st.position = 'absolute';
      st.left = '0px';
      st.top = '0px';
      st.transformOrigin = '0px 0px';
      st.width = 'max-content';

      s = el._tr = {
        x: 0, y: 0,
        anchorX: 0, anchorY: 0,
        rotation: 0,
        scaleX: 1, scaleY: 1,
        w: 0, h: 0,
        tex: '', shape: '', name: '',
        gpu: false,
        prevDisplay: ''
      };
    }
    return s;
  };

  const sync = (el) => {
    const s = el._tr || getState(el);
    const ax = -s.anchorX * 100;
    const ay = -s.anchorY * 100;
    const pos = s.gpu
      ? `translate3d(${s.x}px,${s.y}px,0)`
      : `translate(${s.x}px,${s.y}px)`;

    el.style.transform = `${pos} rotate(${s.rotation}deg) scale(${s.scaleX},${s.scaleY}) translate(${ax}%,${ay}%)`;
  };

  // Умный парсер размеров (поддерживает числа, auto, %, max-content и т.д.)
  const parseSize = (v) => {
    if (typeof v === 'number') return v + 'px';
    if (typeof v === 'string') {
      if (/^\d+(\.\d+)?$/.test(v)) return v + 'px'; // если строка из чистых цифр — добавляем px
      return v; // ключевые слова (auto, max-content и т.д.) и строки с единицими (% , px) возвращаем как есть
    }
    return v;
  };

  Object.defineProperties(HTMLElement.prototype, {
    name: {
      get() { return getState(this).name; },
      set(v) {
        const s = getState(this);
        if (s.name && window.OBJ[s.name] === this) delete window.OBJ[s.name];
        s.name = v;
        if (v) window.OBJ[v] = this;
      }
    },
    gpu:      { get() { return getState(this).gpu; },      set(v) { getState(this).gpu = v; sync(this); } },
    x:        { get() { return getState(this).x; },        set(v) { getState(this).x = v; sync(this); } },
    y:        { get() { return getState(this).y; },        set(v) { getState(this).y = v; sync(this); } },
    z:        { get() { return this.style.zIndex; },       set(v) { this.style.zIndex = v; } },

    anchorX:  { get() { return getState(this).anchorX; },  set(v) { getState(this).anchorX = v; sync(this); } },
    anchorY:  { get() { return getState(this).anchorY; },  set(v) { getState(this).anchorY = v; sync(this); } },
    anchor:   {
      get() { return getState(this).anchorX; },
      set(v) { const s = getState(this); s.anchorX = v; s.anchorY = v; sync(this); }
    },

    rotation: { get() { return getState(this).rotation; }, set(v) { getState(this).rotation = v; sync(this); } },
    scaleX:   { get() { return getState(this).scaleX; },   set(v) { getState(this).scaleX = v; sync(this); } },
    scaleY:   { get() { return getState(this).scaleY; },   set(v) { getState(this).scaleY = v; sync(this); } },
    scale:    {
      get() { return getState(this).scaleX; },
      set(v) { const s = getState(this); s.scaleX = v; s.scaleY = v; sync(this); }
    },

    alpha:    { get() { return this.style.opacity === '' ? 1 : Number(this.style.opacity); }, set(v) { this.style.opacity = v; } },
    visible:  {
      get() { return this.style.display !== 'none'; },
      set(v) {
        const s = getState(this);
        if (v) {
          this.style.display = s.prevDisplay;
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
      get() { const s = getState(this); return s.w || this.offsetWidth; },
      set(v) { getState(this).w = v; this.style.width = parseSize(v); }
    },
    h: {
      get() { const s = getState(this); return s.h || this.offsetHeight; },
      set(v) { getState(this).h = v; this.style.height = parseSize(v); }
    },

    realW:    { get() { return this.w * Math.abs(getState(this).scaleX); } },
    realH:    { get() { return this.h * Math.abs(getState(this).scaleY); } },

    left:     { get() { return getState(this).x - this.realW * getState(this).anchorX; } },
    right:    { get() { return getState(this).x + this.realW * (1 - getState(this).anchorX); } },
    top:      { get() { return getState(this).y - this.realH * getState(this).anchorY; } },
    bottom:   { get() { return getState(this).y + this.realH * (1 - getState(this).anchorY); } },
    cx:       { get() { return this.left + this.realW * 0.5; } },
    cy:       { get() { return this.top + this.realH * 0.5; } },

    color:     { get() { return this.style.backgroundColor; }, set(v) { this.style.backgroundColor = v; } },
    textColor: { get() { return this.style.color; },           set(v) { this.style.color = v; } },
    radius:    { get() { return this.style.borderRadius; },    set(v) { this.style.borderRadius = v; } },
    shape:     { get() { return getState(this).shape; },       set(v) { getState(this).shape = v; this.style.clipPath = v; } },
    blur:      { get() { return this.style.filter; },          set(v) { this.style.filter = v; } },
    backdrop:  {
      get() { return this.style.backdropFilter; },
      set(v) { this.style.backdropFilter = v; this.style.WebkitBackdropFilter = v; }
    },
    fontSize:  { get() { return this.style.fontSize; },        set(v) { this.style.fontSize = v; } },
    text:      { get() { return this.textContent; },           set(v) { this.textContent = v; } },
    tex: {
      get() { return getState(this).tex; },
      set(key) {
        getState(this).tex = key;
        const src = (window.ASSETS && window.ASSETS[key]) || key;
        if (this.tagName === 'IMG') {
          this.src = src;
        } else {
          const st = this.style;
          st.backgroundImage = `url(${src})`;
          if (!st.backgroundSize) st.backgroundSize = '100% 100%';
          st.backgroundPosition = 'center';
          st.backgroundRepeat = 'no-repeat';
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

  const origRemove = HTMLElement.prototype.remove;
  HTMLElement.prototype.remove = function() {
    const s = this._tr;
    if (s && s.name && window.OBJ[s.name] === this) delete window.OBJ[s.name];
    origRemove.call(this);
  };

  HTMLElement.prototype.sync = function() {
    sync(this);
    return this;
  };

  HTMLElement.prototype.move = function(x, y) {
    const s = getState(this);
    s.x = x;
    s.y = y;
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
      const orig = window.$[fnName].bind(window.$);
      window.$[fnName] = (cfg) => {
        const el = orig();
        const s = getState(el);
        const st = el.style;

        if (cfg) {
          for (const k in cfg) {
            const v = cfg[k];
            if (SYSTEM_KEYS.has(k)) {
              switch (k) {
                case 'x': s.x = v; break;
                case 'y': s.y = v; break;
                case 'anchor': s.anchorX = v; s.anchorY = v; break;
                case 'anchorX': s.anchorX = v; break;
                case 'anchorY': s.anchorY = v; break;
                case 'rotation': s.rotation = v; break;
                case 'scale': s.scaleX = v; s.scaleY = v; break;
                case 'scaleX': s.scaleX = v; break;
                case 'scaleY': s.scaleY = v; break;
                case 'gpu': s.gpu = v; break;
                default: el[k] = v; break;
              }
            } else {
              st[k] = v;
            }
          }
        }

        sync(el);
        root().appendChild(el);
        return el;
      };
    });
  };

  patchDelegates = patchDollar();
})();
