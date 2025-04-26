import { Command } from 'commander';
import { Logger } from "winston";
// import * as path from 'path'; // No longer needed here
// import * as yaml from 'js-yaml'; // No longer needed here
import { DEFAULT_ENCODING } from './constants';
import * as yaml from 'js-yaml';
import path from 'path';
import { z, ZodObject, ZodTypeAny } from 'zod';
import * as Arguments from './arguments';
import { loadAndMergeConfig } from './config'; // Import the new function
import { DEFAULT_CONFIG_DIRECTORY, Options as GivemetheconfigOptions } from "./options";
import * as Storage from './util/storage';

export * from './options';

// Make interface generic
export interface Givemetheconfig<T extends ZodTypeAny> {
    configure: (command: Command) => Promise<Command>;
    setLogger: (logger: Logger) => void;
    // Validate return type uses the combined schema type
    validate: (args: Args) => Promise<z.infer<ZodObject<z.ZodRawShape & typeof ConfigSchema.shape>>>;
    getValuesFromFile: (args: Args) => Promise<z.infer<ZodObject<z.ZodRawShape & typeof ConfigSchema.shape>>>;
}

export interface Args {
    [key: string]: any;
}

// Base schema for core options
export const ConfigSchema = z.object({
    configDirectory: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Make create function generic
export const create = <T extends z.ZodRawShape>(options: GivemetheconfigOptions<T>): Givemetheconfig<z.ZodObject<T & typeof ConfigSchema.shape>> => {

    let logger: Logger | typeof console = console;

    // Combine the base schema with the user-provided shape
    const fullSchema = z.object({
        ...ConfigSchema.shape,
        ...options.configShape,
    });

    // Define the final config type based on the combined schema
    type FinalConfigType = z.infer<typeof fullSchema>;

    // TODO: argumentsInstance needs to be aware of `fullSchema` or `options.configShape`
    const argumentsInstance = Arguments.create(options as any); // Cast for now

    const setLogger = (pLogger: Logger) => {
        logger = pLogger;
    }

    const configure = (command: Command): Promise<Command> => {
        return argumentsInstance.configure(command);
    }

    // Update validate implementation
    const validate = async (args: Args): Promise<FinalConfigType> => {
        logger.debug('Initial Args: \n\n%s\n\n', JSON.stringify(args, null, 2));

        // Assume argumentsInstance.validate returns validated CLI args + resolved config dir
        // The type here should ideally align precisely with what Arguments.validate returns
        const cliProvidedArgs: Config = await argumentsInstance.validate(args);
        logger.debug('CLI Provided Args: \n\n%s\n\n', JSON.stringify(cliProvidedArgs, null, 2));

        // Determine the final config directory path
        const resolvedConfigDir = cliProvidedArgs.configDirectory || options.defaults?.configDirectory || DEFAULT_CONFIG_DIRECTORY;
        logger.debug(`Resolved config directory: ${resolvedConfigDir}`);

        // Delegate loading, merging, and validation to the new function
        const finalConfig = await loadAndMergeConfig<T, typeof fullSchema>({
            logger,
            cliProvidedArgs,
            resolvedConfigDir,
            fullSchema,
        });

        // The finalConfig is already validated and has configDirectory correctly set
        logger.debug('Final Config returned to caller: \n\n%s\n\n', JSON.stringify(finalConfig, null, 2));

        return finalConfig;
    }

    const getValuesFromFile = async (args: Args): Promise<z.infer<ZodObject<z.ZodRawShape & typeof ConfigSchema.shape>>> => {
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
        return rawFileConfig as z.infer<ZodObject<z.ZodRawShape & typeof ConfigSchema.shape>>;
    }

    return {
        setLogger,
        configure,
        validate,
        getValuesFromFile,
    }
}





