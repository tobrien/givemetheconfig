import * as yaml from 'js-yaml';
import path from 'path';
import { z, ZodObject } from 'zod';
import { Args, ConfigSchema, Options } from './types';
import * as Storage from './util/storage';

function clean(obj: any) {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    );
}

export const read = async <T extends z.ZodRawShape>(args: Args, options: Options<T>): Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>> => {
    const logger = options.logger;
    const storage = Storage.create({ log: logger.debug });

    const resolvedConfigDir = args.configDirectory || options.defaults?.configDirectory;
    logger.debug(`Resolved config directory: ${resolvedConfigDir}`);

    const configFile = path.join(resolvedConfigDir, options.defaults.configFile);
    logger.debug(`Attempting to load config file for givemetheconfig: ${configFile}`);

    let rawFileConfig: object = {};

    try {
        const yamlContent = await storage.readFile(configFile, options.defaults.encoding);
        const parsedYaml = yaml.load(yamlContent);
        if (parsedYaml !== null && typeof parsedYaml === 'object') {
            rawFileConfig = parsedYaml;
            logger.debug('Loaded Raw File Config for getValuesFromFile: \n\n%s\n\n', JSON.stringify(rawFileConfig, null, 2));
        } else if (parsedYaml !== null) {
            logger.warn(`Ignoring invalid configuration format in ${configFile} for givemetheconfig. Expected an object, got ${typeof parsedYaml}.`);
        }
    } catch (error: any) {
        if (error.code === 'ENOENT' || /not found|no such file/i.test(error.message)) {
            logger.debug(`Configuration file not found at ${configFile} for givemetheconfig. Returning empty object.`);
        } else {
            // Log error but don't throw, just return empty object as per the goal of just *getting* values
            logger.error(`Failed to load or parse configuration from ${configFile} for getValuesFromFile: ${error.message}`);
        }
    }

    const config: z.infer<ZodObject<T & typeof ConfigSchema.shape>> = clean({
        ...rawFileConfig,
        ...{
            configDirectory: resolvedConfigDir,
        }
    }) as z.infer<ZodObject<T & typeof ConfigSchema.shape>>;

    return config;
}