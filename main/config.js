function hasEnumerableProperty(target, p) {
    const descriptor = Object.getOwnPropertyDescriptor(target, p);
    return descriptor && descriptor.enumerable;
}

function delay(context, apiName, ms = 0) {
    const eqName = `_delay_${apiName}`;
    clearTimeout(context[eqName]);
    return new Promise(resolve => {
        context[eqName] = setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

function eachInArrays(parentArray = [], array = []) {
    for (const a of array) {
        if (parentArray.includes(a)) {
            return true;
        }
    }
    return false;
}

function isBasicDateType(o) {
    return typeof o !== 'object' || !o || o instanceof Date
}

class ConfigInstance {

    constructor(
        {
            root,
            config,
            parent,
            provider,
            property,
            asyncAssign
        }
    ) {
        // init provider
        this.localProvider = {
            root, parent, instance: this, property
        };

        // init basic data
        this.cache = {};
        this.origin = config;
        this.provider = provider;
        this.infectedCallbacks = [];
        this.asyncAssign = asyncAssign;
    }

    updateLocalProvider(provider = {}) {
        Object.assign(this.localProvider, provider);
    }

    getLocalProvider() {
        const provider = {};
        for (const key of Object.keys(this.localProvider)) {
            provider['$' + key] = this.localProvider[key];
        }
        return provider;
    }

    getCache() {
        return this.cache || {};
    }

    applyCache(cache) {
        this.cache = cache;
    }

    emptyCache(keys) {
        if (!keys || !keys.length) {
            this.applyCache({});
        } else {
            for (const key of keys) {
                const cacheKey = '_' + key;
                this.cache[cacheKey] = undefined;
                delete this.cache[cacheKey];
            }
        }
    }

    get parentInstance() {
        const {parent} = this.localProvider;
        return parent && parent.$instance;
    }

    get propertyFromParent() {
        return this.localProvider.property;
    }

    get rootInstance() {
        const {root} = this.localProvider;
        if (root) {
            return root.instance;
        }
        return null;
    }

    applyProxy(proxy) {
        this.proxy = proxy;
    }

    registerInfectedCallback(keys = [], callback, options = {}) {
        const {isOnce = false} = options;
        if (typeof callback === 'function') {
            this.infectedCallbacks.push({
                keys,
                callback,
                isOnce,
                executed: false
            });
            if (!this.isRoot) {
                const providerKeys = keys.filter(key => Object.keys(this.provider).includes(key));
                if (providerKeys.length > 0) {
                    this.rootInstance.registerInfectedCallback(keys, callback, options);
                }
            }
        }
    }

    get isRoot() {
        const {rootInstance} = this;
        return rootInstance === this || rootInstance == null;
    }

    getInfectedCallbacksByKeys(infectedKeys = []) {
        if (!infectedKeys || infectedKeys.length === 0) {
            return [];
        }
        const providerKeys = Object.keys(this.provider);
        const isInfectedProviderKey = eachInArrays(infectedKeys, providerKeys);
        return this.infectedCallbacks.filter(
            ({keys = []}) => {
                if (!this.isRoot && eachInArrays(keys, providerKeys) && isInfectedProviderKey) {
                    // prevent callback called twice
                    return false;
                }
                for (const key of keys) {
                    if (infectedKeys.includes(key)) {
                        return true
                    }
                }
                return keys.length === 0;
            }
        );
    }

    removeOnceInfectedCallbacks() {
        this.infectedCallbacks = this.infectedCallbacks.filter(
            cb => !(cb.isOnce && cb.executed)
        )
    }

    executeInfected(executeFunc) {
        if (!this.proxy) {
            console.warn('Instance\'s proxy not bind yet.');
            return;
        }
        this.isRecordingInfected = true;
        executeFunc.call(this.proxy, this.proxy);
        this.isRecordingInfected = false;
        const infectedKeys = this.infectedKeys || [];
        this.infectedKeys = [];
        this.registerInfectedCallback(infectedKeys, executeFunc);
    }

    assignKeyValue(key, value) {
        this._tempAssignConfig =
            Object.assign(this._tempAssignConfig || {}, {[key]: value});
        if (this.asyncAssign) {
            delay(this, 'applyConfig')
                .then(() => {
                    this.applyConfigChanged(this._tempAssignConfig || {});
                    this._tempAssignConfig = {};
                })
        } else {
            this.applyConfigChanged(this._tempAssignConfig || {});
            this._tempAssignConfig = {};
        }
    }

    applyConfigChanged(config = {}) {
        const changedKeys = Object.keys(config);
        if (changedKeys.length === 0) {
            return;
        }

        const infectedKeys = [];
        const infectedProviderKeys = [];

        for (const key of changedKeys) {
            if (hasEnumerableProperty(this.provider, key)) {
                if (config[key] !== this.provider[key]) {
                    this.provider[key] = config[key];
                    infectedKeys.push(key);
                    infectedProviderKeys.push(key);
                }
                continue;
            }
            if (config[key] !== this.origin[key]) {
                this.origin[key] = config[key];
                infectedKeys.push(key);
            }
        }

        if (!this.isRoot) {
            this.rootInstance.triggerInfectedCallbacks(infectedProviderKeys);
        }

        this.triggerInfectedCallbacks(infectedKeys);
    }

    triggerParentInfectedCallbacks() {
        const parentInstance = this.parentInstance;
        if (parentInstance) {
            parentInstance.triggerInfectedCallbacks([this.propertyFromParent]);
        }
    }

    triggerInfectedCallbacks(infectedKeys) {
        if (infectedKeys.length > 0) {
            this.emptyCache(infectedKeys);
            for (const cb of this.getInfectedCallbacksByKeys(infectedKeys)) {
                cb.callback.call(this.proxy, this.proxy);
                cb.executed = true;
            }
            this.removeOnceInfectedCallbacks();
            this.triggerParentInfectedCallbacks();
        }
    }

}

/**
 *
 * @param config
 * @param provider
 * @param root
 * @param parent
 * @param property
 * @param cacheable
 * @param asyncAssign
 * @return {*}
 */
function _parseConfig(
    config, provider = {},
    {
        root,
        parent,
        property,
        cacheable = true,
        asyncAssign = true,
    } = {}
) {
    if (isBasicDateType(config)) {
        return config;
    }

    return new Proxy(
        new ConfigInstance({config, root, parent, property, provider, asyncAssign}),
        {
            get: (target, p, receiver) => {
                const originTarget = target.origin;
                const cache = target.getCache();
                const cacheProperty = typeof p === 'string' ? ('_' + p) : p;
                const isRoot = !root;

                // bind to instance
                target.applyProxy(receiver);

                // get the default value
                let expectValue = originTarget[p];

                // update the local provider
                const currentRoot = root || receiver;
                target.updateLocalProvider({root: currentRoot});
                const localProvider = target.getLocalProvider();

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
                    if (!isRoot) {
                        return currentRoot[p];
                    }
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

                // build the proxy to recording infected keys of expectFunc
                const infectedKeys = [];
                const expectProxyParams = new Proxy(receiver, {
                    get(target, p, receiver) {
                        infectedKeys.push(p);
                        return Reflect.get(target, p, receiver);
                    }
                });

                // build the function with specific params
                const expectResultFunc = () => _parseConfig(
                    expectFunc.call(expectProxyParams, expectProxyParams),
                    provider, {
                        root: currentRoot, parent: receiver, cacheable, asyncAssign, property: p
                    }
                );

                // get the real return value
                const returnValue = expectResultFunc();

                // if infected properties changed, reset the cache of this property
                target.registerInfectedCallback(infectedKeys, () => {
                    target.emptyCache([p]);
                }, {isOnce: true});

                const parentInstanceNames = ['$root', '$parent'];
                for (const name of parentInstanceNames) {
                    if (infectedKeys.includes(name) && receiver[name]) {
                        const instance = receiver[name].$instance;
                        if (instance) {
                            instance.registerInfectedCallback([], () => {
                                target.emptyCache([p]);
                            }, {isOnce: true});
                        }
                    }
                }

                // recording infected key
                if (target.isRecordingInfected) {
                    target.infectedKeys = target.infectedKeys || [];
                    target.infectedKeys.push(p);
                }

                // if open cache, put the value into cache
                if (cacheable) {
                    cache[cacheProperty] = returnValue;
                    target.applyCache(cache);
                }

                return returnValue;
            },
            set(target, p, value) {
                target.assignKeyValue(p, value);
                return true;
            },
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