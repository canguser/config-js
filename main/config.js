function hasEnumerableProperty(target, p) {
    const descriptor = Object.getOwnPropertyDescriptor(target, p);
    return descriptor && descriptor.enumerable;
}

/**
 *
 * @param config
 * @param provider
 * @param root
 * @param parent
 * @param cacheable
 * @return {*}
 */
function _parseConfig(
    config, provider = {},
    {
        root,
        parent,
        cacheable = true
    } = {}
) {
    if (typeof config !== 'object' || !config || config instanceof Date) {
        return config;
    }

    provider = {...provider};
    return new Proxy(
        {
            origin: config,
            _cache: {}
        },
        {
            get: (target, p, receiver) => {
                const originTarget = target.origin;
                let expectValue = originTarget[p];
                let cache = target._cache || {};
                const cacheProperty = '_' + p;

                // define the local provider
                root = root || receiver;
                const localProvider = {
                    $parent: parent,
                    $root: root
                };

                if (hasEnumerableProperty(localProvider, p) && localProvider[p]) {
                    return localProvider[p];
                }

                if (hasEnumerableProperty(cache, cacheProperty) && cacheable) {
                    return cache[cacheProperty];
                }

                if (hasEnumerableProperty(provider, p)) {
                    expectValue = provider[p];
                } else if (!hasEnumerableProperty(originTarget, p)) {
                    // sometimes appeared Array or others
                    return expectValue;
                }

                let expectFunc = expectValue;
                if (typeof expectFunc !== 'function') {
                    expectFunc = () => expectValue;
                }

                const expectResultFunc = () => _parseConfig(
                    expectFunc.call(receiver, receiver),
                    provider, {
                        root, parent: receiver, cacheable
                    }
                );

                const returnValue = expectResultFunc();

                if (cacheable) {
                    cache[cacheProperty] = returnValue;
                    target._cache = cache;
                }

                return returnValue;
            },
            set: () => false,
            getOwnPropertyDescriptor(target, p) {
                return Reflect.getOwnPropertyDescriptor(config, p);
            },
            has(target, p) {
                return Reflect.has(config, p);
            },
            ownKeys(target) {
                return Reflect.ownKeys(config);
            }
        });
}

(function (global, factory) {

    "use strict";

    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = factory(global, true);
    } else {
        factory(global);
    }

}(typeof window !== "undefined" ? window : this, function (_global, noGlobal) {
    const configJS = {
        configure: function (config, provider) {
            return _parseConfig(config, provider);
        }
    };
    if (!noGlobal) {
        Object.assign(_global, {configJS});
    }
    return configJS;
}));