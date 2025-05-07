import { jest } from '@jest/globals';
import { z } from 'zod';
import type * as StorageUtil from '../src/util/storage';
import { ConfigSchema, Logger, Options } from '../src/types';
import { ArgumentError } from '../src/error/ArgumentError'; // Import even if just re-exported

// --- Mock Dependencies ---

// Mock storage
const mockIsDirectoryReadable = jest.fn<StorageUtil.Utility['isDirectoryReadable']>();
const mockExists = jest.fn<StorageUtil.Utility['exists']>();
const mockStorageCreate = jest.fn<typeof StorageUtil.create>().mockReturnValue({
    isDirectoryReadable: mockIsDirectoryReadable,
    // Add other methods if needed, mocked or otherwise
    // Use ts-ignore for methods not explicitly mocked if necessary
    // @ts-ignore
    readFile: jest.fn(),
    // @ts-ignore
    isDirectoryWritable: jest.fn(),
    // @ts-ignore
    forEachFileIn: jest.fn(),
    // @ts-ignore
    writeFile: jest.fn(),
    // @ts-ignore
    ensureDir: jest.fn(),
    // @ts-ignore
    remove: jest.fn(),
    // @ts-ignore
    pathExists: jest.fn(),
    // @ts-ignore
    copyFile: jest.fn(),
    // @ts-ignore
    moveFile: jest.fn(),
    // @ts-ignore
    listFiles: jest.fn(),
    // @ts-ignore
    createReadStream: jest.fn(),
    // @ts-ignore
    createWriteStream: jest.fn(),
    // @ts-ignore
    exists: mockExists,
});
jest.unstable_mockModule('../src/util/storage', () => ({
    create: mockStorageCreate,
}));

// --- Dynamically Import Module Under Test ---
// Needs to be imported *after* mocks are set up
const { validate, listZodKeys, checkForExtraKeys } = await import('../src/validate');

// --- Test Suite ---

