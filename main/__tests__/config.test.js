const configJS = require('../config');

describe('config-js tests', () => {
    it('should parse normal config object', function () {
        const config = {
            age: 10,
            gender: 'male',
            name: 'Smith',
            isAlive: true,
            school: {
                name: 'Weals Numom'
            }
        };

        const parsedConfig = configJS.configure(config);

        expect(parsedConfig.age).toBe(config.age);
        expect(parsedConfig.gender).toBe(config.gender);
        expect(parsedConfig.name).toBe(config.name);
        expect(parsedConfig.isAlive).toBe(config.isAlive);
        expect(parsedConfig.school.name).toBe(config.school.name);
    });
});