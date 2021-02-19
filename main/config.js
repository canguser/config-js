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
 * @return {*}
 */
function _parseConfig(
    config, provider = {},
    {
        root,
        parent
    } = {}
) {
    if (typeof config !== 'object' || !config || config instanceof Date) {
        return config;
    }

    provider = {...provider};
    return new Proxy(config, {
        get: (target, p, receiver) => {
            let expectValue = target[p];

            // define the local provider
            root = root || receiver;
            const localProvider = {
                $parent: parent,
                $root: root
            };

            if (hasEnumerableProperty(localProvider, p) && localProvider[p]) {
                return localProvider[p];
            } else if (hasEnumerableProperty(provider, p)) {
                expectValue = provider[p];
            } else if (!hasEnumerableProperty(target, p)) {
                // sometimes appeared Array or others
                return expectValue;
            }

            let expectFunc = expectValue;
            if (typeof expectFunc !== 'function') {
                expectFunc = () => expectValue;
            }
            // add $parent to provider
            const expectResultFunc = () => _parseConfig(
                expectFunc.call(receiver, receiver),
                provider, {
                    root, parent: receiver
                }
            );
            return expectResultFunc();
        },
        set: () => false
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