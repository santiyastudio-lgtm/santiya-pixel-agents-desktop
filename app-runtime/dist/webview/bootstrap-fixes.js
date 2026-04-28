(function () {
  const nativeAddEventListener = EventTarget.prototype.addEventListener;
  const forcedNonPassiveEvents = new Set(["wheel", "touchmove"]);

  EventTarget.prototype.addEventListener = function patchedAddEventListener(
    type,
    listener,
    options
  ) {
    if (forcedNonPassiveEvents.has(type) && options && typeof options === "object") {
      return nativeAddEventListener.call(this, type, listener, {
        ...options,
        passive: false,
      });
    }

    return nativeAddEventListener.call(this, type, listener, options);
  };
})();
