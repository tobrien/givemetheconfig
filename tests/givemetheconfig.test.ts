import { jest } from '@jest/globals';
import { Command } from 'commander';
import winston from 'winston';
import { Options, Feature, DefaultOptions } from '../src/options';
import { z } from 'zod';
// Mock dependencies
jest.unstable_mockModule('../src/arguments', () => ({
    create: jest.fn(),
}));

// Dynamic imports
let Arguments: any;
let ArgumentsModule: any;
let Givemetheconfig: any;
let GivemetheconfigModule: any;

describe('givemetheconfig', () => {
    jest.setTimeout(60000);

    // Mock implementations
    let mockArgumentsInstance: any;
    let mockLogger: any;
    let options: Options<any>;

    let configShape = {
        helloThere: z.string().optional(),
    };

    // Initialize modules before all tests
    beforeAll(async () => {
        ArgumentsModule = await import('../src/arguments');
        GivemetheconfigModule = await import('../src/givemetheconfig');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock arguments instance
        mockArgumentsInstance = {
            configure: jest.fn(async (cmd: any) => Promise.resolve(cmd)),
            validate: jest.fn(async (args: any) => Promise.resolve({ ...args }))
        };

        // Setup mock logger
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        // Setup options
        options = {
            defaults: {
                configDirectory: './test-config'
            },
            isFeatureEnabled: jest.fn((feature: Feature) => true),
            configShape: configShape,
        };

        // Setup arguments mock
        (ArgumentsModule.create as jest.Mock).mockReturnValue(mockArgumentsInstance);
    });

    describe('create', () => {
        it('should create a givemetheconfig instance with provided options', () => {
            const gimmeConfig = GivemetheconfigModule.create(options);

            expect(gimmeConfig).toHaveProperty('setLogger');
            expect(gimmeConfig).toHaveProperty('configure');
            expect(gimmeConfig).toHaveProperty('validate');
            expect(ArgumentsModule.create).toHaveBeenCalledWith(options);
        });
    });

    describe('setLogger', () => {
        it('should set the logger instance', async () => {
            const gimmeConfig = GivemetheconfigModule.create(options);

            gimmeConfig.setLogger(mockLogger);

            // Create a test argument to validate
            const testArgs = { configDirectory: './test-config-dir' };

            // Call validate which should use the logger
            await gimmeConfig.validate(testArgs);

            // Check if logger was used
            expect(mockLogger.debug).toHaveBeenCalledTimes(10);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "Resolved config directory: ./test-config-dir"
            );
        });
    });

    describe('configure', () => {
        it('should call arguments.configure with command', async () => {
            const gimmeConfig = GivemetheconfigModule.create(options);
            const command = new Command();

            await gimmeConfig.configure(command);

            expect(mockArgumentsInstance.configure).toHaveBeenCalledWith(command);
        });

        it('should return the configured command', async () => {
            const gimmeConfig = GivemetheconfigModule.create(options);
            const command = new Command();

            const result = await gimmeConfig.configure(command);

            expect(result).toBe(command);
        });
    });

    describe('validate', () => {
        it('should call arguments.validate with args', async () => {
            const gimmeConfig = GivemetheconfigModule.create(options);
            const args = { configDirectory: './test-config-dir' };

            await gimmeConfig.validate(args);

            expect(mockArgumentsInstance.validate).toHaveBeenCalledWith(args);
        });

        it('should log input and output during validation', async () => {
            const gimmeConfig = GivemetheconfigModule.create(options);
            gimmeConfig.setLogger(mockLogger);

            const args = { configDirectory: './test-config-dir' };
            const expectedConfig = { configDirectory: './test-config-dir' };

            mockArgumentsInstance.validate.mockResolvedValueOnce(expectedConfig);

            const result = await gimmeConfig.validate(args);

            expect(mockLogger.debug).toHaveBeenCalledTimes(10);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Resolved config directory"),
            );
            expect(result).toEqual(expectedConfig);
        });

        it('should return the validated config', async () => {
            const gimmeConfig = GivemetheconfigModule.create(options);
            const args = { configDirectory: './test-config-dir' };
            const expectedConfig = { configDirectory: './validated-config-dir' };

            mockArgumentsInstance.validate.mockResolvedValueOnce(expectedConfig);

            const result = await gimmeConfig.validate(args);

            expect(result).toEqual(expectedConfig);
        });

        it('should use console for logging if no logger is set', async () => {
            const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => { });

            const gimmeConfig = GivemetheconfigModule.create(options);
            const args = { configDirectory: './test-config-dir' };

            await gimmeConfig.validate(args);

            expect(consoleSpy).toHaveBeenCalledTimes(10);
            consoleSpy.mockRestore();
        });
    });
});
