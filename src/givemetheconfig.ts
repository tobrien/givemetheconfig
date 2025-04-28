import { Command } from 'commander';
import { Args, DefaultOptions, Feature, Givemetheconfig, Logger, Options } from 'types';
import { z, ZodObject } from 'zod';
import { configure } from './configure';
import { DEFAULT_APP_OPTIONS, DEFAULT_FEATURES, DEFAULT_LOGGER } from './constants';
import { read } from './read';
import { ConfigSchema } from 'types';
import { validate } from './validate';

export * from './types';

// Make create function generic
export const create = <T extends z.ZodRawShape>(pOptions: {
    defaults?: DefaultOptions,
    features?: Feature[],
    configShape: T, // Make configShape mandatory
    logger?: Logger,
}): Givemetheconfig<T> => {


    const defaults = pOptions.defaults || DEFAULT_APP_OPTIONS;
    const features = pOptions.features || DEFAULT_FEATURES;
    const configShape = pOptions.configShape;
    let logger = pOptions.logger || DEFAULT_LOGGER;

    const options: Options<T> = {
        defaults,
        features,
        configShape, // Store the shape
        logger,
    }

    const setLogger = (pLogger: Logger) => {
        logger = pLogger;
        options.logger = pLogger;
    }

    return {
        setLogger,
        configure: (command: Command) => configure(command, options),
        validate: (config: z.infer<ZodObject<T & typeof ConfigSchema.shape>>) => validate(config, options),
        read: (args: Args) => read(args, options),
    }
}





