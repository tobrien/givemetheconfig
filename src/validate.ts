import {
    DEFAULT_CONFIG_DIRECTORY,
} from "./constants";
import { ArgumentError } from "./error/ArgumentError";
import { Args, Config, ConfigSchema } from "./givemetheconfig";
import { Options } from "./givemetheconfig";
import * as Storage from "./util/storage";
import { z, ZodObject } from "zod";
import { loadAndMergeConfig } from "./config";
export { ArgumentError };

function clean(obj: any) {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    );
}

export const validate = async <T extends z.ZodRawShape>(args: Args, options: Options<T>): Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>> => {

    const logger = options.logger;
    const config: Partial<Config> = {};

    const validateConfigDirectory = async (configDirectory: string) => {
        // eslint-disable-next-line no-console
        const storage = Storage.create({ log: console.log });
        if (!storage.isDirectoryReadable(configDirectory)) {
            throw new Error(`Config directory does not exist: ${configDirectory}`);
        }
    }

    logger.debug('Initial Args: \n\n%s\n\n', JSON.stringify(args, null, 2));

    // Assume argumentsInstance.validate returns validated CLI args + resolved config dir
    // The type here should ideally align precisely with what Arguments.validate returns


    if (options.features.includes('config') && args.configDirectory) {
        await validateConfigDirectory(args.configDirectory);
        config.configDirectory = args.configDirectory ?? DEFAULT_CONFIG_DIRECTORY;
    }


    logger.debug('CLI Provided Args: \n\n%s\n\n', JSON.stringify(config, null, 2));

    // Determine the final config directory path
    const resolvedConfigDir = config.configDirectory || options.defaults?.configDirectory || DEFAULT_CONFIG_DIRECTORY;
    logger.debug(`Resolved config directory: ${resolvedConfigDir}`);

    // Delegate loading, merging, and validation to the new function
    const finalConfig = await loadAndMergeConfig<T>({
        logger: options.logger,
        cliProvidedArgs: config as Config,
        resolvedConfigDir,
        configShape: options.configShape,
    });

    // The finalConfig is already validated and has configDirectory correctly set
    logger.debug('Final Config returned to caller: \n\n%s\n\n', JSON.stringify(finalConfig, null, 2));


    return clean(finalConfig) as z.infer<ZodObject<T & typeof ConfigSchema.shape>>;
}

