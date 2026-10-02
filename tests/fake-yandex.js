// Contract double for the SDK only. The production @yandex/ymaps3-clusterer runs unchanged.
// These tests do not claim to verify remote tiles, WebGL or authorization with a real key.
window.__mapsFake = [];
class Entity {
  constructor(props = {}) {
    this._props = { ...this.constructor.defaultProps, ...props };
    this.children = [];
  }
  addChild(child) {
    this.children.push(child);
    child.root = this.root;
    child.parent = this;
    child._onAttach?.();
    return this;
  }
  removeChild(child) {
    if (!this.children.includes(child)) throw Error("Unknown child");
    child._onDetach?.();
    for (const c of [...child.children]) child.removeChild(c);
    this.children = this.children.filter((c) => c !== child);
    child.root = undefined;
    return this;
  }
  update(props) {
    Object.assign(this._props, props);
    this._onUpdate?.();
  }
}
class FakeMap extends Entity {
  constructor(host, props) {
    super(props);
    this.host = host;
    this.root = this;
    this.center = props.location.center;
    this.zoom = props.location.zoom;
    this.destroyed = false;
    this.cameraCalls = 0;
    this.listeners = new Set();
    this.observer = new ResizeObserver(() => this.notify());
    this.observer.observe(host);
    window.__mapsFake.push(this);
  }
  projection = {
    toWorldCoordinates: ([lng, lat]) => ({ x: lng / 180, y: -lat / 90 }),
    fromWorldCoordinates: ({ x, y }) => [x * 180, -y * 90],
  };
  get size() {
    return { x: this.host.clientWidth, y: this.host.clientHeight };
  }
  get bounds() {
    const dx = (this.size.x / (2 ** this.zoom * 256)) * 180,
      dy = (this.size.y / (2 ** this.zoom * 256)) * 90;
    return [
      [this.center[0] - dx, this.center[1] - dy],
      [this.center[0] + dx, this.center[1] + dy],
    ];
  }
  setLocation(location) {
    this.cameraCalls++;
    if (location.bounds) {
      const [a, b] = location.bounds;
      this.center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.zoom = Math.max(
        3,
        Math.min(
          20,
          Math.log2(
            Math.min(
              this.size.x / ((b[0] - a[0]) / 180),
              this.size.y / ((b[1] - a[1]) / 90),
            ) / 256,
          ),
        ),
      );
    }
    if (location.center) this.center = location.center;
    if (location.zoom !== undefined) this.zoom = location.zoom;
    this.notify();
  }
  notify() {
    for (const listener of [...this.listeners])
      listener._props.onUpdate?.({ mapInAction: false });
    for (const marker of this.host.querySelectorAll("[data-fake-marker]"))
      marker.style.opacity = "1";
  }
  destroy() {
    for (const c of [...this.children]) this.removeChild(c);
    this.observer.disconnect();
    this.destroyed = true;
    this.listeners.clear();
  }
}
class Marker extends Entity {
  constructor(props, node) {
    super(props);
    this.node = node;
  }
  _onAttach() {
    this.node.dataset.fakeMarker = "1";
    this.node.style.position = "absolute";
    const count = this.root.host.querySelectorAll("button").length;
    this.node.style.left = `${60 + (count % 12) * 44}px`;
    this.node.style.top = `${70 + Math.floor(count / 12) * 44}px`;
    this.root.host.appendChild(this.node);
  }
  _onDetach() {
    this.node.remove();
  }
}
class Listener extends Entity {
  _onAttach() {
    this.root.listeners.add(this);
  }
  _onDetach() {
    this.root.listeners.delete(this);
  }
}
window.ymaps3 = {
  ready: Promise.resolve(),
  YMap: FakeMap,
  YMapComplexEntity: Entity,
  YMapCollection: Entity,
  YMapListener: Listener,
  YMapMarker: Marker,
  YMapFeature: Entity,
  YMapDefaultSchemeLayer: Entity,
  YMapDefaultFeaturesLayer: Entity,
  overrideKeyReactify: Symbol(),
  overrideKeyVuefy: Symbol(),
  optionsKeyVuefy: Symbol(),
};
