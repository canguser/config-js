const configJS = require('../config');

describe('config-js infecting test', () => {

    it('should set configuration', function () {
        const project = {
            name: 'Project 01',
            date: '2020-01-02',
            description: 'project description 01'
        };

        const asyncProjectConfig = configJS.configure(project); // asyncAssign default to be true
        const asyncFunction = ({name, date}) => name + ' ' + date;
        asyncProjectConfig.simple = asyncFunction;

        const syncProjectConfig = configJS.configure(project, {}, {asyncAssign: false});
        const syncFunction = ({name, date}) => name + ' ' + date;
        syncProjectConfig.syncSimple = syncFunction;

        expect(syncProjectConfig.syncSimple).toBe(project.name + ' ' + project.date);
        expect(project.syncSimple).toBe(syncFunction);

        return new Promise(resolve => {
            setTimeout(() => {
                expect(asyncProjectConfig.simple).toBe(project.name + ' ' + project.date);
                expect(project.simple).toBe(asyncFunction);
                resolve();
            }, 0);
        });

    });

    it('should async assign callback works', function () {

        expect.assertions(2 + 3);

        const project = {
            name: 'Project 01',
            date: '2020-01-02',
            description: 'project description 01',
            simple: ({name, date}) => name + ' ' + date
        };

        const displayInfo = {};

        const projectAsyncConfig = configJS.configure(project);

        projectAsyncConfig.$instance.executeInfected(
            ({description, simple}) => {
                displayInfo.asyncContent = simple + ' ' + description;
                expect(displayInfo.asyncContent).toBe(simple + ' ' + description); // 2 times
            }
        );

        expect(displayInfo.asyncContent).toBe(project.name + ' ' + project.date + ' ' + project.description);

        let changedDescription = 'ppppp 000001';

        projectAsyncConfig.description = changedDescription;

        return new Promise(resolve => {
            setTimeout(() => {
                expect(displayInfo.asyncContent).toBe(project.name + ' ' + project.date + ' ' + changedDescription);
                expect(project.description).toBe(changedDescription);
                resolve();
            }, 0);
        });


    });

    it('should auto clear cache while infected properties changed [syncing case & some level]', () => {

        expect.assertions(4 + 10);

        const config = {
            width: 100,
            height: 100,
            name: 'size',
            area: ({width, height}) => {
                expect(1).toBe(1);      // run 4 times
                return width * height
            }
        };

        const proxyConfig = configJS.configure(config, {}, {asyncAssign: false});

        expect(proxyConfig.area).toBe(100 * 100);
        expect(proxyConfig.area).toBe(100 * 100);

        proxyConfig.width = 50;

        expect(proxyConfig.area).toBe(50 * 100);
        expect(proxyConfig.area).toBe(50 * 100);

        proxyConfig.height = 50;

        expect(proxyConfig.area).toBe(50 * 50);
        expect(proxyConfig.area).toBe(50 * 50);

        proxyConfig.width = 25;
        proxyConfig.height = 25;

        expect(proxyConfig.area).toBe(25 * 25);
        expect(proxyConfig.area).toBe(25 * 25);

        proxyConfig.name = 'size 01';

        expect(proxyConfig.area).toBe(25 * 25);
        expect(proxyConfig.area).toBe(25 * 25);

    });

    it('should auto clear cache while infected properties changed [syncing case & multi level]', () => {

        expect.assertions(2 + 4 + 12);

        const config = {
            basic: {
                width: 100,
                height: 100,
                name() {
                    expect(1).toBe(1);      // run 2 times
                    return this.$root.name;
                }
            },
            name: 'size',
            area: ({basic}) => {
                expect(1).toBe(1);      // run 4 times
                const {width, height} = basic;
                return width * height
            }
        };

        const proxyConfig = configJS.configure(config, {}, {asyncAssign: false});

        expect(proxyConfig.area).toBe(100 * 100);
        expect(proxyConfig.area).toBe(100 * 100);

        proxyConfig.basic.width = 50;

        expect(proxyConfig.area).toBe(50 * 100);
        expect(proxyConfig.area).toBe(50 * 100);

        proxyConfig.basic.height = 50;

        expect(proxyConfig.area).toBe(50 * 50);
        expect(proxyConfig.area).toBe(50 * 50);

        proxyConfig.basic.width = 25;
        proxyConfig.basic.height = 25;

        expect(proxyConfig.area).toBe(25 * 25);
        expect(proxyConfig.area).toBe(25 * 25);

        expect(proxyConfig.basic.name).toBe('size');
        expect(proxyConfig.basic.name).toBe('size');

        proxyConfig.name = 'size 01';

        expect(proxyConfig.basic.name).toBe('size 01');
        expect(proxyConfig.basic.name).toBe('size 01');
    });

    it('should infected provider', function () {

        expect.assertions(3 + 8);

        const config = {
            color: 'white',
            fontSize: '12px',
            summary: ({color, fontSize, text}) => {
                expect(1).toBe(1);  // 3 times
                return color + fontSize + text;
            }
        };

        const provider = {text: 'hello config-js!'};

        const proxyConfig = configJS.configure(config, provider);

        expect(proxyConfig.summary).toBe(config.color + config.fontSize + provider.text);
        expect(proxyConfig.summary).toBe(config.color + config.fontSize + provider.text);

        proxyConfig.text += 'hahah';

        return new Promise(resolve => {
            setTimeout(() => {
                expect(provider.text).toBe('hello config-js!hahah');
                expect(proxyConfig.summary).toBe(config.color + config.fontSize + provider.text);
                expect(proxyConfig.summary).toBe(config.color + config.fontSize + provider.text);
                proxyConfig.color = 'red';
                proxyConfig.text += 'hahah';
                resolve(
                    new Promise(resolve => {
                        setTimeout(() => {
                            expect(provider.text).toBe('hello config-js!hahahhahah');
                            expect(proxyConfig.summary).toBe(config.color + config.fontSize + provider.text);
                            expect(proxyConfig.summary).toBe(config.color + config.fontSize + provider.text);
                            resolve();
                        }, 0);
                    })
                );
            }, 0);
        });
    });
});