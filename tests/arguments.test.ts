import { jest } from '@jest/globals';
import { Command } from 'commander';
import { ArgumentError } from '../src/error/ArgumentError';
import { Feature, Options } from '../src/options';
// import * as Dates from '../src/util/dates'; // Remove static import
// import * as Storage from '../src/util/storage'; // Remove static import
// import * as Options from '../src/options'; // Remove static import

jest.unstable_mockModule('../src/util/storage', () => ({
    create: jest.fn(),
}));

// Add mock for dates module
jest.unstable_mockModule('../src/util/dates', () => ({
    create: jest.fn(), // Mock the factory function
    validTimezones: jest.fn(),
}));

jest.unstable_mockModule('../src/options', () => ({
    create: jest.fn(),
    DEFAULT_OPTIONS: {
        configDirectory: './default-config',
    },
    DEFAULT_FEATURES: ['config'],
}));

// Add these back
let Dates: any;
let Storage: any;
let Options: any;
let Arguments: any;

// Move dynamic imports here, outside beforeEach
let DatesModule: any;
let StorageModule: any;
let OptionsModule: any; // Renamed to avoid conflict with the 'Options' type/interface
let ArgumentsModule: any; // Renamed to avoid conflict

describe('arguments', () => {
    jest.setTimeout(60000); // Increase timeout for hooks and tests in this suite

    // Initialize modules once before all tests
    beforeAll(async () => {
        DatesModule = await import('../src/util/dates');
        StorageModule = await import('../src/util/storage');
        OptionsModule = await import('../src/options');
        ArgumentsModule = await import('../src/arguments');
    });

    let mockDates: any;
    let mockStorage: any;
    let mockOptions: any;
    let mockStorageInstance: any;
    let mockOptionsInstance: any;
    let mockDatesUtil: any; // Add variable for the mock utility object

    const options = {
        defaults: {
            timezone: 'America/New_York',
            recursive: true,
            inputDirectory: './test-input',
            outputDirectory: './test-output',
            outputStructure: 'month',
            outputFilenameOptions: ['date', 'subject'],
            extensions: ['mp3', 'mp4']
        },
        allowed: {
            outputStructures: ['none', 'year', 'month', 'day'],
            outputFilenameOptions: ['date', 'time', 'subject'],
            extensions: ['mp3', 'mp4', 'wav', 'webm']
        }
    };

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup dates mock utility object returned by Dates.create()
        mockDatesUtil = {
            isValidDate: jest.fn().mockReturnValue(true), // Assume valid by default
            parse: jest.fn((dateStr: string, format?: string) => new Date(dateStr)), // Added types
            format: jest.fn((date: Date, format: string) => `${date.toISOString().split('T')[0]}-${format}`), // Added types
            isAfter: jest.fn((d1: Date, d2: Date) => d1 > d2), // Added types
            isBefore: jest.fn((d1: Date, d2: Date) => d1 < d2), // Added types
            subDays: jest.fn((date: Date, days: number) => new Date(date.getTime() - days * 86400000)), // Added types
            now: jest.fn(() => new Date('2024-01-15T12:00:00Z')),
            // validTimezones is now mocked on the module itself
        };
        // Configure the mocks defined via jest.unstable_mockModule
        (DatesModule.create as jest.Mock).mockReturnValue(mockDatesUtil);
        (DatesModule.validTimezones as jest.Mock).mockReturnValue(['Etc/UTC', 'America/New_York', 'Europe/London']);

        // Setup storage mock
        mockStorageInstance = {
            isDirectoryReadable: jest.fn(),
            isDirectoryWritable: jest.fn()
        };
        mockStorage = {
            create: jest.fn().mockReturnValue(mockStorageInstance)
        };
        (StorageModule.create as jest.Mock).mockImplementation(mockStorage.create);

        // Setup options mock
        mockOptionsInstance = {
            defaults: options.defaults,
            allowed: options.allowed,
            isFeatureEnabled: jest.fn().mockReturnValue(true) // Enable all features by default
        };
        mockOptions = {
            create: jest.fn().mockReturnValue(mockOptionsInstance)
        };
        (OptionsModule.create as jest.Mock).mockImplementation(mockOptions.create);
    });

    describe('configure', () => {
        it('should configure a command with default options', async () => {
            // Use options from the mock
            (OptionsModule.create as jest.Mock).mockReturnValueOnce(mockOptionsInstance);

            const args = ArgumentsModule.create(mockOptionsInstance);
            const command = new Command();

            const spy = jest.spyOn(command, 'option');

            await args.configure(command);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith('-c, --config-directory <configDirectory>', expect.any(String), '.givemetheconfig');
        }, 60000);

        it('should configure a command with fallback to constants when no defaults provided', async () => {
            // Mock with different default options
            const noDefaultsOptionsInstance = {
                defaults: {},
                allowed: options.allowed,
                isFeatureEnabled: jest.fn().mockReturnValue(true)
            };

            (OptionsModule.create as jest.Mock).mockReturnValueOnce(noDefaultsOptionsInstance);

            const args = ArgumentsModule.create(noDefaultsOptionsInstance);
            const command = new Command();

            const spy = jest.spyOn(command, 'option');

            await args.configure(command);

            // Should use defaults from constants
            expect(spy).toHaveBeenCalledWith('-c, --config-directory <configDirectory>', expect.any(String), '.givemetheconfig');
        }, 60000);
    });

    describe('validate', () => {
        it('should validate input with all valid options', async () => {
            (OptionsModule.create as jest.Mock).mockReturnValueOnce(mockOptionsInstance);

            const args = ArgumentsModule.create(mockOptionsInstance);

            mockStorageInstance.isDirectoryReadable.mockReturnValue(true);
            mockStorageInstance.isDirectoryWritable.mockReturnValue(true);

            const input = {
                configDirectory: './valid-config',
            };

            const result = await args.validate(input);

            expect(result).toEqual({
                configDirectory: './valid-config',
            });

            expect(mockStorageInstance.isDirectoryReadable).toHaveBeenCalledWith('./valid-config');
            expect(mockOptionsInstance.isFeatureEnabled).toHaveBeenCalled();
        }, 60000);

        it('should use default values when not provided in input', async () => {
            (OptionsModule.create as jest.Mock).mockReturnValueOnce(mockOptionsInstance);

            const args = ArgumentsModule.create(mockOptionsInstance);

            mockStorageInstance.isDirectoryReadable.mockReturnValue(true);
            mockStorageInstance.isDirectoryWritable.mockReturnValue(true);

            // Partial input with missing values
            const input = {
                configDirectory: './valid-config',
            };

            const result = await args.validate(input);

            // Should use defaults from options
            expect(result).toEqual({
                configDirectory: './valid-config',
            });

            expect(mockOptionsInstance.isFeatureEnabled).toHaveBeenCalled();
        }, 60000);

        it('should throw error for invalid input directory when input feature is enabled', async () => {
            // Mock to enable only input feature
            const featureCheck = (feature: Feature) => feature === 'config';
            mockOptionsInstance.isFeatureEnabled.mockImplementation((f: any) => featureCheck(f as Feature));

            (OptionsModule.create as jest.Mock).mockReturnValueOnce(mockOptionsInstance);

            const args = ArgumentsModule.create(mockOptionsInstance);

            mockStorageInstance.isDirectoryReadable.mockReturnValue(false);

            const input = {
                configDirectory: './invalid-config',
            };

            await expect(args.validate(input)).rejects.toThrow('Config directory does not exist: ./invalid-config');
            expect(mockOptionsInstance.isFeatureEnabled).toHaveBeenCalledWith('config');
        }, 60000);
    });
});
