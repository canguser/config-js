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
                const cache = target._cache || {};
                const cacheProperty = '_' + p;

                // get the default value
                let expectValue = originTarget[p];

                // define the local provider
                root = root || receiver;
                const localProvider = {
                    $parent: parent,
                    $root: root
                };

                // check if in local provider
                if (hasEnumerableProperty(localProvider, p) && localProvider[p]) {
                    return localProvider[p];
                }

                // check if already in the cache
                if (hasEnumerableProperty(cache, cacheProperty) && cacheable) {
                    return cache[cacheProperty];
                }

                // check if in the custom provider
                if (hasEnumerableProperty(provider, p)) {
                    expectValue = provider[p];
                } else if (!hasEnumerableProperty(originTarget, p)) {
                    // if not in the provider & may be un-enumerable value
                    // sometimes appeared Array or others
                    return expectValue;
                }

                // convert all value into function
                let expectFunc = expectValue;
                if (typeof expectFunc !== 'function') {
                    expectFunc = () => expectValue;
                }

                // build the function with specific params
                const expectResultFunc = () => _parseConfig(
                    expectFunc.call(receiver, receiver),
                    provider, {
                        root, parent: receiver, cacheable
                    }
                );

                // get the real return value
                const returnValue = expectResultFunc();

                // if open cache, put the value into cache
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
            ownKeys() {
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
        configure: function (config, provider, options = {}) {
            return _parseConfig(config, provider, options);
        }
    };
    if (!noGlobal) {
        Object.assign(_global, {configJS});
    }
    return configJS;
}));