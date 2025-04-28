// import * as path from 'path'; // No longer needed here
// import * as yaml from 'js-yaml'; // No longer needed here
import { Args, ConfigSchema } from 'givemetheconfig';
import * as yaml from 'js-yaml';
import path from 'path';
import { z, ZodObject } from 'zod';
import { DEFAULT_CONFIG_DIRECTORY, DEFAULT_ENCODING } from './constants';
import * as Storage from './util/storage';
import { Options } from './givemetheconfig';

function clean(obj: any) {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    );
}

export const read = async <T extends z.ZodRawShape>(args: Args, options: Options<T>): Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>> => {
    const logger = options.logger;
    const resolvedConfigDir = args.configDirectory || options.defaults?.configDirectory || DEFAULT_CONFIG_DIRECTORY;
    logger.debug(`Resolved config directory: ${resolvedConfigDir}`);

    const storage = Storage.create({ log: logger.debug });
    const configFile = path.join(resolvedConfigDir, 'config.yaml');
    logger.debug(`Attempting to load config file for getValuesFromFile: ${configFile}`);

    let rawFileConfig: object = {};

    try {
        const yamlContent = await storage.readFile(configFile, DEFAULT_ENCODING);
        const parsedYaml = yaml.load(yamlContent);
        if (parsedYaml !== null && typeof parsedYaml === 'object') {
            rawFileConfig = parsedYaml;
            logger.debug('Loaded Raw File Config for getValuesFromFile: \n\n%s\n\n', JSON.stringify(rawFileConfig, null, 2));
        } else if (parsedYaml !== null) {
            logger.warn(`Ignoring invalid configuration format in ${configFile} for getValuesFromFile. Expected an object, got ${typeof parsedYaml}.`);
        }
    } catch (error: any) {
        if (error.code === 'ENOENT' || /not found|no such file/i.test(error.message)) {
            logger.debug(`Configuration file not found at ${configFile} for getValuesFromFile. Returning empty object.`);
        } else {
            // Log error but don't throw, just return empty object as per the goal of just *getting* values
            logger.error(`Failed to load or parse configuration from ${configFile} for getValuesFromFile: ${error.message}`);
        }
    }

    // Note: The return type annotation might be overly specific for raw file values.
    // Casting the potentially incomplete/unvalidated rawFileConfig to the complex Zod type.
    // Consider adjusting the function signature if only raw object data is needed.
    return clean(rawFileConfig) as z.infer<ZodObject<T & typeof ConfigSchema.shape>>;
}