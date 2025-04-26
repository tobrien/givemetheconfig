import { jest } from '@jest/globals';
import { Feature } from '../src/options';

describe('options', () => {
    let Options: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        Options = await import('../src/options');
    });

    describe('create', () => {
        it('should create options with default values when no parameters provided', () => {
            const options = Options.createOptions({});

            expect(options.allowed).toEqual(Options.DEFAULT_ALLOWED_OPTIONS);
            expect(options.isFeatureEnabled('config')).toBe(true);
        });

        it('should create options with custom default values', () => {
            const customDefaults = {
                configDirectory: './custom-config',
            };


            const options = Options.createOptions({ defaults: customDefaults });

            expect(options.defaults).toEqual(customDefaults);
            expect(options.allowed).toEqual(Options.DEFAULT_ALLOWED_OPTIONS);
            expect(options.isFeatureEnabled('config')).toBe(true);
        });

        it('should create options with custom features', () => {
            const customFeatures: Feature[] = ['config'];

            const options = Options.createOptions({ features: customFeatures });

            expect(options.allowed).toEqual(Options.DEFAULT_ALLOWED_OPTIONS);
            expect(options.isFeatureEnabled('config')).toBe(true);
        });
    });

    describe('isFeatureEnabled', () => {
        it('should correctly determine if a feature is enabled', () => {
            const features: Feature[] = ['config'];
            const options = Options.createOptions({ features });

            expect(options.isFeatureEnabled('config')).toBe(true);
        });

        it('should return false for unknown features', () => {
            const options = Options.createOptions({});

            // @ts-ignore - Testing invalid feature
            expect(options.isFeatureEnabled('unknown-feature')).toBe(false);
        });
    });
});