describe('validate', () => {
    let mockLogger: jest.Mocked<Logger>;
    let baseOptions: Options<any>; // Use 'any' for simplicity in tests

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            verbose: jest.fn(),
            silly: jest.fn(),
        };

        baseOptions = {
            logger: mockLogger,
            configShape: z.object({}), // Default empty shape
            features: ['config'], // Default feature set including 'config'
            defaults: {
                configDirectory: '.',
                configFile: 'config.yaml',
                isRequired: false,
                encoding: 'utf8',
            }, // Default empty defaults
        };

        // Default mock implementations
        mockIsDirectoryReadable.mockResolvedValue(true); // Assume readable by default
    });

    // --- Basic Validation Tests ---

    test('should pass validation for a valid config', async () => {
        const shape = z.object({ port: z.number() });
        const config = { port: 8080, configDirectory: '/config' };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Extra Keys Check ---

    test('should throw error for extra keys not defined in schema', async () => {
        const shape = z.object({ port: z.number() });
        const config = { port: 8080, extraKey: 'unexpected', configDirectory: '/config' };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).rejects.toThrow('Configuration validation failed: Unknown keys found (extraKey). Check logs for details.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: extraKey. Allowed keys are:'));
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('configDirectory, port')); // Check allowed keys listing
    });

    // --- configDirectory Validation Tests ---

    test('should throw error if configDirectory is not readable and feature "config" is enabled', async () => {
        const configDir = '/invalid/config/dir';
        const config = { configDirectory: configDir };
        const options: Options<any> = { ...baseOptions, features: ['config'] };
        mockExists.mockResolvedValue(true);
        mockIsDirectoryReadable.mockResolvedValue(false);

        await expect(validate(config, options)).rejects.toThrow(`Config directory exists but is not readable: ${configDir}`);
        expect(mockStorageCreate).toHaveBeenCalled();
        expect(mockIsDirectoryReadable).toHaveBeenCalledWith(configDir);
    });

    test('should throw error if configDirectory does not exist and feature "config" is enabled and isRequired is true', async () => {
        const configDir = '/invalid/config/dir';
        const config = { configDirectory: configDir };
        const options: Options<any> = { ...baseOptions, defaults: { ...baseOptions.defaults, isRequired: true }, features: ['config'] };
        mockExists.mockResolvedValue(false);

        await expect(validate(config, options)).rejects.toThrow(`Config directory does not exist and is required: ${configDir}`);
        expect(mockStorageCreate).toHaveBeenCalled();
        expect(mockExists).toHaveBeenCalledWith(configDir);
    });

    test('should work if configDirectory does not exist, isRequired is false, config is empty, and feature "config" is enabled', async () => {
        const configDir = '/invalid/config/dir';
        const shape = z.object({
            server: z.object({ host: z.string(), port: z.number() }).optional(),
            logging: z.object({ level: z.string() }).optional()
        });
        const config = {
            configDirectory: configDir,
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, defaults: { ...baseOptions.defaults, isRequired: false }, features: ['config'], configShape: shape.shape };
        mockExists.mockResolvedValue(false);
        mockIsDirectoryReadable.mockResolvedValue(false);

        await validate(config as any, options);
        expect(mockExists).toHaveBeenCalledWith(configDir);
    });

    // --- Nested Schema Tests ---

    test('should pass validation for valid nested config', async () => {
        const shape = z.object({
            server: z.object({ host: z.string(), port: z.number() }),
            logging: z.object({ level: z.string() })
        });
        const config = {
            server: { host: 'localhost', port: 3000 },
            logging: { level: 'info' },
            configDirectory: '/config'
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should throw validation error for invalid nested config', async () => {
        const shape = z.object({
            server: z.object({ host: z.string(), port: z.number() }),
        });
        const config = {
            server: { host: 'localhost', port: '3000' }, // port is string
            configDirectory: '/config'
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config as any, options)).rejects.toThrow('Configuration validation failed. Check logs for details.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Configuration validation failed:'), expect.any(String));
    });

    test('should throw error for extra nested keys', async () => {
        const shape = z.object({ server: z.object({ port: z.number() }) });
        const config = {
            server: { port: 8080, unexpected: true }, // Extra key within server
            configDirectory: '/config'
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        // Note: Zod's default behavior is to strip extra keys during parsing.
        // The checkForExtraKeys function operates on the *original* config object *before* Zod parsing strips keys.
        // However, listZodKeys *only* lists keys defined in the schema.
        // So, this test case checks if the top-level keys are allowed. Nested extra keys are implicitly handled (stripped) by Zod's safeParse.
        // Let's add a top-level extra key to trigger our custom check explicitly.
        const configWithTopLevelExtra = {
            ...config,
            anotherExtra: 'value'
        }

        // Check the type passed to validate - it expects the inferred type
        const typedConfig: z.infer<typeof shape> & { configDirectory: string, anotherExtra: string } = configWithTopLevelExtra;

        await expect(validate(typedConfig, options)).rejects.toThrow('Configuration validation failed: Unknown keys found (server.unexpected, anotherExtra). Check logs for details.');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: server.unexpected, anotherExtra. Allowed keys are:'));
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('configDirectory, server.port'));
    });


    // --- Optional Keys ---

    test('should pass validation when optional keys are missing', async () => {
        const shape = z.object({
            required: z.string(),
            optional: z.number().optional()
        });
        const config = { required: 'hello', configDirectory: '/config' }; // optional is missing
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should pass validation when optional keys are present', async () => {
        const shape = z.object({
            required: z.string(),
            optional: z.number().optional()
        });
        const config = { required: 'hello', optional: 123, configDirectory: '/config' };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Helper Function Tests (Optional but good practice) ---
    describe('listZodKeys', () => {
        test('should list keys for a simple object', () => {
            const schema = z.object({ a: z.string(), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should list keys for a nested object', () => {
            const schema = z.object({ a: z.string(), b: z.object({ c: z.boolean(), d: z.number() }) });
            expect(listZodKeys(schema)).toEqual(['a', 'b.c', 'b.d']);
        });

        test('should handle optional keys', () => {
            const schema = z.object({ a: z.string().optional(), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle nullable keys', () => {
            const schema = z.object({ a: z.string().nullable(), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle arrays (stops at array level)', () => {
            const schema = z.object({ a: z.array(z.string()), b: z.number() });
            // listZodKeys traverses *into* arrays to find nested object keys if they exist
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle arrays of objects', () => {
            const schema = z.object({ a: z.array(z.object({ id: z.number(), name: z.string() })), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a.id', 'a.name', 'b']);
        });

        test('should return empty for non-object types', () => {
            expect(listZodKeys(z.string())).toEqual([]);
            expect(listZodKeys(z.number())).toEqual([]);
            expect(listZodKeys(z.boolean())).toEqual([]);
        });
    });

    describe('checkForExtraKeys', () => {
        let schema: z.ZodObject<any>;
        let logger: jest.Mocked<Logger>;

        beforeEach(() => {
            schema = z.object({ known: z.string(), nested: z.object({ deep: z.number() }) });
            logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), verbose: jest.fn(), silly: jest.fn() }; // Provide mock logger
        });

        test('should not throw or log if no extra keys', () => {
            const config = { known: 'value', nested: { deep: 123 } };
            expect(() => checkForExtraKeys(config, schema, logger)).not.toThrow();
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should throw and log if extra top-level keys exist', () => {
            const config = { known: 'value', nested: { deep: 123 }, extra: 'bad' };
            expect(() => checkForExtraKeys(config, schema, logger)).toThrow('Configuration validation failed: Unknown keys found (extra). Check logs for details.');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: extra. Allowed keys are: known, nested.deep'));
        });

        test('should throw and log if extra nested keys exist (passed as top level)', () => {
            // Our check works on the flattened keys derived from the schema vs the top-level keys of the config object.
            // It won't inherently detect { nested: { deep: 1, extra: 'bad' } } unless 'nested.extra' is somehow a top-level key
            // in the mergedSources object passed to it. Let's simulate that scenario.
            const config = { known: 'value', 'nested.deep': 123, 'nested.extra': 'bad' };
            expect(() => checkForExtraKeys(config, schema, logger)).toThrow('Configuration validation failed: Unknown keys found (nested.extra). Check logs for details.');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: nested.extra. Allowed keys are: known, nested.deep'));
        });

        test('should correctly identify allowed keys from complex schema', () => {
            const complexSchema = z.object({
                a: z.string(),
                b: z.object({ c: z.number(), d: z.boolean().optional() }),
                e: z.array(z.object({ f: z.string() }))
            });
            const config = { a: '1', b: { c: 2 }, e: [{ f: '3' }], extra: true };
            expect(() => checkForExtraKeys(config, complexSchema, logger)).toThrow('Configuration validation failed: Unknown keys found (extra). Check logs for details.');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: extra. Allowed keys are: a, b.c, b.d, e.f'));
        });
    });

});

// Export something to make it a module
export { };
