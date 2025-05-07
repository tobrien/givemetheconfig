import { Command } from 'commander';
import { Args, DefaultOptions, Feature, Givemetheconfig, Logger, Options } from 'types';
import { z, ZodObject } from 'zod';
import { configure } from './configure';
import { DEFAULT_FEATURES, DEFAULT_LOGGER, DEFAULT_OPTIONS } from './constants';
import { read } from './read';
import { ConfigSchema } from 'types';
import { validate } from './validate';

export * from './types';

// Make create function generic
export const create = <T extends z.ZodRawShape>(pOptions: {
    defaults: Pick<DefaultOptions, 'configDirectory'> & Partial<Omit<DefaultOptions, 'configDirectory'>>,
    features?: Feature[],
    configShape: T, // Make configShape mandatory
    logger?: Logger,
}): Givemetheconfig<T> => {


    const defaults: DefaultOptions = { ...DEFAULT_OPTIONS, ...pOptions.defaults } as DefaultOptions;
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





