import * as path from 'path';
import * as yaml from 'js-yaml';
import { z, ZodObject } from 'zod';
import { Config, ConfigSchema, Logger } from "./givemetheconfig";
import * as Storage from "./util/storage";
import { DEFAULT_ENCODING } from "./constants";

function listZodKeys(schema: z.ZodTypeAny, prefix = ''): string[] {
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        return listZodKeys(schema.unwrap(), prefix);
    }
    if (schema instanceof z.ZodArray) {
        return listZodKeys(schema.element, prefix);
    }
    if (schema instanceof z.ZodObject) {
        return Object.entries(schema.shape).flatMap(([key, subschema]) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const nested = listZodKeys(subschema as z.ZodTypeAny, fullKey);
            return nested.length ? nested : fullKey;
        });
    }
    return [];
}

export interface LoadAndMergeConfigArgs<T extends z.ZodRawShape> {
    logger: Logger;
    cliProvidedArgs: Config;
    resolvedConfigDir: string;
    configShape: T;
}

function checkForExtraKeys(mergedSources: object, fullSchema: ZodObject<any>, logger: Logger | typeof console): void {
    const allowedKeys = new Set(listZodKeys(fullSchema));
    const actualKeys = Object.keys(mergedSources);
    const extraKeys = actualKeys.filter(key => !allowedKeys.has(key));

    if (extraKeys.length > 0) {
        const allowedKeysString = Array.from(allowedKeys).join(', ');
        const extraKeysString = extraKeys.join(', ');
        const errorMessage = `Unknown configuration keys found: ${extraKeysString}. Allowed keys are: ${allowedKeysString}`;
        logger.error(errorMessage);
        throw new Error(`Configuration validation failed: Unknown keys found (${extraKeysString}). Check logs for details.`);
    }
}

export const loadAndMergeConfig = async <T extends z.ZodRawShape>(
    args: LoadAndMergeConfigArgs<T>
): Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>> => {
    const { logger, cliProvidedArgs, resolvedConfigDir, configShape } = args;

    const storage = Storage.create({ log: logger.debug });
    const configFile = path.join(resolvedConfigDir, 'config.yaml');
    logger.debug(`Attempting to load config file: ${configFile}`);

    // Combine the base schema with the user-provided shape
    const fullSchema = z.object({
        ...ConfigSchema.shape,
        ...configShape,
    });

    let rawFileConfig: object = {};

    try {
        const yamlContent = await storage.readFile(configFile, DEFAULT_ENCODING);
        const parsedYaml = yaml.load(yamlContent);
        if (parsedYaml !== null && typeof parsedYaml === 'object') {
            rawFileConfig = parsedYaml;
            logger.debug('Loaded Raw File Config: \n\n%s\n\n', JSON.stringify(rawFileConfig, null, 2));
        } else if (parsedYaml !== null) {
            logger.warn(`Ignoring invalid configuration format in ${configFile}. Expected an object, got ${typeof parsedYaml}.`);
        }
    } catch (error: any) {
        if (error.code === 'ENOENT' || /not found|no such file/i.test(error.message)) {
            logger.debug(`Configuration file not found at ${configFile}. Skipping.`);
        } else {
            logger.error(`Failed to load or parse configuration from ${configFile}: ${error.message}`);
            // Potentially re-throw here depending on desired strictness
            // throw new Error(`Failed to load configuration from ${configFile}: ${error.message}`);
        }
    }

    // Merge sources: File < CLI
    const mergedSources = { ...rawFileConfig, ...cliProvidedArgs };
    logger.debug('Merged Sources (File < CLI): \n\n%s\n\n', JSON.stringify(mergedSources, null, 2));


    logger.debug('Full Schema: \n\n%s\n\n', JSON.stringify(listZodKeys(fullSchema), null, 2));

    // Validate the merged sources against the full schema
    const validationResult = fullSchema.safeParse(mergedSources);

    // Check for extraneous keys
    checkForExtraKeys(mergedSources, fullSchema, logger);

    if (!validationResult.success) {
        logger.error('Configuration validation failed: %s', JSON.stringify(validationResult.error.format(), null, 2));
        throw new Error(`Configuration validation failed. Check logs for details.`);
    }

    let validatedData: z.infer<ZodObject<T & typeof ConfigSchema.shape>> = validationResult.data;
    logger.debug('Validated Data: \n\n%s\n\n', JSON.stringify(validatedData, null, 2));

    // Ensure the final config directory is correctly set, overriding schema defaults if necessary
    // This is crucial because cliProvidedArgs might not have configDirectory if it came
    // from defaults, and the file might not have it either.
    validatedData = { ...validatedData, configDirectory: resolvedConfigDir };

    logger.debug('Final Validated Config (from config.ts): \n\n%s\n\n', JSON.stringify(validatedData, null, 2));

    return validatedData;
}; 