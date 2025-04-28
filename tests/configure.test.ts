import { jest } from '@jest/globals';
import type { Command } from 'commander';
import { z } from 'zod';
import { DEFAULT_CONFIG_DIRECTORY } from '../src/constants';
import { Options } from '../src/types';

// --- Mock Dependencies ---

// Mock commander
const mockOption = jest.fn<Command['option']>();
const mockCommand = {
    option: mockOption,
} as unknown as Command; // Use type assertion for simplicity

// We don't need to mock Command itself, just the instance passed in and its methods

// --- Dynamically Import Module Under Test ---
// Needs to be imported *after* mocks are set up
const { configure } = await import('../src/configure');


// --- Test Suite ---

describe('configure', () => {
    let baseOptions: Options<any>; // Use 'any' for the Zod schema shape for simplicity

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

        // Reset base options
        baseOptions = {
            logger: { // Provide a mock logger
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                verbose: jest.fn(),
                silly: jest.fn(),
            },
            defaults: undefined, // Explicitly set defaults if testing them
            features: [], // Add required features array (can be empty)
            configShape: z.object({}), // Add required empty Zod object shape
        };

        // Reset the mockCommand behavior for each test if needed
        // For example, make `option` return the command instance for chaining
        mockOption.mockImplementation(() => mockCommand);
    });

    test('should add configDirectory option with default path when no defaults provided', async () => {
        const result = await configure(mockCommand, baseOptions);

        expect(mockOption).toHaveBeenCalledTimes(1);
        expect(mockOption).toHaveBeenCalledWith(
            '-c, --config-directory <configDirectory>',
            'Config Directory',
            DEFAULT_CONFIG_DIRECTORY
        );
        expect(result).toBe(mockCommand); // Should return the command instance
    });

    test('should add configDirectory option using path from options.defaults', async () => {
        const customDefaultsDir = '/custom/config/dir';
        const optionsWithDefaults = {
            ...baseOptions,
            defaults: { configDirectory: customDefaultsDir },
        };

        const result = await configure(mockCommand, optionsWithDefaults);

        expect(mockOption).toHaveBeenCalledTimes(1);
        expect(mockOption).toHaveBeenCalledWith(
            '-c, --config-directory <configDirectory>',
            'Config Directory',
            customDefaultsDir // Should use the default from options
        );
        expect(result).toBe(mockCommand); // Should return the command instance
    });

    test('should return the command object passed in', async () => {
        const result = await configure(mockCommand, baseOptions);
        expect(result).toBe(mockCommand);
    });

});
